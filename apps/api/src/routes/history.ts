import { Router } from 'express'
import ContextManager from '../modules/contextManager'

const router = Router()

// GET /history?role=孔子&userId=123&limit=50
router.get('/', (req, res) => {
    try {
        const role = String(req.query.role || '')
        const userId = String(req.query.userId || 'anon')
        const limitQ = req.query.limit ? parseInt(String(req.query.limit), 10) : 50
        const limit = Number.isNaN(limitQ) ? 50 : Math.min(50, Math.max(1, limitQ))

        if (!role) return res.status(400).json({ error: 'role_required' })

        const dialogue = ContextManager.getDialogue(userId, role, limit)
        res.json({ role, userId, count: dialogue.length, dialogue })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'internal_error' })
    }
})

// DELETE /history?userId=123&role=孔子
// if role omitted, deletes all roles for the user
router.delete('/', (req, res) => {
    try {
        const userId = String(req.query.userId || '')
        const role = req.query.role ? String(req.query.role) : undefined

        if (!userId) return res.status(400).json({ error: 'userId_required' })

        const ok = ContextManager.deleteDialogue(userId, role)
        if (!ok) return res.status(404).json({ error: 'not_found' })
        res.json({ deleted: true, userId, role: role || 'all' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'internal_error' })
    }
})

export default router

