import fs from 'fs'
import path from 'path'

const DB_FILE = process.env.ECHOES_DB_PATH || path.resolve(__dirname, '..', '..', 'echoes.db.json')

type StoredTurn = { id: string; user_id: string; role: string; turn_index: number; user: string; assistant: string; created_at: number }

function loadData(): { dialogue_turns: StoredTurn[] } {
    try {
        if (!fs.existsSync(DB_FILE)) return { dialogue_turns: [] }
        const raw = fs.readFileSync(DB_FILE, 'utf8')
        return JSON.parse(raw)
    } catch (e) {
        return { dialogue_turns: [] }
    }
}

function saveData(data: { dialogue_turns: StoredTurn[] }) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8')
    } catch (e) {
        console.warn('saveData failed', e)
    }
}

export default {
    getNextTurnIndex(userId: string, role: string) {
        const data = loadData()
        const rows = data.dialogue_turns.filter(t => t.user_id === userId && t.role === role)
        const max = rows.reduce((m, r) => Math.max(m, r.turn_index), 0)
        return max + 1
    },

    appendTurn(userId: string, role: string, turn: { user: string; assistant: string }) {
        const data = loadData()
        const turnIndex = this.getNextTurnIndex(userId, role)
        const id = `${userId}:${role}:${Date.now()}:${Math.random().toString(16).slice(2)}`
        const rec: StoredTurn = { id, user_id: userId, role, turn_index: turnIndex, user: turn.user, assistant: turn.assistant, created_at: Date.now() }
        data.dialogue_turns.push(rec)
        // cap to last 5000 entries globally to avoid unbounded growth
        if (data.dialogue_turns.length > 5000) data.dialogue_turns = data.dialogue_turns.slice(-5000)
        saveData(data)
    },

    getRecentTurns(userId: string, role: string, limit: number) {
        const data = loadData()
        const rows = data.dialogue_turns
            .filter(t => t.user_id === userId && t.role === role)
            .sort((a, b) => b.turn_index - a.turn_index)
            .slice(0, limit)
        return rows.map(r => ({ user: r.user, assistant: r.assistant, created_at: r.created_at }))
    },

    getAllTurns(userId: string, role: string) {
        const data = loadData()
        const rows = data.dialogue_turns
            .filter(t => t.user_id === userId && t.role === role)
            .sort((a, b) => a.turn_index - b.turn_index)
        return rows.map(r => ({ user: r.user, assistant: r.assistant, created_at: r.created_at }))
    },

    deleteDialogue(userId: string, role?: string) {
        const data = loadData()
        const before = data.dialogue_turns.length
        if (role) {
            data.dialogue_turns = data.dialogue_turns.filter(t => !(t.user_id === userId && t.role === role))
        } else {
            data.dialogue_turns = data.dialogue_turns.filter(t => t.user_id !== userId)
        }
        saveData(data)
        return data.dialogue_turns.length < before
    }
}
