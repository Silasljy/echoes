import { Constitution } from './constitution'

type MemoryPack = { summary: string; recent: Array<{ user: string; assistant: string }> }

type RoleInfo = { name: string; description?: string }

// Keyword-based role matcher for mock mode
function hashStr(s: string) {
    let h = 5381
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i)
    return Math.abs(h)
}

function matchRoleByInput(input: string, roles: RoleInfo[]): string {
    // Scoring system: each role gets points for matching keywords
    const score: Record<string, number> = {}
    const validRoles = roles.filter(r => r.name !== '自定义')
    validRoles.forEach(r => { score[r.name] = 0 })

    const rules: [RegExp, string[]][] = [
        // 悲伤/低沉 → 庄子（逍遥开解）、老子（顺其自然）
        [/难过|伤心|悲伤|哀伤|悲痛|痛苦|心碎|绝望|哭泣|哭|流泪|泪|伤感|忧郁|抑郁|消沉|低落|不开心|郁闷|沮丧|委屈|想哭/, ['庄子', '老子']],
        // 孤独/失落 → 庄子（逍遥）、孔子（仁者爱人）
        [/孤独|寂寞|孤单|无人|没人|独自|一个人|失落|落寞|空虚|无依/, ['庄子', '孔子']],
        // 愤怒/不满 → 孟子（义愤）、孔子（克己）
        [/愤怒|生气|恼火|气愤|怒|恨|怨恨|不满|不公平|凭什么|可恶|讨厌|烦死了|烦躁|暴躁/, ['孟子', '孔子']],
        // 焦虑/紧张 → 老子（无为）、亚里士多德（理性）
        [/焦虑|焦虑不安|担心|紧张|不安|害怕|恐慌|恐惧|心惊|惶惶|忐忑|压力|喘不过气/, ['老子', '亚里士多德']],
        // 迷茫/困惑 → 亚里士多德（逻辑分析）、老子（道）
        [/迷茫|困惑|迷惘|不懂|不明白|不理解|不清楚|犹豫|纠结|选择|何去何从|方向|意义/, ['亚里士多德', '老子']],
        // 喜悦/满足 → 庄子（逍遥）、孔子（乐）
        [/开心|快乐|高兴|喜悦|幸福|满足|欣喜|欢喜|兴奋|激动|感恩|感动|美好/, ['庄子', '孔子']],
        // 疲惫/倦怠 → 老子（无为）、庄子（逍遥）
        [/累|疲惫|疲倦|倦怠|无力|乏力|困|厌倦|厌烦|没劲|没动力|躺平/, ['老子', '庄子']],
        // 思念/怀旧 → 孔子（仁者念旧）、孟子
        [/想念|思念|怀念|回忆|回忆|怀旧|故人|过去|曾经|往事|追忆/, ['孔子', '孟子']],
        // 愧疚/忏悔 → 孟子（性善）、孔子（自省）
        [/愧疚|抱歉|对不起|内疚|自责|后悔|懊悔|忏悔|过错|错了|犯错/, ['孟子', '孔子']],
        // 惊讶/震撼 → 庄子（寓言）、亚里士多德（求知）
        [/惊讶|震惊|震撼|意外|没想到|居然|竟然|不可思议|难以置信/, ['庄子', '亚里士多德']],
    ]

    for (const [regex, candidates] of rules) {
        const matches = input.match(regex)
        if (matches) {
            const weight = matches.length // more matches = higher weight
            for (const name of candidates) {
                if (score[name] !== undefined) {
                    score[name] += weight
                }
            }
        }
    }

    // Find top scorer(s)
    const maxScore = Math.max(...Object.values(score), 0)
    if (maxScore > 0) {
        const top = Object.entries(score).filter(([, s]) => s === maxScore).map(([name]) => name)
        // Among top scorers, pick deterministically based on input hash
        const idx = hashStr(input) % top.length
        return top[idx]
    }

    // Fallback: pick deterministically from valid roles using input hash
    // This ensures same input → same role, different inputs → different roles
    const idx = hashStr(input) % validRoles.length
    return validRoles[idx]?.name || '孔子'
}

export default {
    async generateReply({ constitution, memoryPack, input, evidence, requireCitation }:
        { constitution: Constitution; memoryPack: MemoryPack; input: string; evidence: Array<{ id: string; text: string }>; requireCitation?: boolean }) {
        // Improved deterministic simulator for local development.
        // Generate a reply that varies with `input` and recent turns so local debugging doesn't produce identical outputs.
        const parts: string[] = []
        if (memoryPack.summary) parts.push(`记忆摘要：${memoryPack.summary}`)
        if (memoryPack.recent.length) {
            parts.push('最近对话节选：')
            memoryPack.recent.forEach((t, i) => parts.push(`${i + 1}. 用户：${t.user} → 回答：${t.assistant}`))
        }

        // small hash to pick a template deterministically based on input+recent
        function hashStr(s: string) {
            let h = 5381
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i)
            return Math.abs(h)
        }

        const shortAnswer = '行己安人，以礼为先，仁为本。'
        const lastAssistant = memoryPack.recent.length ? (memoryPack.recent[memoryPack.recent.length - 1].assistant || '') : ''
        const snippet = String(input || '').slice(0, 36)
        const templates = [
            `${constitution.name}（模拟回应）：\n${shortAnswer}`,
            `${constitution.name}回道：\n关于“${snippet}”我以为${shortAnswer}`,
            `${constitution.name}曰：${shortAnswer}（承接前言：${lastAssistant.slice(0, 40) || snippet}）`
        ]

        const idx = hashStr((input || '') + JSON.stringify(memoryPack.recent || [])) % templates.length
        const response = templates[idx]

        if (requireCitation) return response + '\n引用证据IDs: 无'
        return response
    },

    async generateReverseQuestion({ constitution, topic, input, memoryPack, stage }:
        { constitution: Constitution; topic: string; input: string; memoryPack: MemoryPack; stage?: string }) {
        const parts: string[] = []
        if (memoryPack.summary) parts.push(`记忆摘要：${memoryPack.summary}`)
        if (memoryPack.recent.length) {
            parts.push('最近反向问答：')
            memoryPack.recent.forEach((t, i) => parts.push(`${i + 1}. 用户回答：${t.user} → 人物追问：${t.assistant}`))
        }

        function hashStr(s: string) {
            let h = 5381
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i)
            return Math.abs(h)
        }

        const topicSnippet = String(topic || '这个话题').slice(0, 18)
        const inputSnippet = String(input || '请继续').slice(0, 24)
        const templates = [
            `你怎么看“${topicSnippet}”中的关键一义？`,
            `若从“${inputSnippet}”继续，你会如何回应？`,
            `关于“${topicSnippet}”，我想追问你一句：你更重视哪一点？`
        ]
        const idx = hashStr((topic || '') + (input || '') + JSON.stringify(memoryPack.recent || [])) % templates.length
        const question = `${constitution.name}问：${templates[idx]}`

        return {
            question,
            meta: { focus: topicSnippet }
        }
    },

    async generateEmotionEcho({ constitution, input, emotionLabel }:
        { constitution: Constitution; input: string; emotionLabel: string }) {
        function hashStr(s: string) {
            let h = 5381
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i)
            return Math.abs(h)
        }

        const snippet = String(input || '').slice(0, 24)
        const templates = [
            `${constitution.name}听闻此言，抚须叹道：「${snippet}… 此情此景，吾亦有感。」\n\n（模拟回应）人生在世，喜怒哀乐皆自然。唯愿足下以平常心待之。`,
            `${constitution.name}轻声道：「闻${snippet}，愿与足下共勉。」\n\n（模拟回应）世事浮沉，何须萦怀？宁静致远，足下当宽心。`,
            `${constitution.name}曰：「${snippet}。吾闻之，亦有所感。」\n\n（模拟回应）人心如镜，映照万象。足下之感受，吾亦曾经历。望君泰然处之。`
        ]

        const idx = hashStr(input + (emotionLabel || '')) % templates.length
        return {
            reply: templates[idx],
            emotionLabel: emotionLabel || '未识别'
        }
    },

    // Combined: pick the best role + generate response in one step
    async generateEmotionEchoWithAutoSelect(input: string, roles: RoleInfo[]) {
        const selectedRole = matchRoleByInput(input, roles)
        // Build a mock constitution for the selected role
        const constitution: Constitution = {
            name: selectedRole,
            instructions: `你扮演 ${selectedRole}，保持角色一致性。`
        }
        const result = await this.generateEmotionEcho({ constitution, input, emotionLabel: '未识别' })
        return { ...result, selectedRole }
    }
}
