import React, { useState, useEffect } from 'react'

type LocalTurn = { user: string; assistant: string; ts: number }
type HistoryStore = Record<string, LocalTurn[]>

export default function App() {
    const [role, setRole] = useState('孔子')
    const apiBase = (() => {
        const envBase = (import.meta as any).env?.VITE_API_BASE
        if (envBase) return envBase
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            return 'http://localhost:4000'
        }
        return '/api'
    })()
    const [input, setInput] = useState('什么是仁？')
    const [customRole, setCustomRole] = useState('')
    const [roles, setRoles] = useState<string[]>(['孔子', '孟子', '老子', '庄子', '自定义'])
    const [reply, setReply] = useState<string | null>(null)
    const [evidence, setEvidence] = useState<any>(null)
    const [expandedEvidence, setExpandedEvidence] = useState<number[]>([])
    const [userId, setUserId] = useState<string | null>(null)
    const [page, setPage] = useState<'chat' | 'history' | 'debate' | 'debateHistory'>('chat')
    const [historyStore, setHistoryStore] = useState<HistoryStore>({})
    const [selectedHistoryRole, setSelectedHistoryRole] = useState('')
    const [exportFormat, setExportFormat] = useState<'markdown' | 'txt'>('markdown')
    // debate states
    const [debateTopic, setDebateTopic] = useState('孔子与仁的本质应如何理解？')
    const [debateParticipants, setDebateParticipants] = useState<string[]>(['', '', ''])
    const [debatesList, setDebatesList] = useState<DebateRecord[]>([])
    const [selectedDebateId, setSelectedDebateId] = useState<string | null>(null)
    const [debateActiveSlot, setDebateActiveSlot] = useState(0)
    const [isDebating, setIsDebating] = useState(false)
    const [liveDebate, setLiveDebate] = useState<DebateRecord | null>(null)
    const debateStageRef = React.useRef<HTMLDivElement | null>(null)

    const debateFixedRoles = roles.filter(name => name !== '自定义')

    function getOrCreateLocalUserId() {
        const key = 'echoes.userId'
        let id = localStorage.getItem(key)
        if (!id) {
            id = `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`
            localStorage.setItem(key, id)
        }
        return id
    }

    function localStorageKey(uid: string) {
        return `echoes.history.${uid}`
    }

    function loadLocalHistoryStore(uid: string) {
        try {
            const raw = localStorage.getItem(localStorageKey(uid))
            if (!raw) return {} as HistoryStore
            return JSON.parse(raw || '{}') as HistoryStore
        } catch (e) {
            console.warn('load history failed', e)
            return {} as HistoryStore
        }
    }

    function loadLocalHistory(uid: string, roleName: string) {
        const all = loadLocalHistoryStore(uid)
        return all[roleName] ? all[roleName].slice().reverse() : []
    }

    function saveLocalTurn(uid: string, roleName: string, turn: LocalTurn) {
        try {
            const key = localStorageKey(uid)
            const raw = localStorage.getItem(key)
            const all = raw ? JSON.parse(raw) as HistoryStore : {}
            const list = all[roleName] || []
            list.push(turn)
            // cap to 50 most recent
            while (list.length > 50) list.shift()
            all[roleName] = list
            localStorage.setItem(key, JSON.stringify(all))
        } catch (e) {
            console.warn('save history failed', e)
        }
    }

    function deleteLocalHistoryRole(uid: string, roleName: string) {
        try {
            const key = localStorageKey(uid)
            const raw = localStorage.getItem(key)
            if (!raw) return
            const all = JSON.parse(raw) as HistoryStore
            delete all[roleName]
            localStorage.setItem(key, JSON.stringify(all))
        } catch (e) {
            console.warn('delete role history failed', e)
        }
    }

    function deleteLocalHistoryTurn(uid: string, roleName: string, turnIndex: number) {
        try {
            const key = localStorageKey(uid)
            const raw = localStorage.getItem(key)
            if (!raw) return
            const all = JSON.parse(raw) as HistoryStore
            const list = all[roleName]
            if (!Array.isArray(list) || turnIndex < 0 || turnIndex >= list.length) return
            list.splice(turnIndex, 1)
            if (list.length === 0) {
                delete all[roleName]
            } else {
                all[roleName] = list
            }
            localStorage.setItem(key, JSON.stringify(all))
        } catch (e) {
            console.warn('delete turn history failed', e)
        }
    }

    function getSortedHistoryRoles(store: HistoryStore) {
        return Object.entries(store)
            .filter(([, turns]) => Array.isArray(turns) && turns.length > 0)
            .sort((a, b) => (b[1][b[1].length - 1]?.ts || 0) - (a[1][a[1].length - 1]?.ts || 0))
            .map(([name, turns]) => ({ name, turns }))
    }

    function refreshHistory(uid: string, preferredRole?: string) {
        const store = loadLocalHistoryStore(uid)
        setHistoryStore(store)
        const rolesInStore = getSortedHistoryRoles(store)
        const nextRole = preferredRole || rolesInStore[0]?.name || ''
        setSelectedHistoryRole(nextRole)
        return { store, nextRole }
    }

    function refreshHistoryPreservingSelection(uid: string, currentRole: string) {
        const store = loadLocalHistoryStore(uid)
        setHistoryStore(store)
        const nextRole = store[currentRole]?.length ? currentRole : getSortedHistoryRoles(store)[0]?.name || ''
        setSelectedHistoryRole(nextRole)
        return { store, nextRole }
    }

    function buildHistoryExport(roleName: string, turns: LocalTurn[], format: 'markdown' | 'txt') {
        const title = `Echoes 历史对话 - ${roleName}`
        const generatedAt = new Date().toLocaleString()
        if (format === 'txt') {
            const lines = [
                title,
                `导出时间：${generatedAt}`,
                '',
                ...turns.flatMap((turn, index) => [
                    `【第 ${index + 1} 轮】`,
                    `时间：${new Date(turn.ts).toLocaleString()}`,
                    `用户：${turn.user}`,
                    `助手：${turn.assistant}`,
                    ''
                ])
            ]
            return lines.join('\n')
        }

        const lines = [
            `# ${title}`,
            '',
            `- 导出时间：${generatedAt}`,
            `- 人物：${roleName}`,
            `- 对话轮数：${turns.length}`,
            '',
            ...turns.flatMap((turn, index) => [
                `## 第 ${index + 1} 轮`,
                '',
                `- 时间：${new Date(turn.ts).toLocaleString()}`,
                '',
                '### 用户',
                '```text',
                turn.user,
                '```',
                '',
                '### 助手',
                '```text',
                turn.assistant,
                '```',
                ''
            ])
        ]
        return lines.join('\n')
    }

    // Debate storage
    type DebateMessage = { speaker: string; text: string; ts: number }
    type DebateRecord = { id: string; topic: string; participants: string[]; messages: DebateMessage[]; createdAt: number }

    function debateStorageKey(uid: string) {
        return `echoes.debate.${uid}`
    }

    function loadLocalDebates(uid: string): DebateRecord[] {
        try {
            const raw = localStorage.getItem(debateStorageKey(uid))
            if (!raw) return []
            return JSON.parse(raw) as DebateRecord[]
        } catch (e) {
            console.warn('load debates failed', e)
            return []
        }
    }

    function saveLocalDebate(uid: string, rec: DebateRecord) {
        try {
            const list = loadLocalDebates(uid)
            list.unshift(rec)
            while (list.length > 100) list.pop()
            localStorage.setItem(debateStorageKey(uid), JSON.stringify(list))
        } catch (e) {
            console.warn('save debate failed', e)
        }
    }

    function deleteLocalDebate(uid: string, id: string) {
        try {
            const list = loadLocalDebates(uid).filter(d => d.id !== id)
            localStorage.setItem(debateStorageKey(uid), JSON.stringify(list))
        } catch (e) { console.warn('delete debate failed', e) }
    }


    function triggerDownload(filename: string, content: string, mimeType: string) {
        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
    }

    async function runDebate(uid: string, topic: string, participants: string[]) {
        // orchestrate 3 rounds, each participant speaks in turn
        if (!participants || participants.length === 0) return null
        setIsDebating(true)
        const messages: DebateMessage[] = []
        const liveId = `live-${Date.now()}`
        const liveRec: DebateRecord = { id: liveId, topic, participants: participants.slice(), messages: [], createdAt: Date.now() }
        setLiveDebate(liveRec)
        setSelectedDebateId(liveId)
        let lastStatement = topic
        try {
            for (let round = 1; round <= 3; round++) {
                for (let pi = 0; pi < participants.length; pi++) {
                    const speaker = participants[pi]
                    const roleToSend = speaker === '自定义' ? speaker : speaker
                    const res = await fetch(`${apiBase}/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ role: roleToSend, input: lastStatement, userId: uid, mode: 'debate' })
                    })
                    const data = await res.json()
                    const text = data.reply || ''
                    const msg: DebateMessage = { speaker, text, ts: Date.now() }
                    messages.push(msg)
                    // update live debate immediately
                    setLiveDebate(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev)
                    // scroll to bottom
                    try { debateStageRef.current?.scrollTo({ top: debateStageRef.current.scrollHeight, behavior: 'smooth' }) } catch (_) { }
                    lastStatement = text
                }
            }
        } catch (e) {
            console.warn('debate generation failed', e)
        }
        // persist final debate record
        const rec: DebateRecord = { id: `debate-${Date.now()}`, topic, participants: participants.slice(), messages: messages.slice(), createdAt: Date.now() }
        try { saveLocalDebate(uid, rec); } catch (e) { /* ignore */ }
        // refresh list and select persisted record
        refreshDebates(uid)
        setSelectedDebateId(rec.id)
        setLiveDebate(null)
        setIsDebating(false)
        return messages
    }

    function refreshDebates(uid: string) {
        const list = loadLocalDebates(uid)
        setDebatesList(list)
        setSelectedDebateId(list[0]?.id || null)
    }

    function buildDebateExport(debateId: string, format: 'markdown' | 'txt') {
        const rec = (debatesList.find(d => d.id === debateId) || (liveDebate && liveDebate.id === debateId ? liveDebate : null)) as DebateRecord | null
        if (!rec) return ''
        const generatedAt = new Date().toLocaleString()
        if (format === 'txt') {
            const lines: string[] = []
            lines.push(`辩题：${rec.topic}`)
            lines.push(`参与者：${rec.participants.join(' / ')}`)
            lines.push(`创建时间：${new Date(rec.createdAt).toLocaleString()}`)
            lines.push('')
            rec.messages.forEach((m, i) => {
                lines.push(`【${i + 1}】 ${m.speaker} (${new Date(m.ts).toLocaleString()}):`)
                lines.push(m.text)
                lines.push('')
            })
            return lines.join('\n')
        }

        const md: string[] = []
        md.push(`# 辩题：${rec.topic}`)
        md.push('')
        md.push(`- 参与者：${rec.participants.join(' / ')}`)
        md.push(`- 创建时间：${new Date(rec.createdAt).toLocaleString()}`)
        md.push('')
        rec.messages.forEach((m, i) => {
            md.push(`## 第 ${i + 1} 条`)
            md.push('')
            md.push(`- 说话人：${m.speaker}`)
            md.push(`- 时间：${new Date(m.ts).toLocaleString()}`)
            md.push('')
            md.push('```text')
            md.push(m.text)
            md.push('```')
            md.push('')
        })
        return md.join('\n')
    }

    function exportSelectedDebate() {
        if (!userId || !selectedDebateId) return
        const content = buildDebateExport(selectedDebateId, exportFormat)
        if (!content) return
        const safe = (selectedDebateId || '').replace(/[^a-zA-Z0-9_-]/g, '_')
        const ext = exportFormat === 'markdown' ? 'md' : 'txt'
        const filename = `echoes-debate-${safe}-${new Date().toISOString().slice(0, 10)}.${ext}`
        const mime = exportFormat === 'markdown' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
        triggerDownload(filename, content, mime)
    }

    function openDebateHistory() {
        const uid = userId || getOrCreateLocalUserId()
        setUserId(uid)
        refreshDebates(uid)
        setPage('debateHistory')
    }


    function exportSelectedHistory() {
        if (!userId || !selectedHistoryRole) return
        const turns = (historyStore[selectedHistoryRole] || []).slice().reverse()
        if (turns.length === 0) return
        const extension = exportFormat === 'markdown' ? 'md' : 'txt'
        const mimeType = exportFormat === 'markdown' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
        const content = buildHistoryExport(selectedHistoryRole, turns, exportFormat)
        const safeRole = selectedHistoryRole.replace(/[\\/:*?"<>|]/g, '_')
        const filename = `echoes-${safeRole}-${new Date().toISOString().slice(0, 10)}.${extension}`
        triggerDownload(filename, content, mimeType)
    }

    function clearSelectedRoleHistory() {
        if (!userId || !selectedHistoryRole) return
        deleteLocalHistoryRole(userId, selectedHistoryRole)
        refreshHistoryPreservingSelection(userId, selectedHistoryRole)
    }

    function removeSelectedRoleTurn(turnIndex: number) {
        if (!userId || !selectedHistoryRole) return
        deleteLocalHistoryTurn(userId, selectedHistoryRole, turnIndex)
        refreshHistoryPreservingSelection(userId, selectedHistoryRole)
    }

    async function send() {
        setReply('加载中...')
        const roleToSend = role === '自定义' ? (customRole || '未知人物') : role
        const uid = userId || getOrCreateLocalUserId()
        if (!userId) setUserId(uid)

        const res = await fetch(`${apiBase}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: roleToSend, input, userId: uid })
        })
        const data = await res.json()
        setReply(data.reply)
        setEvidence(data.evidence)
        setExpandedEvidence([])

        // save locally
        const turn: LocalTurn = { user: input, assistant: data.reply || '', ts: Date.now() }
        saveLocalTurn(uid, roleToSend, turn)
        // refresh history view if open
        if (page === 'history') refreshHistoryPreservingSelection(uid, roleToSend)
    }

    useEffect(() => {
        let mounted = true
            ; (async () => {
                try {
                    const res = await fetch(`${apiBase}/roles`)
                    const data = await res.json()
                    if (mounted && data && Array.isArray(data.roles)) {
                        // backend returns array of role objects {id,name,...}
                        const list = data.roles.map((r: any) => (r && (r.name || r.id)) || String(r))
                        if (!list.includes('自定义')) list.push('自定义')
                        setRoles(list)
                        if (!list.includes(role)) setRole(list[0] || '自定义')
                    }
                } catch (err) {
                    // ignore and keep defaults
                    console.warn('failed to fetch roles', err)
                }
            })()
        // init local user id
        const uid = getOrCreateLocalUserId()
        setUserId(uid)

        // on unload/pagehide, notify server to clear server-side history for this user
        const sendEndSession = () => {
            try {
                const payload = JSON.stringify({ userId: uid })
                const blob = new Blob([payload], { type: 'application/json' })
                if (navigator.sendBeacon) {
                    navigator.sendBeacon(`${apiBase}/session/end`, blob)
                } else {
                    // fallback synchronous XHR (may be blocked in some browsers)
                    const xhr = new XMLHttpRequest()
                    xhr.open('POST', `${apiBase}/session/end`, false)
                    xhr.setRequestHeader('Content-Type', 'application/json')
                    try { xhr.send(payload) } catch (e) { /* ignore */ }
                }
            } catch (e) {
                // ignore
            }
        }

        window.addEventListener('beforeunload', sendEndSession)
        window.addEventListener('pagehide', sendEndSession)

        return () => {
            mounted = false
            window.removeEventListener('beforeunload', sendEndSession)
            window.removeEventListener('pagehide', sendEndSession)
        }
    }, [])

    useEffect(() => {
        if (!userId) return
        if (page !== 'history') return
        const roleToShow = selectedHistoryRole || (role === '自定义' ? (customRole || '未知人物') : role)
        refreshHistoryPreservingSelection(userId, roleToShow)
    }, [role, customRole, userId, page, selectedHistoryRole])

    useEffect(() => {
        if (!userId || page !== 'history') return
        if (selectedHistoryRole) return
        const store = loadLocalHistoryStore(userId)
        const firstRole = getSortedHistoryRoles(store)[0]?.name || ''
        if (firstRole) {
            setSelectedHistoryRole(firstRole)
            setHistoryStore(store)
        }
    }, [userId, page, selectedHistoryRole])

    // auto-scroll debate stage to bottom when live messages update or when selecting a debate
    useEffect(() => {
        const el = debateStageRef.current
        if (!el) return
        // allow DOM to render before scrolling inner stage
        const id = window.setTimeout(() => {
            try {
                el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
            } catch (e) {
                // ignore
            }

            // after inner scroll, ensure outer page scrolls so the bottom of the debate stage is visible
            try {
                window.setTimeout(() => {
                    try {
                        const rect = el.getBoundingClientRect()
                        const bottomOnPage = rect.bottom + window.scrollY
                        const visibleBottom = window.scrollY + window.innerHeight
                        // if bottom of debate stage is below viewport, scroll page down a bit to reveal it
                        if (bottomOnPage > visibleBottom - 8) {
                            const target = Math.max(0, bottomOnPage - window.innerHeight + 16)
                            window.scrollTo({ top: target, behavior: 'smooth' })
                        }
                    } catch (_) { }
                }, 120)
            } catch (_) { }
        }, 50)
        return () => window.clearTimeout(id)
    }, [liveDebate, debatesList, selectedDebateId])

    return (
        <>
            {page === 'chat' && (
                <div className="app-shell chat-page">
                    <main className="main-panel">
                        <div className="container">
                            <div className="topbar">
                                <h1>Echoes — 历史人物对话</h1>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn secondary" onClick={() => {
                                        const uid = userId || getOrCreateLocalUserId()
                                        const roleToShow = role === '自定义' ? (customRole || '未知人物') : role
                                        setUserId(uid)
                                        refreshHistory(uid, roleToShow)
                                        setPage('history')
                                    }}>查看历史</button>
                                    <button className="btn secondary" onClick={() => {
                                        const uid = userId || getOrCreateLocalUserId()
                                        setUserId(uid)
                                        refreshDebates(uid)
                                        setPage('debate')
                                    }}>人物辩论</button>
                                </div>
                            </div>

                            <div className="controls">
                                <div className="field role">
                                    <label>人物</label>
                                    <select value={role} onChange={e => setRole(e.target.value)}>
                                        {roles.map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                    {role === '自定义' && (
                                        <input className="custom-role" placeholder="输入自定义人物" value={customRole} onChange={e => setCustomRole(e.target.value)} />
                                    )}
                                </div>
                                <div className="field grow question">
                                    <label>问题</label>
                                    <textarea
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                send()
                                            }
                                        }}
                                    />
                                </div>
                                <div className="field send">
                                    <label>&nbsp;</label>
                                    <div className="flex">
                                        <button className="btn primary" onClick={send}>发送</button>
                                    </div>
                                </div>
                            </div>

                            <div className="output">
                                <h2>回复</h2>
                                <div className="reply">
                                    {reply ? (
                                        reply
                                            .split(/(?<=[。！？?!;；\.])/u)
                                            .map((s: string) => s.trim())
                                            .filter((s: string) => s.length > 0)
                                            .map((para: string, idx: number) => (
                                                <p key={idx}>{para}</p>
                                            ))
                                    ) : (
                                        <p className="muted">（暂无回复）</p>
                                    )}
                                </div>
                                {evidence && evidence.length > 0 && (
                                    <>
                                        <h3>参考（AI 生成，未经证实）</h3>
                                        <div className="evidence-list">
                                            {evidence.map((ev: any, idx: number) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className={`evidence-item ${expandedEvidence.includes(idx) ? 'expanded' : ''}`}
                                                    onClick={() => {
                                                        setExpandedEvidence(prev => (
                                                            prev.includes(idx)
                                                                ? prev.filter(item => item !== idx)
                                                                : [...prev, idx]
                                                        ))
                                                    }}
                                                >
                                                    <div className="evidence-item-header">
                                                        <span>参考 {idx + 1}</span>
                                                        <span className="evidence-item-toggle">
                                                            {expandedEvidence.includes(idx) ? '收起' : '展开'}
                                                        </span>
                                                    </div>
                                                    <div className="evidence-item-body">
                                                        <div className="evidence-text">{ev.text || JSON.stringify(ev)}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </main>
                </div>
            )}

            {page === 'history' && (
                <div className="history-page">
                    <div className="history-page-header">
                        <div>
                            <h1>历史记录</h1>
                            <div className="muted">按人物浏览本地对话，并可导出或删除</div>
                        </div>
                        <div className="history-page-actions">
                            <button className="btn secondary" onClick={() => setPage('chat')}>返回主对话</button>
                        </div>
                    </div>

                    <div className="history-page-layout">
                        <aside className="history-sidebar-panel">
                            <div className="history-sidebar-title">人物</div>
                            <div className="history-sidebar-list history-role-list">
                                {getSortedHistoryRoles(historyStore).length === 0 ? (
                                    <p className="muted">（暂无历史人物）</p>
                                ) : (
                                    getSortedHistoryRoles(historyStore).map(item => (
                                        <button
                                            key={item.name}
                                            type="button"
                                            className={`history-role ${selectedHistoryRole === item.name ? 'active' : ''}`}
                                            onClick={() => setSelectedHistoryRole(item.name)}
                                        >
                                            <span className="history-role-name">{item.name}</span>
                                            <span className="history-role-count">{item.turns.length} 轮</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </aside>

                        <section className="history-detail-panel">
                            <div className="history-detail-header history-detail-header-side">
                                <div>
                                    <div className="muted">用户 ID: {userId}</div>
                                    <h3>{selectedHistoryRole || '请选择人物'}</h3>
                                </div>
                                <div className="history-toolbar history-toolbar-side">
                                    <label className="history-export-label">
                                        <span>导出格式</span>
                                        <select value={exportFormat} onChange={e => setExportFormat(e.target.value as 'markdown' | 'txt')}>
                                            <option value="markdown">Markdown</option>
                                            <option value="txt">TXT</option>
                                        </select>
                                    </label>
                                    <button
                                        className="btn secondary"
                                        onClick={exportSelectedHistory}
                                        disabled={!selectedHistoryRole || !historyStore[selectedHistoryRole]?.length}
                                    >
                                        下载当前人物
                                    </button>
                                    <button
                                        className="btn secondary danger"
                                        onClick={clearSelectedRoleHistory}
                                        disabled={!selectedHistoryRole || !historyStore[selectedHistoryRole]?.length}
                                    >
                                        清除当前人物
                                    </button>
                                </div>
                            </div>

                            <div className="history-thread">
                                {!selectedHistoryRole ? (
                                    <p className="muted">（请选择左侧人物查看历史）</p>
                                ) : (historyStore[selectedHistoryRole] || []).length === 0 ? (
                                    <p className="muted">（该人物暂无历史）</p>
                                ) : (
                                    (historyStore[selectedHistoryRole] || []).slice().reverse().map((t, i) => {
                                        const originalIndex = (historyStore[selectedHistoryRole] || []).length - 1 - i
                                        return (
                                            <div key={`${t.ts}-${i}`} className="history-item">
                                                <div className="history-item-head">
                                                    <div className="meta">{new Date(t.ts).toLocaleString()}</div>
                                                    <button className="history-item-delete" onClick={() => removeSelectedRoleTurn(originalIndex)}>删除</button>
                                                </div>
                                                <div><strong>用户：</strong> {t.user}</div>
                                                <div className="mt-2"><strong>助手：</strong> {t.assistant}</div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {page === 'debate' && (
                <div className="history-page">
                    <div className="history-page-header">
                        <div>
                            <h1>人物辩论</h1>
                            <div className="muted">选择或输入最多 3 人，系统生成 3 轮辩论并可本地保存</div>
                        </div>
                        <div className="history-page-actions">
                            <button className="btn secondary" onClick={() => setPage('chat')}>返回主对话</button>
                            <button className="btn secondary" onClick={openDebateHistory}>查看辩论历史</button>
                        </div>
                    </div>

                    <div className="history-detail-panel">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div className="debate-topic-block">
                                <label>辩题</label>
                                <input className="debate-topic-input" value={debateTopic} onChange={e => setDebateTopic(e.target.value)} />
                            </div>
                            <div>
                                <label>人物（最多 3 个）</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[0, 1, 2].map(i => (
                                        <div key={i} className="debate-slot-card">
                                            <button
                                                type="button"
                                                className={`debate-slot-tab ${debateActiveSlot === i ? 'active' : ''}`}
                                                onClick={() => setDebateActiveSlot(i)}
                                            >
                                                第 {i + 1} 位
                                                <span className="debate-slot-tab-value">{debateParticipants[i] || '（空）'}</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="debate-editor-row">
                                <div className="debate-editor-label">正在编辑第 {debateActiveSlot + 1} 位</div>
                                <input
                                    className="debate-custom-input"
                                    placeholder={`直接输入第 ${debateActiveSlot + 1} 位人物名`}
                                    value={debateParticipants[debateActiveSlot] || ''}
                                    onChange={e => {
                                        const next = debateParticipants.slice()
                                        while (next.length < 3) next.push('')
                                        next[debateActiveSlot] = e.target.value
                                        setDebateParticipants(next)
                                    }}
                                />
                                <select
                                    className="debate-quick-select"
                                    value={debateParticipants[debateActiveSlot] || ''}
                                    onChange={e => {
                                        const v = e.target.value
                                        const next = debateParticipants.slice()
                                        while (next.length < 3) next.push('')
                                        next[debateActiveSlot] = v
                                        setDebateParticipants(next)
                                    }}
                                >
                                    <option value="">（空）</option>
                                    {debateFixedRoles.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                                <button className="btn primary" style={{ marginLeft: 0 }} onClick={async () => {
                                    const uid = userId || getOrCreateLocalUserId()
                                    setUserId(uid)
                                    const participantsToUse = debateParticipants.map(v => (v || '').trim()).filter(s => s.length > 0)
                                    if (participantsToUse.length === 0) return alert('请先选择至少一个人物')
                                    setReply(null)
                                    // robustly scroll the outer page so the user sees the live stage
                                    const scrollToDebateArea = () => {
                                        const el = debateStageRef.current
                                        if (!el) return
                                        try {
                                            const rect = el.getBoundingClientRect()
                                            const top = rect.top + window.scrollY - 24 // offset for header
                                            window.scrollTo({ top, behavior: 'smooth' })
                                        } catch (e) {
                                            try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch (_) { }
                                        }
                                    }
                                    // allow a short delay for layout then scroll
                                    try { setTimeout(scrollToDebateArea, 80) } catch (_) { scrollToDebateArea() }
                                    await runDebate(uid, debateTopic, participantsToUse)
                                }} disabled={isDebating}>{isDebating ? '进行中…' : '开始辩论'}</button>
                            </div>

                            <div style={{ marginTop: 12 }}>
                                <h3>实时辩论</h3>
                                <div className="debate-stage" ref={debateStageRef}>
                                    {selectedDebateId ? (
                                        (() => {
                                            if (liveDebate && liveDebate.id === selectedDebateId) {
                                                return liveDebate.messages.map((m, idx) => (
                                                    <div key={idx} className={`debate-bubble ${idx % 2 === 0 ? 'left' : 'right'}`}>
                                                        <div className="debate-meta">{m.speaker} · {new Date(m.ts).toLocaleTimeString()}</div>
                                                        <div className="debate-text">{m.text}</div>
                                                    </div>
                                                ))
                                            }
                                            const rec = debatesList.find(d => d.id === selectedDebateId)
                                            if (!rec) return <p className="muted">（暂无结果，开始一场辩论吧）</p>
                                            return rec.messages.map((m, idx) => (
                                                <div key={idx} className={`debate-bubble ${idx % 2 === 0 ? 'left' : 'right'}`}>
                                                    <div className="debate-meta">{m.speaker} · {new Date(m.ts).toLocaleTimeString()}</div>
                                                    <div className="debate-text">{m.text}</div>
                                                </div>
                                            ))
                                        })()
                                    ) : (
                                        <p className="muted">（开始辩论后，这里会实时显示每个气泡）</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {page === 'debateHistory' && (
                <div className="history-page">
                    <div className="history-page-header">
                        <div>
                            <h1>辩论历史</h1>
                            <div className="muted">按辩题查看本地辩论记录，并可导出或删除</div>
                        </div>
                        <div className="history-page-actions">
                            <button className="btn secondary" onClick={() => setPage('debate')}>返回人物辩论</button>
                        </div>
                    </div>

                    <div className="history-page-layout">
                        <aside className="history-sidebar-panel">
                            <div className="history-sidebar-title">辩论记录</div>
                            <div className="history-sidebar-list history-role-list">
                                {debatesList.length === 0 ? (
                                    <p className="muted">（暂无本地辩论）</p>
                                ) : (
                                    debatesList.map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={`history-role ${selectedDebateId === item.id ? 'active' : ''}`}
                                            onClick={() => setSelectedDebateId(item.id)}
                                        >
                                            <span className="history-role-name">{item.topic}</span>
                                            <span className="history-role-count">{item.messages.length} 条</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </aside>

                        <section className="history-detail-panel">
                            <div className="history-detail-header history-detail-header-side">
                                <div>
                                    <div className="muted">用户 ID: {userId}</div>
                                    <h3>{selectedDebateId || '请选择辩论'}</h3>
                                </div>
                                <div className="history-toolbar history-toolbar-side">
                                    <label className="history-export-label">
                                        <span>导出格式</span>
                                        <select value={exportFormat} onChange={e => setExportFormat(e.target.value as 'markdown' | 'txt')}>
                                            <option value="markdown">Markdown</option>
                                            <option value="txt">TXT</option>
                                        </select>
                                    </label>
                                    <button
                                        className="btn secondary"
                                        onClick={exportSelectedDebate}
                                        disabled={!selectedDebateId || !debatesList.find(d => d.id === selectedDebateId)?.messages.length}
                                    >
                                        导出当前辩论
                                    </button>
                                    <button
                                        className="btn secondary danger"
                                        onClick={() => {
                                            if (!userId || !selectedDebateId) return
                                            deleteLocalDebate(userId, selectedDebateId)
                                            refreshDebates(userId)
                                        }}
                                        disabled={!selectedDebateId}
                                    >
                                        删除当前辩论
                                    </button>
                                </div>
                            </div>

                            <div className="history-thread">
                                {!selectedDebateId ? (
                                    <p className="muted">（请选择左侧辩论查看历史）</p>
                                ) : (() => {
                                    const rec = debatesList.find(d => d.id === selectedDebateId)
                                    if (!rec) return <p className="muted">（该辩论已删除）</p>
                                    return rec.messages.length === 0 ? (
                                        <p className="muted">（该辩论暂无内容）</p>
                                    ) : rec.messages.map((m, idx) => (
                                        <div key={`${m.ts}-${idx}`} className={`debate-bubble ${idx % 2 === 0 ? 'left' : 'right'}`}>
                                            <div className="debate-meta">{m.speaker} · {new Date(m.ts).toLocaleString()}</div>
                                            <div className="debate-text">{m.text}</div>
                                        </div>
                                    ))
                                })()}
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </>
    )
}
