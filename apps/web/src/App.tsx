import React, { useState, useEffect } from 'react'

type LocalTurn = { user: string; assistant: string; ts: number }

export default function App() {
    const [role, setRole] = useState('孔子')
    const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:4000'
    const [input, setInput] = useState('什么是仁？')
    const [customRole, setCustomRole] = useState('')
    const [roles, setRoles] = useState<string[]>(['孔子', '孟子', '老子', '庄子', '自定义'])
    const [reply, setReply] = useState<string | null>(null)
    const [evidence, setEvidence] = useState<any>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [showHistory, setShowHistory] = useState(false)
    const [history, setHistory] = useState<LocalTurn[]>([])

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

    function loadLocalHistory(uid: string, roleName: string) {
        try {
            const raw = localStorage.getItem(localStorageKey(uid))
            if (!raw) return [] as LocalTurn[]
            const all = JSON.parse(raw || '{}') as Record<string, LocalTurn[]>
            return all[roleName] ? all[roleName].slice().reverse() : []
        } catch (e) {
            console.warn('load history failed', e)
            return [] as LocalTurn[]
        }
    }

    function saveLocalTurn(uid: string, roleName: string, turn: LocalTurn) {
        try {
            const key = localStorageKey(uid)
            const raw = localStorage.getItem(key)
            const all = raw ? JSON.parse(raw) as Record<string, LocalTurn[]> : {}
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

        // save locally
        const turn: LocalTurn = { user: input, assistant: data.reply || '', ts: Date.now() }
        saveLocalTurn(uid, roleToSend, turn)
        // refresh history view if open
        if (showHistory) setHistory(loadLocalHistory(uid, roleToSend))
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
        // reload history when role changes
        if (!userId) return
        const roleToShow = role === '自定义' ? (customRole || '未知人物') : role
        setHistory(loadLocalHistory(userId, roleToShow))
    }, [role, customRole, userId, showHistory])

    return (
        <div className="container">
            <h1>Echoes — 历史人物对话</h1>
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
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="primary" onClick={send}>发送</button>
                        <button onClick={() => {
                            const uid = userId || getOrCreateLocalUserId()
                            const roleToShow = role === '自定义' ? (customRole || '未知人物') : role
                            setUserId(uid)
                            setHistory(loadLocalHistory(uid, roleToShow))
                            setShowHistory(s => !s)
                        }}>{showHistory ? '关闭历史' : '查看历史'}</button>
                    </div>
                </div>
            </div>
            {showHistory && (
                <div className="output">
                    <h2>本地历史（仅保存在此浏览器）</h2>
                    <div className="history-panel">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="muted">用户 ID: {userId}</div>
                            <div>
                                <button onClick={() => {
                                    if (!userId) return
                                    localStorage.removeItem(`echoes.history.${userId}`)
                                    setHistory([])
                                }}>清除该用户所有本地历史</button>
                            </div>
                        </div>
                        {history.length === 0 ? (
                            <p className="muted">（无历史）</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                                {history.map((t, i) => (
                                    <div key={i} style={{ padding: 12, borderRadius: 8, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                                        <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>{new Date(t.ts).toLocaleString()}</div>
                                        <div><strong>用户：</strong> {t.user}</div>
                                        <div style={{ marginTop: 8 }}><strong>助手：</strong> {t.assistant}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
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
                                <div key={idx} className="evidence-item">
                                    <pre>{ev.text || JSON.stringify(ev)}</pre>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
