import React, { useState } from 'react'

export default function App() {
    const [role, setRole] = useState('孔子')
    const [input, setInput] = useState('什么是仁？')
    const [customRole, setCustomRole] = useState('')
    const [reply, setReply] = useState<string | null>(null)
    const [evidence, setEvidence] = useState<any>(null)

    async function send() {
        setReply('加载中...')
        const roleToSend = role === '自定义' ? (customRole || '未知人物') : role
        const res = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: roleToSend, input })
        })
        const data = await res.json()
        setReply(data.reply)
        setEvidence(data.evidence)
    }

    return (
        <div className="container">
            <h1>Echoes — 历史人物对话</h1>
            <div className="controls">
                <div className="field role">
                    <label>人物</label>
                    <select value={role} onChange={e => setRole(e.target.value)}>
                        <option value="孔子">孔子</option>
                        <option value="孟子">孟子</option>
                        <option value="老子">老子</option>
                        <option value="庄子">庄子</option>
                        <option value="自定义">自定义</option>
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
                    <button className="primary" onClick={send}>发送</button>
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
                        <h3>参考</h3>
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
