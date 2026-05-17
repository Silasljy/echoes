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

        // Tokenization: handle Chinese (no spaces) by splitting to characters,
        // otherwise split on common delimiters. This avoids always returning
        // the fixed sample when Chinese queries have no whitespace.
        let tokens = query.split(/\s+|，|。|；|、|\?|\!|\u3002/).filter(Boolean)
        const hasCJK = /[\u4e00-\u9fff]/.test(query)
        if (hasCJK && tokens.length === 1) {
            // break into characters (skip very common punctuation)
            tokens = Array.from(query).filter(ch => ch.trim().length > 0)
        }

        const scored = pool.map(e => {
            // score by how many token substrings appear in the evidence text
            const text = e.text || ''
            let score = 0
            tokens.forEach(t => { if (t && text.includes(t)) score += 1 })
            return { e, score }
        }).filter(x => x.score > 0)

        scored.sort((a, b) => b.score - a.score)
        const results = scored.slice(0, limit).map(s => s.e)
        // if no direct hit, return top N
        return results.length ? results : pool.slice(0, limit)
    }
}
