import { Router } from 'express'
import ContextManager from '../modules/contextManager'
import { historyGetSchema, historyDeleteSchema } from '../validators'
import { ApiError } from '../errors'

const router = Router()

// GET /history?role=孔子&userId=123&limit=50
router.get('/', (req, res, next) => {
    try {
        const parseResult = historyGetSchema.safeParse(req.query)
        if (!parseResult.success) {
            const message = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
            throw new ApiError(message, 400)
        }

        const { role, userId, limit } = parseResult.data
        const dialogue = ContextManager.getDialogue(userId, role, limit)
        res.json({ role, userId, count: dialogue.length, dialogue })
    } catch (err) {
        next(err)
    }
})

// DELETE /history?userId=123&role=孔子
// if role omitted, deletes all roles for the user
router.delete('/', (req, res, next) => {
    try {
        const parseResult = historyDeleteSchema.safeParse(req.query)
        if (!parseResult.success) {
            const message = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
            throw new ApiError(message, 400)
        }

        const { userId, role } = parseResult.data
        const ok = ContextManager.deleteDialogue(userId, role)
        if (!ok) {
            throw new ApiError('not_found', 404)
        }

        res.json({ deleted: true, userId, role: role || 'all' })
    } catch (err) {
        next(err)
    }
})

export default router

