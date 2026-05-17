type Turn = { user: string; assistant: string }

// store per userId -> role -> turns
const store: Record<string, Record<string, Turn[]>> = {}

export default {
    appendTurn(userId: string, role: string, turn: Turn) {
        const uid = userId || 'anon'
        if (!store[uid]) store[uid] = {}
        if (!store[uid][role]) store[uid][role] = []
        store[uid][role].push(turn)
        // cap memory to last 50 turns per user-role
        while (store[uid][role].length > 50) store[uid][role].shift()
    },
    buildMemoryPack(userId: string, role: string) {
        const uid = userId || 'anon'
        const turns = (store[uid] && store[uid][role]) ? store[uid][role] : []
        const recent = turns.slice(-6)
        const summary = this._summarize(turns)
        return { summary, recent }
    },
    getDialogue(userId: string, role: string, limit?: number) {
        const uid = userId || 'anon'
        const turns = (store[uid] && store[uid][role]) ? store[uid][role] : []
        if (typeof limit === 'number') return turns.slice(-limit)
        return turns
    },
    deleteDialogue(userId: string, role?: string) {
        const uid = userId || 'anon'
        if (!store[uid]) return false
        if (role) {
            if (!store[uid][role]) return false
            delete store[uid][role]
            return true
        }
        // delete all roles for this user
        delete store[uid]
        return true
    },
    _summarize(turns: Turn[]) {
        if (turns.length === 0) return ''
        // naive summarization: take topics from recent user messages
        const topics = new Set<string>()
        turns.slice(-20).forEach(t => {
            // very simple keyword extraction
            const words = t.user.split(/\s+|，|。|？|！|、/).slice(0, 5)
            words.forEach(w => { if (w.length > 1) topics.add(w) })
        })
        return `对话摘要：${Array.from(topics).slice(0, 8).join('、')}`
    }
}
