import fs from 'fs'
import path from 'path'
import { Mutex } from 'async-mutex'

const DB_FILE = process.env.ECHOES_DB_PATH || path.resolve(__dirname, '..', '..', 'echoes.db.json')
const DB_MAX_ENTRIES = Number(process.env.ECHOES_DB_MAX_ENTRIES || '1000') || 1000
const DB_LOG_PREFIX = '[DB]'

const mutex = new Mutex()

type StoredTurn = { id: string; user_id: string; role: string; turn_index: number; user: string; assistant: string; created_at: number }

function normalizePage(value: number | undefined, defaultValue = 1, maxValue = 1000) {
    if (typeof value !== 'number' || Number.isNaN(value)) return defaultValue
    return Math.min(Math.max(1, value), maxValue)
}

function normalizePageSize(value: number | undefined, defaultValue = 50, maxValue = 200) {
    if (typeof value !== 'number' || Number.isNaN(value)) return defaultValue
    return Math.min(Math.max(1, value), maxValue)
}

async function loadData(): Promise<{ dialogue_turns: StoredTurn[] }> {
    try {
        await fs.promises.access(DB_FILE, fs.constants.F_OK)
    } catch {
        return { dialogue_turns: [] }
    }

    try {
        const raw = await fs.promises.readFile(DB_FILE, 'utf8')
        if (!raw.trim()) {
            return { dialogue_turns: [] }
        }
        const parsed = JSON.parse(raw)
        if (!parsed || !Array.isArray(parsed.dialogue_turns)) {
            throw new Error('invalid dialogue database format')
        }
        return parsed
    } catch (error) {
        console.error(`[DB] loadData failed for ${DB_FILE}:`, error)
        throw new Error('Failed to load dialogue database')
    }
}

async function saveData(data: { dialogue_turns: StoredTurn[] }) {
    try {
        await fs.promises.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8')
    } catch (error) {
        console.error(`[DB] saveData failed for ${DB_FILE}:`, error)
        throw new Error('Failed to persist dialogue database')
    }
}

function filterTurns(data: { dialogue_turns: StoredTurn[] }, userId: string, role: string) {
    return data.dialogue_turns.filter(t => t.user_id === userId && t.role === role)
}

function orderTurns(turns: StoredTurn[]) {
    return turns.slice().sort((a, b) => a.turn_index - b.turn_index)
}

export default {
    async appendTurn(userId: string, role: string, turn: { user: string; assistant: string }) {
        try {
            return await mutex.runExclusive(async () => {
                const data = await loadData()
                const rows = filterTurns(data, userId, role)
                const turnIndex = rows.reduce((m, r) => Math.max(m, r.turn_index), 0) + 1
                const id = `${userId}:${role}:${Date.now()}:${Math.random().toString(16).slice(2)}`
                const rec: StoredTurn = { id, user_id: userId, role, turn_index: turnIndex, user: turn.user, assistant: turn.assistant, created_at: Date.now() }
                data.dialogue_turns.push(rec)
                if (data.dialogue_turns.length > DB_MAX_ENTRIES) {
                    data.dialogue_turns = data.dialogue_turns.slice(-DB_MAX_ENTRIES)
                }
                await saveData(data)
            })
        } catch (error) {
            console.error(`${DB_LOG_PREFIX} appendTurn failed`, { userId, role }, error)
            throw new Error('Failed to append dialogue turn')
        }
    },

    async getRecentTurns(userId: string, role: string, limit: number) {
        try {
            return await mutex.runExclusive(async () => {
                const data = await loadData()
                const rows = orderTurns(filterTurns(data, userId, role)).reverse().slice(0, limit)
                return rows.map(r => ({ user: r.user, assistant: r.assistant, created_at: r.created_at }))
            })
        } catch (error) {
            console.error(`${DB_LOG_PREFIX} getRecentTurns failed`, { userId, role, limit }, error)
            throw new Error('Failed to read recent dialogue turns')
        }
    },

    async getDialoguePage(userId: string, role: string, page = 1, pageSize = 50) {
        try {
            return await mutex.runExclusive(async () => {
                const data = await loadData()
                const rows = orderTurns(filterTurns(data, userId, role))
                const normalizedPage = normalizePage(page)
                const normalizedPageSize = normalizePageSize(pageSize)
                const offset = (normalizedPage - 1) * normalizedPageSize
                return rows.slice(offset, offset + normalizedPageSize).map(r => ({ user: r.user, assistant: r.assistant, created_at: r.created_at }))
            })
        } catch (error) {
            console.error(`${DB_LOG_PREFIX} getDialoguePage failed`, { userId, role, page, pageSize }, error)
            throw new Error('Failed to read dialogue page')
        }
    },

    async getAllTurns(userId: string, role: string, limit?: number) {
        try {
            return await mutex.runExclusive(async () => {
                const data = await loadData()
                const rows = orderTurns(filterTurns(data, userId, role))
                const sliced = typeof limit === 'number' ? rows.slice(-limit) : rows
                return sliced.map(r => ({ user: r.user, assistant: r.assistant, created_at: r.created_at }))
            })
        } catch (error) {
            console.error(`${DB_LOG_PREFIX} getAllTurns failed`, { userId, role, limit }, error)
            throw new Error('Failed to read dialogue turns')
        }
    },

    async getDialogueCount(userId: string, role?: string) {
        try {
            return await mutex.runExclusive(async () => {
                const data = await loadData()
                return data.dialogue_turns.filter(t => t.user_id === userId && (role ? t.role === role : true)).length
            })
        } catch (error) {
            console.error(`${DB_LOG_PREFIX} getDialogueCount failed`, { userId, role }, error)
            throw new Error('Failed to count dialogue turns')
        }
    },

    async deleteDialogue(userId: string, role?: string) {
        try {
            return await mutex.runExclusive(async () => {
                const data = await loadData()
                const before = data.dialogue_turns.length
                if (role) {
                    data.dialogue_turns = data.dialogue_turns.filter(t => !(t.user_id === userId && t.role === role))
                } else {
                    data.dialogue_turns = data.dialogue_turns.filter(t => t.user_id !== userId)
                }
                await saveData(data)
                return data.dialogue_turns.length < before
            })
        } catch (error) {
            console.error(`${DB_LOG_PREFIX} deleteDialogue failed`, { userId, role }, error)
            throw new Error('Failed to delete dialogue turns')
        }
    }
}
