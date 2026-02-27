import { useState, useRef, useEffect } from 'react';
import api from '../utils/api';
import styles from './AIChatSidebar.module.css';

const ACTIONS = [
  { key: 'improve',     label: '✨ Improve writing' },
  { key: 'professional',label: '👔 Make professional' },
  { key: 'summarize',   label: '📋 Summarize' },
  { key: 'shorter',     label: '✂️ Make shorter' },
  { key: 'draft',       label: '🖊️ Generate draft' },
  { key: 'translate',   label: '🌐 Translate' },
  { key: 'fix',         label: '🐛 Fix bugs' },
  { key: 'explain',     label: '💡 Explain' },
];

export default function AIChatSidebar({ docContent, language, isDark, onClose, onInsert }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi! I'm your AI writing assistant. I can help you improve your writing, summarize notes, translate content, generate drafts, or answer questions about your document. What would you like to do?` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [rewriteMode, setRewriteMode] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [rewriteResult, setRewriteResult] = useState('');
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');
    setError('');
    const userMsg = { role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const history = newMessages.slice(1); // skip the initial greeting
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('nf_token')}`,
        },
        body: JSON.stringify({
          message: msg,
          docContent: docContent?.slice(0, 8000) || '',
          language,
          history: history.slice(-8).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'AI request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiText = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                aiText += parsed.text;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: aiText };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setError(err.message.includes('configured') ? '⚠️ AI not configured. Add ANTHROPIC_API_KEY to your server.' : err.message);
      // Remove the assistant placeholder (may be empty or partially filled)
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1);
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRewrite = async (action) => {
    const text = selectedText.trim();
    if (!text) { setError('Paste or type text to rewrite above first.'); return; }
    setRewriteLoading(true);
    setRewriteResult('');
    setError('');
    try {
      const res = await api.post('/ai/rewrite', { text, action, language });
      setRewriteResult(res.data.result);
    } catch (err) {
      setError('Rewrite failed. Try again.');
    } finally {
      setRewriteLoading(false);
    }
  };

  const renderMessage = (msg, i) => {
    const isAI = msg.role === 'assistant';
    return (
      <div key={i} className={`${styles.message} ${isAI ? styles.aiMessage : styles.userMessage}`}>
        <div className={styles.msgBubble}>
          <MessageContent content={msg.content} />
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.sidebar} ${isDark ? '' : styles.light}`}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>✨ AI Assistant</span>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${!rewriteMode ? styles.tabActive : ''}`} onClick={() => setRewriteMode(false)}>Chat</button>
          <button className={`${styles.tab} ${rewriteMode ? styles.tabActive : ''}`} onClick={() => setRewriteMode(true)}>Rewrite</button>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
      </div>

      {!rewriteMode ? (
        <>
          <div className={styles.messages}>
            {messages.map(renderMessage)}
            {loading && (
              <div className={`${styles.message} ${styles.aiMessage}`}>
                <div className={styles.msgBubble}><span className={styles.typing}>●●●</span></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.inputArea}>
            <textarea
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
              placeholder="Ask anything about your document… (Enter to send)"
              rows={2}
              disabled={loading}
            />
            <button className={`btn sm accent ${styles.sendBtn}`} onClick={sendMessage} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </>
      ) : (
        <div className={styles.rewriteArea}>
          <p className={styles.rewriteHint}>Paste code or text you want to transform:</p>
          <textarea
            className={styles.rewriteInput}
            value={selectedText}
            onChange={e => setSelectedText(e.target.value)}
            placeholder="Paste your code or text here…"
            rows={6}
          />
          <div className={styles.actionButtons}>
            {ACTIONS.map(a => (
              <button key={a.key} className="btn sm ghost" onClick={() => handleRewrite(a.key)} disabled={rewriteLoading}>
                {a.label}
              </button>
            ))}
          </div>
          {error && <div className={styles.error}>{error}</div>}
          {rewriteLoading && <div className={styles.rewriteLoading}>Thinking…</div>}
          {rewriteResult && (
            <div className={styles.rewriteResult}>
              <div className={styles.rewriteResultHeader}>
                <span>Result</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn sm ghost" onClick={() => navigator.clipboard.writeText(rewriteResult)}>Copy</button>
                  <button className="btn sm accent" onClick={() => { onInsert(rewriteResult); setRewriteResult(''); }}>Insert</button>
                </div>
              </div>
              <pre className={styles.rewriteCode}>{rewriteResult}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageContent({ content }) {
  if (!content) return <span className="typing">●●●</span>;
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lines = part.slice(3, -3).split('\n');
          const lang = lines[0];
          const code = lines.slice(1).join('\n');
          return (
            <pre key={i} className="ai-code-block">
              {lang && <span className="ai-code-lang">{lang}</span>}
              <code>{code}</code>
            </pre>
          );
        }
        return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
      })}
    </>
  );
}
