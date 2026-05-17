import { Router } from 'express'
import ConstitutionService from '../modules/constitution'

const router = Router()

router.get('/', (req: any, res: any) => {
    try {
        const roles = ConstitutionService.listRoles()
        // roles is array of {id,name,description,examples}
        res.json({ roles })
    } catch (err) {
        console.error('failed to list roles', err)
        res.status(500).json({ error: 'internal_error' })
    }
})

export default router
