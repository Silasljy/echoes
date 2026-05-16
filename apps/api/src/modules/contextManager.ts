type Turn = { user: string; assistant: string }

const store: Record<string, Turn[]> = {}

export default {
    appendTurn(role: string, turn: Turn) {
        if (!store[role]) store[role] = []
        store[role].push(turn)
        // cap memory to last 50 turns
        if (store[role].length > 50) store[role].shift()
    },
    buildMemoryPack(role: string) {
        const turns = store[role] || []
        const recent = turns.slice(-6)
        const summary = this._summarize(turns)
        return { summary, recent }
    },
    getDialogue(role: string) {
        return store[role] || []
    },
    _summarize(turns: Turn[]) {
        if (turns.length === 0) return ''
        // naive summarization: take first and last exchanges and list topics
        const topics = new Set<string>()
        turns.slice(-20).forEach(t => {
            // very simple keyword extraction
            const words = t.user.split(/\s+|，|。|？|！|、/).slice(0, 5)
            words.forEach(w => { if (w.length > 1) topics.add(w) })
        })
        return `对话摘要：${Array.from(topics).slice(0, 8).join('、')}`
    }
}
