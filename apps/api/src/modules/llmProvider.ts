import axios from 'axios'
import { Constitution } from './constitution'

type MemoryPack = { summary: string; recent: Array<{ user: string; assistant: string }> }

export default {
    async generateReply({ constitution, memoryPack, input, evidence }:
        { constitution: Constitution; memoryPack: MemoryPack; input: string; evidence: Array<{ id: string; text: string }> }) {

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
            parts.push('参考材料：')
            evidence.forEach(ev => parts.push(`- ${ev.text}`))
        }

        const systemPrompt = parts.join('\n') + '\n请以该角色风格、认知限制和史料为依据回答，必要时说明不确定性。'

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

            const message = resp.data?.choices?.[0]?.message?.content || resp.data?.output || JSON.stringify(resp.data)
            return message
        } catch (err: any) {
            console.error('DeepSeek call failed:', err.response?.data || err.message)
            throw err
        }
    }
}
