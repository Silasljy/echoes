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
    const [page, setPage] = useState<'chat' | 'history'>('chat')
    const [historyStore, setHistoryStore] = useState<HistoryStore>({})
    const [selectedHistoryRole, setSelectedHistoryRole] = useState('')
    const [exportFormat, setExportFormat] = useState<'markdown' | 'txt'>('markdown')

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

    return (
        <>
            {page === 'chat' && (
                <div className="app-shell chat-page">
                    <main className="main-panel">
                        <div className="container">
                            <div className="topbar">
                                <h1>Echoes — 历史人物对话</h1>
                                <button className="btn secondary" onClick={() => {
                                    const uid = userId || getOrCreateLocalUserId()
                                    const roleToShow = role === '自定义' ? (customRole || '未知人物') : role
                                    setUserId(uid)
                                    refreshHistory(uid, roleToShow)
                                    setPage('history')
                                }}>查看历史</button>
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
        </>
    )
}
