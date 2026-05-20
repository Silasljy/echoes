import { Router } from 'express'
import ContextManager from '../modules/contextManager'
import { historyGetSchema, historyDeleteSchema } from '../validators'
import { ApiError } from '../errors'

const router = Router()

// GET /history?role=孔子&userId=123&page=1&pageSize=50
router.get('/', async (req, res, next) => {
    try {
        const parseResult = historyGetSchema.safeParse(req.query)
        if (!parseResult.success) {
            const message = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
            throw new ApiError(message, 400)
        }

        const data = parseResult.data
        const role = String(data.role)
        const userId = String(data.userId || 'anon')
        const page = Number(data.page || 1)
        const pageSize = Number(data.pageSize || 50)
        const effectivePageSize = typeof data.limit === 'number' ? data.limit : pageSize
        const dialogue = await ContextManager.getDialoguePage(userId, role, page, effectivePageSize)
        const totalCount = await ContextManager.getDialogueCount(userId, role)

        res.json({ role, userId, page, pageSize: effectivePageSize, totalCount, count: dialogue.length, dialogue })
    } catch (err) {
        next(err)
    }
})

// DELETE /history?userId=123&role=孔子
// if role omitted, deletes all roles for the user
router.delete('/', async (req, res, next) => {
    try {
        const parseResult = historyDeleteSchema.safeParse(req.query)
        if (!parseResult.success) {
            const message = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
            throw new ApiError(message, 400)
        }

        const { userId, role } = parseResult.data
        const ok = await ContextManager.deleteDialogue(userId, role)
        if (!ok) {
            throw new ApiError('not_found', 404)
        }

        res.json({ deleted: true, userId, role: role || 'all' })
    } catch (err) {
        next(err)
    }
})

export default router

