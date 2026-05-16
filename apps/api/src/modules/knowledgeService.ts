type Evidence = { id: string; text: string }

const db: Record<string, Evidence[]> = {
    '孔子': [
        { id: 'lunyu-1', text: '子曰：学而时习之，不亦说乎？' },
        { id: 'lunyu-2', text: '子曰：仁者爱人。' },
        { id: 'lunyu-3', text: '子曰：己所不欲，勿施于人。' }
    ]
}

export default {
    search(role: string, query: string, limit = 3): Evidence[] {
        const pool = db[role] || []
        // naive relevance: include those containing any token
        const tokens = query.split(/\s+|，|。|；|、|\?|\!|\?|\u3002/).filter(Boolean)
        const scored = pool.map(e => {
            const score = tokens.reduce((s, t) => s + (e.text.includes(t) ? 1 : 0), 0)
            return { e, score }
        }).filter(x => x.score > 0)
        scored.sort((a, b) => b.score - a.score)
        const results = scored.slice(0, limit).map(s => s.e)
        // if no direct hit, return top N
        return results.length ? results : pool.slice(0, limit)
    }
}
