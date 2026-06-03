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

        const { role, input, mode, userId, debateTopic, debateContext } = parseResult.data as {
            role: string
            input: string
            mode?: string
            userId?: string
            debateTopic?: string
            debateContext?: string
            reverseTopic?: string
            reverseStage?: string
        }
        const uid = userId || 'anon'
        const constitution = ConstitutionService.getConstitution(role)
        let reply: string
        let debateMeta: any = null

        if (mode === 'reverseQA') {
            const reverseMemoryPack = await ContextManager.buildMemoryPack(uid, role, input)
            const reverseTopic = (parseResult.data as any).reverseTopic || input
            const reverseStage = (parseResult.data as any).reverseStage || 'start'

            if (process.env.DEEPSEEK_API_KEY) {
                try {
                    const reverseResult = await LLMProvider.generateReverseQuestion({
                        constitution,
                        topic: reverseTopic,
                        input,
                        memoryPack: reverseMemoryPack,
                        stage: reverseStage
                    })
                    reply = reverseResult.question
                } catch (e) {
                    console.error('DeepSeek reverseQA call failed, falling back to mock:', e)
                    reply = (await LLM.generateReverseQuestion({
                        constitution,
                        topic: reverseTopic,
                        input,
                        memoryPack: reverseMemoryPack,
                        stage: reverseStage
                    })).question
                }
            } else {
                reply = (await LLM.generateReverseQuestion({
                    constitution,
                    topic: reverseTopic,
                    input,
                    memoryPack: reverseMemoryPack,
                    stage: reverseStage
                })).question
            }

            await ContextManager.appendTurn(uid, role, {
                user: reverseStage === 'start' ? `话题：${reverseTopic}` : input,
                assistant: reply
            })

            return res.json({ reply, evidence: [], analysis: null, debateMeta: null })
        }

        if (mode === 'debate') {
            const debateMemoryPack = await ContextManager.buildMemoryPack(uid, role, input)
            let parsedDebateContext: any[] = []
            if (debateContext) {
                try {
                    const parsed = JSON.parse(debateContext)
                    if (Array.isArray(parsed)) parsedDebateContext = parsed
                    else if (parsed && Array.isArray(parsed.turns)) parsedDebateContext = parsed.turns
                } catch (e) {
                    console.warn('failed to parse debateContext', e)
                }
            }

            if (process.env.DEEPSEEK_API_KEY) {
                try {
                    const debateResult = await LLMProvider.generateDebateReply({
                        constitution,
                        input,
                        topic: debateTopic || input,
                        memoryPack: debateMemoryPack,
                        debateContext: parsedDebateContext
                    })
                    reply = debateResult.reply
                    debateMeta = debateResult.meta
                } catch (e) {
                    console.error('DeepSeek debate call failed, falling back to mock:', e)
                    reply = await LLM.generateReply({ constitution, memoryPack: { summary: '', recent: [] }, input, evidence: [], requireCitation: false })
                    debateMeta = {
                        stance: '中立',
                        stanceSummary: reply.slice(0, 80),
                        keyPoints: []
                    }
                }
            } else {
                reply = await LLM.generateReply({ constitution, memoryPack: { summary: '', recent: [] }, input, evidence: [], requireCitation: false })
                debateMeta = {
                    stance: '中立',
                    stanceSummary: reply.slice(0, 80),
                    keyPoints: []
                }
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

        res.json({ reply, evidence: aiEvidence, analysis, debateMeta })
    } catch (err) {
        next(err)
    }
})

export default router
