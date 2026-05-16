import React, { useState } from 'react'

export default function App() {
    const [role, setRole] = useState('孔子')
    const [input, setInput] = useState('什么是仁？')
    const [reply, setReply] = useState<string | null>(null)
    const [evidence, setEvidence] = useState<any>(null)

    async function send() {
        setReply('加载中...')
        const res = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, input })
        })
        const data = await res.json()
        setReply(data.reply)
        setEvidence(data.evidence)
    }

    return (
        <div className="container">
            <h1>Echoes — 历史人物对话</h1>
            <div className="controls">
                <div className="field">
                    <label>人物</label>
                    <input value={role} onChange={e => setRole(e.target.value)} />
                </div>
                <div className="field grow">
                    <label>问题</label>
                    <input value={input} onChange={e => setInput(e.target.value)} />
                </div>
                <div className="field">
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
