import { Router } from 'express'
import ContextManager from '../modules/contextManager'

const router = Router()

// POST /session/end  { userId: 'user-123' }
router.post('/end', (req, res) => {
    try {
        const userId = String(req.body?.userId || '')
        if (!userId) return res.status(400).json({ error: 'userId_required' })

        const ok = ContextManager.deleteDialogue(userId)
        if (!ok) return res.status(404).json({ error: 'not_found' })
        res.json({ ended: true, userId })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'internal_error' })
    }
})

export default router
