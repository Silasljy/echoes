import DB from '../db'
import Retrieval from './retrieval'

type Turn = { user: string; assistant: string }

type MemoryPack = {
    summary: string
    recent: Array<{ user: string; assistant: string }>
}

const LOG_PREFIX = '[ContextManager]'

export default {
    async appendTurn(userId: string, role: string, turn: Turn) {
        const uid = userId || 'anon'
        try {
            await DB.appendTurn(uid, role, turn)
        } catch (error) {
            console.error(`${LOG_PREFIX} appendTurn failed`, { uid, role, turn }, error)
        }
    },

    async buildMemoryPack(userId: string, role: string, query?: string): Promise<MemoryPack> {
        const uid = userId || 'anon'
        try {
            const recentTurns = await DB.getRecentTurns(uid, role, 50)
            const summary = this._summarize(recentTurns)
            const recent = query ? Retrieval.rankHistoryTurns(recentTurns, query, 6) : recentTurns.slice(0, 6)
            return {
                summary,
                recent
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} buildMemoryPack failed`, { uid, role, query }, error)
            return { summary: '', recent: [] }
        }
    },

    async getDialogue(userId: string, role: string, limit?: number) {
        const uid = userId || 'anon'
        try {
            if (typeof limit === 'number') {
                return await DB.getDialoguePage(uid, role, 1, limit)
            }
            return await DB.getDialoguePage(uid, role, 1, 200)
        } catch (error) {
            console.error(`${LOG_PREFIX} getDialogue failed`, { uid, role, limit }, error)
            throw error
        }
    },

    async getDialoguePage(userId: string, role: string, page = 1, pageSize = 50) {
        const uid = userId || 'anon'
        try {
            return await DB.getDialoguePage(uid, role, page, pageSize)
        } catch (error) {
            console.error(`${LOG_PREFIX} getDialoguePage failed`, { uid, role, page, pageSize }, error)
            throw error
        }
    },

    async getDialogueCount(userId: string, role?: string) {
        const uid = userId || 'anon'
        try {
            return await DB.getDialogueCount(uid, role)
        } catch (error) {
            console.error(`${LOG_PREFIX} getDialogueCount failed`, { uid, role }, error)
            throw error
        }
    },

    async deleteDialogue(userId: string, role?: string) {
        const uid = userId || 'anon'
        try {
            return await DB.deleteDialogue(uid, role)
        } catch (error) {
            console.error(`${LOG_PREFIX} deleteDialogue failed`, { uid, role }, error)
            throw error
        }
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
