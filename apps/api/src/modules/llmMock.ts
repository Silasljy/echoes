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
    }
}
