import Retrieval from './retrieval'

type Evidence = { id: string; text: string }

const db: Record<string, Evidence[]> = {
    '孔子': [
        { id: 'lunyu-1', text: '子曰：学而时习之，不亦说乎？' },
        { id: 'lunyu-2', text: '子曰：仁者爱人。' },
        { id: 'lunyu-3', text: '子曰：己所不欲，勿施于人。' }
    ],
    '孟子': [
        { id: 'mengzi-1', text: '孟子曰：人之初，性本善。' },
        { id: 'mengzi-2', text: '孟子曰：仁政者，仁民也。' }
    ],
    '老子': [
        { id: 'laozi-1', text: '道可道，非常道；名可名，非常名。' },
        { id: 'laozi-2', text: '上善若水，水利万物而不争。' }
    ],
    '庄子': [
        { id: 'zhuangzi-1', text: '庄子梦为胡蝶，栩栩然胡蝶也。' },
        { id: 'zhuangzi-2', text: '莊子曰：天地与我并生，而万物与我为一。' }
    ],
    '亚里士多德': [
        { id: 'aristotle-1', text: '德性在于中庸（virtue lies in the mean）。' },
        { id: 'aristotle-2', text: '人是天生的政治动物（man is by nature a political animal）。' }
    ]
}

export default {
    search(role: string, query: string, limit = 3): Evidence[] {
        const pool = db[role] || []
        const scored = Retrieval.rankByRelevance(pool, query, limit)
        return scored.map(item => item)
    },

    async generateEvidence(role: string, query: string, limit = 3) {
        try {
            const LLM = require('./llmProvider').default
            const constitutionModule = require('./constitution').default
            const constitution = constitutionModule.getConstitution(role)
            const items = await LLM.generateEvidence({ constitution, query, limit })
            return items as Evidence[]
        } catch (e) {
            console.warn('generateEvidence failed', e)
            return [] as Evidence[]
        }
    }
}
