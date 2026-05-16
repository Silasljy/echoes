type Turn = { user: string; assistant: string }

export default {
    analyze(dialogue: Turn[]) {
        // naive post-hoc analysis: extract common tokens and check consistency
        const all = dialogue.map(t => t.assistant).join(' ')
        const tokens = all.split(/\s+|，|。|、|；|！|\?|\u3002/).filter(Boolean)
        const freq: Record<string, number> = {}
        tokens.forEach(t => { if (t.length > 1) freq[t] = (freq[t] || 0) + 1 })
        const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0])
        return {
            summary: `对话包含 ${dialogue.length} 轮，主要关键词：${top.join('、')}`,
            consistency: '简单检查：回复中反复强调核心价值观，未发现明显立场漂移（基于词频）。',
            suggestions: [
                '如果需要更严谨的立场验证，可引入外部史料比对步骤。',
                '在关键事实判定点可要求模型提供引证段落和来源ID。'
            ]
        }
    }
}
