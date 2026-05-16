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
        const { role, input, mode } = req.body as { role: string; input: string; mode?: string }

        const constitution = ConstitutionService.getConstitution(role)
        const memoryPack = ContextManager.buildMemoryPack(role)

        // simple heuristic to decide when to inject knowledge
        const evidence = KnowledgeService.search(role, input, 3)

        let reply: string
        if (process.env.DEEPSEEK_API_KEY) {
            try {
                reply = await LLMProvider.generateReply({ constitution, memoryPack, input, evidence })
            } catch (e) {
                console.error('DeepSeek call failed, falling back to mock:', e)
                reply = await LLM.generateReply({ constitution, memoryPack, input, evidence })
            }
        } else {
            reply = await LLM.generateReply({ constitution, memoryPack, input, evidence })
        }

        // update memory store
        ContextManager.appendTurn(role, { user: input, assistant: reply })

        // optional analysis for end-of-session or on demand
        let analysis = null
        if (mode === 'analyze') {
            const dialogue = ContextManager.getDialogue(role)
            analysis = AnalysisService.analyze(dialogue)
        }

        res.json({ reply, evidence, analysis })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'internal_error' })
    }
})

export default router
