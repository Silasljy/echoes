import { Constitution } from './constitution'

type MemoryPack = { summary: string; recent: Array<{ user: string; assistant: string }> }

export default {
    async generateReply({ constitution, memoryPack, input, evidence, requireCitation }:
        { constitution: Constitution; memoryPack: MemoryPack; input: string; evidence: Array<{ id: string; text: string }>; requireCitation?: boolean }) {
        // Improved deterministic simulator for local development.
        // Generate a reply that varies with `input` and recent turns so local debugging doesn't produce identical outputs.
        const parts: string[] = []
        if (memoryPack.summary) parts.push(`记忆摘要：${memoryPack.summary}`)
        if (memoryPack.recent.length) {
            parts.push('最近对话节选：')
            memoryPack.recent.forEach((t, i) => parts.push(`${i + 1}. 用户：${t.user} → 回答：${t.assistant}`))
        }

        // small hash to pick a template deterministically based on input+recent
        function hashStr(s: string) {
            let h = 5381
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i)
            return Math.abs(h)
        }

        const shortAnswer = '行己安人，以礼为先，仁为本。'
        const lastAssistant = memoryPack.recent.length ? (memoryPack.recent[memoryPack.recent.length - 1].assistant || '') : ''
        const snippet = String(input || '').slice(0, 36)
        const templates = [
            `${constitution.name}（模拟回应）：\n${shortAnswer}`,
            `${constitution.name}回道：\n关于“${snippet}”我以为${shortAnswer}`,
            `${constitution.name}曰：${shortAnswer}（承接前言：${lastAssistant.slice(0, 40) || snippet}）`
        ]

        const idx = hashStr((input || '') + JSON.stringify(memoryPack.recent || [])) % templates.length
        const response = templates[idx]

        if (requireCitation) return response + '\n引用证据IDs: 无'
        return response
    },

    async generateReverseQuestion({ constitution, topic, input, memoryPack, stage }:
        { constitution: Constitution; topic: string; input: string; memoryPack: MemoryPack; stage?: string }) {
        const parts: string[] = []
        if (memoryPack.summary) parts.push(`记忆摘要：${memoryPack.summary}`)
        if (memoryPack.recent.length) {
            parts.push('最近反向问答：')
            memoryPack.recent.forEach((t, i) => parts.push(`${i + 1}. 用户回答：${t.user} → 人物追问：${t.assistant}`))
        }

        function hashStr(s: string) {
            let h = 5381
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i)
            return Math.abs(h)
        }

        const topicSnippet = String(topic || '这个话题').slice(0, 18)
        const inputSnippet = String(input || '请继续').slice(0, 24)
        const templates = [
            `你怎么看“${topicSnippet}”中的关键一义？`,
            `若从“${inputSnippet}”继续，你会如何回应？`,
            `关于“${topicSnippet}”，我想追问你一句：你更重视哪一点？`
        ]
        const idx = hashStr((topic || '') + (input || '') + JSON.stringify(memoryPack.recent || [])) % templates.length
        const question = `${constitution.name}问：${templates[idx]}`

        return {
            question,
            meta: { focus: topicSnippet }
        }
    }
}
