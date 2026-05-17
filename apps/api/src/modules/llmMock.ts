import { Constitution } from './constitution'

type MemoryPack = { summary: string; recent: Array<{ user: string; assistant: string }> }

export default {
    async generateReply({ constitution, memoryPack, input, evidence, requireCitation }:
        { constitution: Constitution; memoryPack: MemoryPack; input: string; evidence: Array<{ id: string; text: string }>; requireCitation?: boolean }) {
        // Deterministic simulator of LLM behavior for development.
        const internalParts: string[] = []
        internalParts.push(`角色说明：${constitution.instructions}`)
        if (memoryPack.summary) internalParts.push(`记忆摘要：${memoryPack.summary}`)
        if (memoryPack.recent.length) {
            internalParts.push('最近对话节选：')
            memoryPack.recent.forEach((t, i) => internalParts.push(`${i + 1}. 用户：${t.user} → 回答：${t.assistant}`))
        }
        if (evidence && evidence.length) {
            internalParts.push('参考史料：')
            evidence.forEach(ev => internalParts.push(`- ${ev.text}`))
        }

        const internalPrompt = internalParts.join('\n')

        // simple heuristic for anachronistic questions
        const anachronism = /现代|科技|未来|20\d{2}|21世纪/.test(input)
        if (anachronism) {
            return `${constitution.name}：关于现代或未来的细节我并不知晓；我更愿讨论伦理与为人之道。`
        }

        // Simulated concise assistant response (do NOT echo internal prompt)
        const shortAnswer = '行己安人，以礼为先，仁为本。'
        const response = `${constitution.name}（模拟回应）：\n${shortAnswer}`

        // console.debug('Internal prompt for LLM simulation:\n', internalPrompt)
        if (requireCitation) return response + '\n引用证据IDs: 无'
        return response
    }
}
