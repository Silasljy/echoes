import axios from 'axios'
import { Constitution } from './constitution'

type MemoryPack = { summary: string; recent: Array<{ user: string; assistant: string }> }

export default {
    async generateReply({ constitution, memoryPack, input, evidence, requireCitation }:
        { constitution: Constitution; memoryPack: MemoryPack; input: string; evidence: Array<{ id: string; text: string }>; requireCitation?: boolean }) {

        const API_KEY = process.env.DEEPSEEK_API_KEY
        const API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1'

        if (!API_KEY) throw new Error('DEEPSEEK_API_KEY not configured')

        console.log('Using DeepSeek API at', API_URL)

        const parts: string[] = []
        parts.push(`角色说明：${constitution.instructions}`)
        parts.push(`问题：${input}`)
        if (memoryPack.summary) parts.push(`记忆摘要：${memoryPack.summary}`)
        if (memoryPack.recent.length) {
            parts.push('最近对话：')
            memoryPack.recent.forEach((t, i) => parts.push(`${i + 1}. 用户：${t.user}；助理：${t.assistant}`))
        }
        if (evidence && evidence.length) {
            parts.push('参考材料（仅可引用下列项，引用时请使用对应 id）：')
            evidence.forEach(ev => parts.push(`- [${ev.id}] ${ev.text}`))
        } else {
            parts.push('参考材料：无')
        }

        // Add explicit refusal and citation rules
        const refusalInstruction = '如果问题涉及超出上述知识范围（例如春秋之后的人物、事件、现代科技或未来事务），请不要编造答案，直接回复："关于此事我无法确定"，然后将话题引回与本角色相关的伦理或教导。'
        const citationInstruction = '重要：只能引用上面“参考材料”中列出的条目，不得编造或新增任何参考或来源。引用格式：在回答末尾单独一行添加：\n引用证据IDs: id1,id2 （若未使用任何证据，写：引用证据IDs: 无）。若需要引用但参考材料不足，请直接回复 "关于此事我无法确定"。'
        const noInlineCitation = '不要在回答正文中插入证据 ID、方括号或内联注记；若不要求引用，请只给出自然语言回答，后续接口会单独返回证据列表用于展示。'

        let systemPrompt = parts.join('\n') + '\n' + refusalInstruction + '\n'
        if (requireCitation) {
            systemPrompt += citationInstruction + '\n'
        } else {
            systemPrompt += noInlineCitation + '\n'
        }
        systemPrompt += '请以该角色风格、认知限制和史料为依据回答，必要时说明不确定性。'

        try {
            const resp = await axios.post(
                `${API_URL}/chat/completions`,
                {
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: input }
                    ],
                    temperature: 0.2,
                    max_tokens: 800
                },
                { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` } }
            )

            let message = resp.data?.choices?.[0]?.message?.content || resp.data?.output || JSON.stringify(resp.data)

            // Post-process: check for forbidden phrases in constitution to avoid persona drift
            const forbidden: string[] = (constitution as any).forbiddenPhrases || []
            const lower = String(message).toLowerCase()
            const hasForbidden = forbidden.some(fp => lower.includes(fp.toLowerCase()))
            if (hasForbidden) {
                return '关于此事我无法确定。我们不应超出本角色的知识范围。'
            }

            // If citation enforcement is required, verify compliance
            if (requireCitation) {
                // Verify citation compliance: expect a trailing line like "引用证据IDs: ..."
                const match = String(message).match(/引用证据IDs:\s*([^\n\r]*)/m)
                if (!match) {
                    // Non-compliant: no citation line
                    return '关于此事我无法确定。回答未遵守引用规则（缺少引用证据IDs）。'
                }

                const idsPart = match[1].trim()
                if (idsPart !== '无') {
                    const used = idsPart.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean)
                    const evidenceIds = (evidence || []).map(e => e.id)
                    const unknown = used.filter(u => !evidenceIds.includes(u))
                    if (unknown.length > 0) {
                        // model cited unknown evidence -> refuse
                        return '关于此事我无法确定。回答包含未提供的参考资料，可能为杜撰，故无法接受该回答。'
                    }
                }

                // Additionally check for raw URLs not present in evidence texts
                const urlRegex = /https?:\/\/[\w\-\.\/?#=&%]+/g
                const urls = String(message).match(urlRegex) || []
                const evidenceText = (evidence || []).map(e => e.text).join('\n')
                const badUrl = urls.find(u => !evidenceText.includes(u))
                if (badUrl) {
                    return '关于此事我无法确定。回答包含未提供或未知的外部链接，可能为杜撰。'
                }
            }

            return message
        } catch (err: any) {
            console.error('DeepSeek call failed:', err.response?.data || err.message)
            throw err
        }
    }

    ,
    async generateEvidence({ constitution, query, limit = 3 }:
        { constitution: Constitution; query: string; limit?: number }) {
        const API_KEY = process.env.DEEPSEEK_API_KEY
        const API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1'
        if (!API_KEY) throw new Error('DEEPSEEK_API_KEY not configured')

        const system = `你将为角色提供可能的参考材料片段，用于回答用户问题。严格要求：\n- 只返回合法的 JSON 数组（例如: [{"id":"a1","text":"证据文本"}, ...]），不要输出任何文字说明、注释、编号或格式化文本。\n- 每条证据为简短事实或引语片段（不超过200字），不要包含模型的推理过程、链式思考、内部注释或类似“思考”内容。\n- 不要伪造真实出版物标题、URL 或外部来源名称；若基于推断，请在 text 末尾简单添加标记 【未经证实】，但仍保持简短。\n- 如果没有可提供的可信或合理证据，请返回空数组：[]（不要返回解释性文本或占位符）。`;
        const user = `角色说明：${constitution.instructions}\n问题：${query}\n请仅返回标准 JSON 数组，遵守上述规则（不允许任何额外说明文字）。`;

        const resp = await axios.post(
            `${API_URL}/chat/completions`,
            {
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user }
                ],
                temperature: 0.3,
                max_tokens: 800
            },
            { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` } }
        )

        const text = resp.data?.choices?.[0]?.message?.content || resp.data?.output || JSON.stringify(resp.data)
        // try parse JSON (expect strict array). If not parseable, fallbacks below.
        try {
            const parsed = JSON.parse(String(text))
            if (Array.isArray(parsed)) {
                // sanitize entries: ensure text is concise and not a chain-of-thought
                const mapped = parsed.map((p: any, i: number) => ({ id: String(p.id || `ai-${Date.now()}-${i}`), text: String(p.text || '') }))
                const filtered = mapped.filter(it => {
                    const t = it.text.trim()
                    if (!t) return false
                    // drop if looks like internal reasoning or too long
                    if (t.length > 400) return false
                    const lower = t.toLowerCase()
                    if (lower.includes('思考') || lower.includes('我认为') || lower.includes('可能') || lower.includes('推测')) return false
                    return true
                })
                return filtered.slice(0, limit)
            }
        } catch (e) {
            // fallback: try to extract lines of the form {"id":...,"text":"..."}
        }

        // fallback parse: look for lines starting with { and parse
        const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
        const out: Array<{ id: string; text: string }> = []
        for (const l of lines) {
            if (l.startsWith('{') && l.endsWith('}')) {
                try { const p = JSON.parse(l); out.push({ id: String(p.id || `ai-${Date.now()}`), text: String(p.text || '') }) } catch (_) { }
            }
            if (out.length >= limit) break
        }

        // final fallback: split by numbered lines, but filter out likely reasoning
        if (out.length === 0) {
            const items = String(text).split(/\n\d+\.|\n- /).map(s => s.trim()).filter(Boolean).slice(0, limit)
            items.forEach((it, i) => {
                const t = it.replace(/\s+/g, ' ').trim()
                if (t && t.length <= 400 && !/思考|我认为|推测|可能/.test(t)) out.push({ id: `ai-${Date.now()}-${i}`, text: t })
            })
        }

        return out.slice(0, limit)
    }
}
