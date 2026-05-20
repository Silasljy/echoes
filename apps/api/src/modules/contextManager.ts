import DB from '../db'
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
        const recentTurns = await DB.getRecentTurns(uid, role, 50)
        const summary = this._summarize(recentTurns)
        const recent = query ? Retrieval.rankHistoryTurns(recentTurns, query, 6) : recentTurns.slice(0, 6)
        return {
            summary,
            recent
        }
    },

    async getDialogue(userId: string, role: string, limit?: number) {
        const uid = userId || 'anon'
        if (typeof limit === 'number') {
            return DB.getDialoguePage(uid, role, 1, limit)
        }
        return DB.getDialoguePage(uid, role, 1, 200)
    },

    async getDialoguePage(userId: string, role: string, page = 1, pageSize = 50) {
        const uid = userId || 'anon'
        return DB.getDialoguePage(uid, role, page, pageSize)
    },

    async getDialogueCount(userId: string, role?: string) {
        const uid = userId || 'anon'
        return DB.getDialogueCount(uid, role)
    },

    async deleteDialogue(userId: string, role?: string) {
        const uid = userId || 'anon'
        return DB.deleteDialogue(uid, role)
    },

    _summarize(turns: Array<Turn>) {
        if (turns.length === 0) return ''
        const topics = new Set<string>()
        turns.slice(-20).forEach(t => {
            const words = t.user.split(/\s+|，|。|？|！|、/).slice(0, 5)
            words.forEach(w => { if (w.length > 1) topics.add(w) })
        })
        return `对话摘要：${Array.from(topics).slice(0, 8).join('、')}`
    }
}
