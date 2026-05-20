import { Router } from 'express'
import ContextManager from '../modules/contextManager'
import { sessionEndSchema } from '../validators'
import { ApiError } from '../errors'

const router = Router()

// POST /session/end  { userId: 'user-123' }
router.post('/end', async (req, res, next) => {
    try {
        const parseResult = sessionEndSchema.safeParse(req.body)
        if (!parseResult.success) {
            const message = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
            throw new ApiError(message, 400)
        }

        const { userId } = parseResult.data
        const ok = await ContextManager.deleteDialogue(userId)
        if (!ok) {
            throw new ApiError('not_found', 404)
        }
        res.json({ ended: true, userId })
    } catch (err) {
        next(err)
    }
})

export default router
