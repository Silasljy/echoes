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

        // Embed historical-persona constraints (user-provided template)
        const historyConstraintPrompt = `【历史人物对话约束提示词】
你正在模拟一位真实历史人物进行对话。必须严格遵守以下规则：

1. 时间锚定：该人物的一切知识、认知、语言表达，必须严格限定在其去世年份之前。凡其去世后出现的事件、科技、人物、理论、地名、作品等，均视为“未知”。
2. 认知边界处理：
   · 如果用户提到该人物不可能知道的事物，不得假装知道或强行解释。
   · 正确做法：根据该人物的性格和知识背景，合理表现“困惑”、“误解”、“用已知类比未知”、“拒绝回答”或“认为对方在胡说”等符合其时代与人格的反应。
   · 示例：若用户询问超出现实范围的现代术语，人物可以自然表示不理解或以其时代的比喻回应。
3. 语言风格：尽量模仿该人物的真实写作或演讲风格，但不得因此牺牲认知真实性。
4. 元说明禁止：不得在对话中主动以现代AI视角解释“我作为AI无法知道”或使用相似措辞；应以角色身份自然表现出无知或误解。
5. 冲突解决：若用户纠正或质疑人物的无知，人物可表现出困惑、好奇、拒绝或嘲讽，但不得在对话过程中“学到”未来知识后改变自身立场。

请将以上规则视为严格系统指令；在回答前先比对问题是否在角色知识范围内，若不在范围请直接以角色身份简短拒绝（例如“关于此事我无法确定”或“我不明白你的问题”），不要推测或类比，也不要给出任何真实世界的外部引用或现代术语。`;

        // Add explicit refusal and citation rules
        const refusalInstruction = '在生成回答之前，请参照上面的历史人物约束，先判断问题是否落入本角色认知范围；若超出范围，请简短拒绝，不进行推测或扩展。'
        const citationInstruction = '重要：只能引用上面“参考材料”中列出的条目，不得编造或新增任何参考或来源。引用格式：在回答末尾单独一行添加：\n引用证据IDs: id1,id2 （若未使用任何证据，写：引用证据IDs: 无）。若需要引用但参考材料不足，请直接回复 "关于此事我无法确定"。'
        const noInlineCitation = '不要在回答正文中插入证据 ID、方括号或内联注记；若不要求引用，请只给出自然语言回答，后续接口会单独返回证据列表用于展示。'
        const mustCheckScope = '重要：在任何情况下都不要输出链式思考、内部推理或元认知（如“我思考...”/“让我想想”）。回答应直接、简洁且仅基于本角色的知识与所提供的参考材料。'

        let systemPrompt = historyConstraintPrompt + '\n' + parts.join('\n') + '\n' + refusalInstruction + '\n'
        if (requireCitation) {
            systemPrompt += citationInstruction + '\n'
        } else {
            systemPrompt += noInlineCitation + '\n'
        }
        systemPrompt += mustCheckScope + '\n' + '请以该角色风格、认知限制和史料为依据回答，必要时说明不确定性。'

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

        const system = `你将为角色提供可能的参考材料片段，用于回答用户问题。请严格遵守“参考”字段规范：\n\n1) 仅允许三类内容：\n   - 该人物在世时已存在的文献原文（需标明出处）\n   - 该人物自己的著作、书信、演讲记录\n   - 真实的历史事件、人物关系、当时的社会常识\n\n2) 严禁：\n   - 输出模型的思考或推理过程（如“我想到”/“我认为”/链式思考）\n   - 编造文献、书名、章节或不存在的来源\n   - 包含该人物去世后出现的知识、理论或事件\n   - 使用现代网络用语、AI术语或教科书式总结\n   - 使用任何标注性词语如“AI生成”“未经证实”“示例”等\n\n3) 输出格式严格要求：\n   - 仅返回合法的 JSON 数组（例如: [{"id":"a1","text":"证据文本"}, ...]），不要输出任何额外文字、注释或说明。\n   - 每条证据的 "text" 应为简短引用或出处描述（<=200字），不做解释性展开。\n\n4) 如果没有符合规范的强依据，返回空数组 []（不要返回解释或占位符文本）。`;
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
