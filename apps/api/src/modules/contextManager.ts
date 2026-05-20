import DB, { StoredTurn } from '../db'
import Retrieval from './retrieval'

type Turn = { user: string; assistant: string }

type MemoryPack = {
    summary: string
    recent: Array<{ user: string; assistant: string }>
}

export default {
    async appendTurn(userId: string, role: string, turn: Turn) {
        const uid = userId || 'anon'
        await DB.appendTurn(uid, role, turn)
    },

    async buildMemoryPack(userId: string, role: string, query?: string): Promise<MemoryPack> {
        const uid = userId || 'anon'
        const allTurns = DB.getAllTurns(uid, role)
        const summary = this._summarize(allTurns)
        const recent = query ? Retrieval.rankHistoryTurns(allTurns, query, 6) : DB.getRecentTurns(uid, role, 6).map(t => ({ user: t.user, assistant: t.assistant }))
        return {
            summary,
            recent
        }
    },

    getDialogue(userId: string, role: string, limit?: number) {
        const uid = userId || 'anon'
        const turns = DB.getAllTurns(uid, role).map(t => ({ user: t.user, assistant: t.assistant }))
        if (typeof limit === 'number') return turns.slice(-limit)
        return turns
    },

    deleteDialogue(userId: string, role?: string) {
        const uid = userId || 'anon'
        return DB.deleteDialogue(uid, role)
    },

    _summarize(turns: Array<StoredTurn>) {
        if (turns.length === 0) return ''
        const topics = new Set<string>()
        turns.slice(-20).forEach(t => {
            const words = t.user.split(/\s+|，|。|？|！|、/).slice(0, 5)
            words.forEach(w => { if (w.length > 1) topics.add(w) })
        })
        return `对话摘要：${Array.from(topics).slice(0, 8).join('、')}`
    }
}
