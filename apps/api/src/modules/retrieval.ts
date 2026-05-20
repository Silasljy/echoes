export type ScoredItem<T> = T & { score: number }

function normalizeText(text: string) {
    return text
        .toLowerCase()
        .replace(/\p{P}/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function tokenizeText(text: string) {
    const normalized = normalizeText(text)
    const hasCJK = /[\u4e00-\u9fff]/.test(text)
    if (hasCJK) {
        return Array.from(text)
            .filter(ch => /[\u4e00-\u9fff0-9a-zA-Z]/.test(ch))
            .map(ch => ch.trim())
            .filter(Boolean)
    }
    return normalized.split(' ').filter(Boolean)
}

function buildTokenCounts(tokens: string[]) {
    return tokens.reduce<Record<string, number>>((counts, token) => {
        counts[token] = (counts[token] || 0) + 1
        return counts
    }, {})
}

function scoreText(query: string, text: string) {
    const queryTokens = tokenizeText(query)
    if (queryTokens.length === 0) return 0

    const textTokens = tokenizeText(text)
    const queryCounts = buildTokenCounts(queryTokens)
    const textCounts = buildTokenCounts(textTokens)

    let score = 0
    Object.entries(queryCounts).forEach(([token, count]) => {
        if (textCounts[token]) {
            score += Math.min(count, textCounts[token]) * (token.length > 1 ? 2 : 1)
        }
    })

    if (queryTokens.length > 0 && textTokens.length > 0) {
        score += Math.min(3, queryTokens.length) * 0.1
    }
    return score
}

export function rankByRelevance<T extends { text: string }>(items: T[], query: string, limit = 3) {
    const scored = items
        .map(item => ({ ...item, score: scoreText(query, item.text) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)

    if (scored.length > 0) {
        return scored.slice(0, limit)
    }

    return items.slice(0, limit).map(item => ({ ...item, score: 0 }))
}

export function rankHistoryTurns(turns: Array<{ user: string; assistant: string }>, query: string, limit = 6) {
    const items = turns.map((turn, index) => ({
        id: `${index}`,
        text: `用户：${turn.user} 助手：${turn.assistant}`,
        original: turn
    }))
    const scored = rankByRelevance(items, query, limit)
    return scored.map(item => item.original)
}

export default {
    normalizeText,
    tokenizeText,
    scoreText,
    rankByRelevance,
    rankHistoryTurns
}
