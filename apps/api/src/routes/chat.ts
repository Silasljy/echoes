import { Router } from 'express'
import ConstitutionService from '../modules/constitution'
import ContextManager from '../modules/contextManager'
import KnowledgeService from '../modules/knowledgeService'
import LLM from '../modules/llmMock'
import LLMProvider from '../modules/llmProvider'
import AnalysisService from '../modules/analysisService'
import { chatRequestSchema } from '../validators'
import { ApiError } from '../errors'

const router = Router()

router.post('/', async (req, res, next) => {
    try {
        const parseResult = chatRequestSchema.safeParse(req.body)
        if (!parseResult.success) {
            const message = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
            throw new ApiError(message, 400)
        }

        const { role, input, mode, userId } = parseResult.data
        const uid = userId || 'anon'
        const constitution = ConstitutionService.getConstitution(role)
        let reply: string

        if (mode === 'debate') {
            // For debate mode, use a specialized, lightweight prompt to speed up generation
            if (process.env.DEEPSEEK_API_KEY) {
                try {
                    reply = await LLMProvider.generateDebateReply({ constitution, input })
                } catch (e) {
                    console.error('DeepSeek debate call failed, falling back to mock:', e)
                    reply = await LLM.generateReply({ constitution, memoryPack: { summary: '', recent: [] }, input, evidence: [], requireCitation: false })
                }
            } else {
                reply = await LLM.generateReply({ constitution, memoryPack: { summary: '', recent: [] }, input, evidence: [], requireCitation: false })
            }
        } else {
            const memoryPack = await ContextManager.buildMemoryPack(uid, role, input)

            // simple heuristic to decide when to inject local knowledge for context
            const localEvidence = KnowledgeService.search(role, input, 3)

            if (process.env.DEEPSEEK_API_KEY) {
                try {
                    reply = await LLMProvider.generateReply({ constitution, memoryPack, input, evidence: localEvidence, requireCitation: false })
                } catch (e) {
                    console.error('DeepSeek call failed, falling back to mock:', e)
                    reply = await LLM.generateReply({ constitution, memoryPack, input, evidence: localEvidence, requireCitation: false })
                }
            } else {
                reply = await LLM.generateReply({ constitution, memoryPack, input, evidence: localEvidence, requireCitation: false })
            }
        }

        let aiEvidence = [] as Array<{ id: string; text: string }>
        try {
            aiEvidence = await KnowledgeService.generateEvidence(role, input, 3)
        } catch (e) {
            console.warn('generateEvidence failed:', e)
            aiEvidence = []
        }

        await ContextManager.appendTurn(uid, role, { user: input, assistant: reply })

        let analysis = null
        if (mode === 'analyze') {
            const dialogue = await ContextManager.getDialogue(uid, role, 100)
            analysis = AnalysisService.analyze(dialogue)
        }

        res.json({ reply, evidence: aiEvidence, analysis })
    } catch (err) {
        next(err)
    }
})

export default router
