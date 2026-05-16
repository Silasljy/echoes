import { Constitution } from './constitution'

type MemoryPack = { summary: string; recent: Array<{ user: string; assistant: string }> }

export default {
    async generateReply({ constitution, memoryPack, input, evidence }:
        { constitution: Constitution; memoryPack: MemoryPack; input: string; evidence: Array<{ id: string; text: string }> }) {
        // This is a deterministic simulator of LLM behavior for development.
        // It combines constitution instructions, short memory, and injected evidence.
        // Build an internal prompt (kept internal) to simulate model input
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

        // (internalPrompt is kept for logging/debugging but not returned to user)
        // console.debug('Internal prompt for LLM simulation:\n', internalPrompt)
        return response
    }
}
