import { Router } from 'express'
import ConstitutionService from '../modules/constitution'
import ContextManager from '../modules/contextManager'
import KnowledgeService from '../modules/knowledgeService'
import LLM from '../modules/llmMock'
import LLMProvider from '../modules/llmProvider'
import AnalysisService from '../modules/analysisService'

const router = Router()

router.post('/', async (req, res) => {
    try {
        const { role, input, mode, userId } = req.body as { role: string; input: string; mode?: string; userId?: string }

        const uid = userId || 'anon'
        const constitution = ConstitutionService.getConstitution(role)
        const memoryPack = ContextManager.buildMemoryPack(uid, role)

        // simple heuristic to decide when to inject local knowledge for context
        const localEvidence = KnowledgeService.search(role, input, 3)

        let reply: string
        if (process.env.DEEPSEEK_API_KEY) {
            try {
                // pass local evidence for context but do not require strict citation in reply
                reply = await LLMProvider.generateReply({ constitution, memoryPack, input, evidence: localEvidence, requireCitation: false })
            } catch (e) {
                console.error('DeepSeek call failed, falling back to mock:', e)
                reply = await LLM.generateReply({ constitution, memoryPack, input, evidence: localEvidence, requireCitation: false })
            }
        } else {
            reply = await LLM.generateReply({ constitution, memoryPack, input, evidence: localEvidence, requireCitation: false })
        }

        // After obtaining the answer, generate AI-produced references for display
        let aiEvidence = [] as Array<{ id: string; text: string }>
        try {
            aiEvidence = await KnowledgeService.generateEvidence(role, input, 3)
        } catch (e) {
            aiEvidence = []
        }

        // update memory store (per user)
        ContextManager.appendTurn(uid, role, { user: input, assistant: reply })

        // optional analysis for end-of-session or on demand
        let analysis = null
        if (mode === 'analyze') {
            const dialogue = ContextManager.getDialogue(uid, role)
            analysis = AnalysisService.analyze(dialogue)
        }

        res.json({ reply, evidence: aiEvidence, analysis })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'internal_error' })
    }
})

export default router
