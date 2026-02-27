import { useState, useEffect, useRef, useCallback, Component } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGuestSession } from '../hooks/useGuestSession';
import { useSocket } from '../hooks/useSocket';
import { useEncryption } from '../hooks/useEncryption';
import api from '../utils/api';
import CodeMirrorEditor from '../components/CodeMirrorEditor';
import VersionsModal from '../components/VersionsModal';
import { ShareModal, PasswordModal } from '../components/ShareModal';
import GuestLimitBanner from '../components/GuestLimitBanner';
import AIChatSidebar from '../components/AIChatSidebar';
import MarkdownPreview from '../components/MarkdownPreview';
import styles from './Editor.module.css';

const LANGS = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
];

const TABS_KEY = 'n247_tabs';

function useRelativeTime(date) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!date) { setLabel(''); return; }
    const update = () => {
      const secs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (secs < 10) setLabel('just now');
      else if (secs < 60) setLabel(`${secs}s ago`);
      else if (secs < 3600) setLabel(`${Math.floor(secs / 60)}m ago`);
      else setLabel(date.toLocaleTimeString());
    };
    update();
    const interval = setInterval(update, 15000);
    return () => clearInterval(interval);
  }, [date]);
  return label;
}

// Error Boundary — catches render crashes so users see an error instead of a black screen
class EditorErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100dvh', background: '#0d0d0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#7070a0', fontFamily: 'monospace', padding: 24 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <h2 style={{ color: '#e8e8f0' }}>Something went wrong</h2>
          <p style={{ maxWidth: 400, textAlign: 'center' }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '8px 20px', background: '#e8ff47', color: '#0d0d0f', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Editor() {
  return <EditorErrorBoundary><EditorInner /></EditorErrorBoundary>;
}

function EditorInner() {
  const { shortId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isGuest } = useGuestSession();
  const { encrypt, decrypt, isEncryptionActive } = useEncryption();
  const token = localStorage.getItem('nf_token');

  // ── State ──────────────────────────────────────────────────────────────────
  const [doc, setDoc] = useState(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('Untitled');
  const [language, setLanguage] = useState('plaintext');
  const [isDark, setIsDark] = useState(true);
  const [loading, setLoading] = useState(!!shortId);
  const [loadDocError, setLoadDocError] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [docPassword, setDocPassword] = useState('');
  const [pwInput, setPwInput] = useState('');
  const [collaborators, setCollaborators] = useState([]);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [toasts, setToasts] = useState([]);
  const [showVersions, setShowVersions] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [charCount, setCharCount] = useState(0);
  const [lineCount, setLineCount] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState('edit');
  const [showAI, setShowAI] = useState(false);
  const [tabs, setTabs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TABS_KEY) || '[]'); }
    catch { return []; }
  });

  const savedLabel = useRelativeTime(lastSaved);

  // ── Refs ───────────────────────────────────────────────────────────────────
  // Using refs for functions called inside effects avoids TDZ and stale closure issues.
  // The ref is updated every render so it always holds the latest function.
  const autoSaveTimer = useRef(null);
  const isRemoteChange = useRef(false);
  const mobileMenuRef = useRef(null);
  const doSaveRef = useRef(null);         // kept in sync below
  const contentRef = useRef(content);
  const titleRef = useRef(title);
  const languageRef = useRef(language);
  const shortIdRef = useRef(shortId);
  const docRef = useRef(doc);
  const userRef = useRef(user);

  // Keep all refs in sync with their state counterparts every render
  contentRef.current = content;
  titleRef.current = title;
  languageRef.current = language;
  shortIdRef.current = shortId;
  docRef.current = doc;
  userRef.current = user;

  // ── Socket ─────────────────────────────────────────────────────────────────
  const { connected, emitChange, emitSave } = useSocket({
    shortId: shortId || doc?.short_id,
    token, password: docPassword,
    onDocChange: async (state) => {
      if (state.content !== undefined) {
        const plain = await decrypt(state.content);
        if (plain !== contentRef.current) { isRemoteChange.current = true; setContent(plain); }
      }
      if (state.language) setLanguage(state.language);
      if (state.title) setTitle(state.title);
    },
    onCollaboratorsUpdate: setCollaborators,
    onSaveSuccess: (data) => {
      setSaveStatus('saved');
      setLastSaved(new Date(data.timestamp));
    },
  });

  // Keep emitSave in a ref too
  const emitSaveRef = useRef(emitSave);
  emitSaveRef.current = emitSave;

  // ── Callbacks ──────────────────────────────────────────────────────────────
  // ALL useCallback/function declarations before any useEffect that uses them.

  const addToast = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  // addToast ref so doSave can call it without being in dep array
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;

  const doSave = useCallback(async (saveVersion = false) => {
    const sid = shortIdRef.current || docRef.current?.short_id;
    const currentContent = contentRef.current;
    const currentTitle = titleRef.current;
    const currentLanguage = languageRef.current;

    if (!sid) {
      // No doc yet (/editor blank route) — create one
      setSaveStatus('saving');
      try {
        const encryptedContent = await encrypt(currentContent);
        const res = await api.post('/docs', { title: currentTitle, content: encryptedContent, language: currentLanguage });
        const newDoc = res.data.document;
        setDoc(newDoc);
        navigate(`/s/${newDoc.short_id}`, { replace: true });
        setSaveStatus('saved');
        setLastSaved(new Date());
        if (saveVersion) addToastRef.current('✅ Version saved!', 'success');
      } catch {
        setSaveStatus('unsaved');
        addToastRef.current('❌ Save failed', 'error');
      }
      return;
    }

    setSaveStatus('saving');
    try {
      const encryptedContent = await encrypt(currentContent);
      if (userRef.current) {
        emitSaveRef.current(saveVersion);
        await api.put(`/docs/${sid}`, { content: encryptedContent, title: currentTitle, language: currentLanguage, saveVersion });
      } else {
        await api.put(`/docs/${sid}`, { content: encryptedContent, title: currentTitle, language: currentLanguage });
      }
      setSaveStatus('saved');
      setLastSaved(new Date());
      if (saveVersion) addToastRef.current('✅ Version saved!', 'success');
    } catch {
      setSaveStatus('unsaved');
      addToastRef.current('❌ Save failed', 'error');
    }
  }, [encrypt, navigate]);

  // Keep doSave in a ref so scheduleAutoSave and keyboard handler always call the latest version
  doSaveRef.current = doSave;

  const scheduleAutoSave = useCallback(() => {
    setSaveStatus('unsaved');
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => doSaveRef.current(false), 2000);
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────
  // All effects are after all callbacks/refs, so nothing is in TDZ.

  // Persist tabs
  useEffect(() => {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  }, [tabs]);

  // Add current doc to tabs
  useEffect(() => {
    if (!shortId) return;
    setTabs(prev => {
      if (prev.find(t => t.shortId === shortId)) return prev;
      return [...prev, { shortId, title: 'Loading…', unsaved: false }];
    });
  }, [shortId]);

  // Update tab title when doc loads
  useEffect(() => {
    if (!shortId || !title) return;
    setTabs(prev => prev.map(t => t.shortId === shortId ? { ...t, title } : t));
  }, [title, shortId]);

  // Mark tab unsaved
  useEffect(() => {
    if (!shortId) return;
    setTabs(prev => prev.map(t => t.shortId === shortId ? { ...t, unsaved: saveStatus === 'unsaved' } : t));
  }, [saveStatus, shortId]);

  // Outside click closes mobile menu
  useEffect(() => {
    const handler = (e) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target))
        setMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  // Keyboard shortcuts — uses doSaveRef so no dependency on doSave, no TDZ
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        doSaveRef.current(e.shiftKey ? true : false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []); // intentionally empty — doSaveRef is always current

  // Load doc
  useEffect(() => {
    if (!shortId) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const params = docPassword ? `?password=${encodeURIComponent(docPassword)}` : '';
        const res = await api.get(`/docs/${shortId}${params}`);
        if (cancelled) return;
        const d = res.data.document;
        setDoc(d);
        const plain = await decrypt(d.content);
        if (cancelled) return;
        setContent(plain);
        setCharCount(plain.length);
        setLineCount(plain.split('\n').length);
        setTitle(d.title);
        setLanguage(d.language);
        setPasswordRequired(false);
        setLoadDocError('');
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 423 || err.response?.data?.passwordRequired) {
          setPasswordRequired(true);
        } else if (err.response?.status === 403) {
          navigate('/');
        } else if (err.response?.status === 404) {
          setLoadDocError('Document not found.');
        } else {
          setLoadDocError(err.response?.data?.error || err.message || 'Failed to load document.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [shortId, docPassword, decrypt, navigate]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleContentChange = useCallback((val) => {
    if (isRemoteChange.current) { isRemoteChange.current = false; return; }
    setContent(val);
    setCharCount(val.length);
    setLineCount(val.split('\n').length);
    emitChange({ content: val, language: languageRef.current, title: titleRef.current });
    scheduleAutoSave();
  }, [emitChange, scheduleAutoSave]);

  const handleLangChange = useCallback((lang) => {
    setLanguage(lang);
    emitChange({ content: contentRef.current, language: lang, title: titleRef.current });
    scheduleAutoSave();
  }, [emitChange, scheduleAutoSave]);

  const handleTitleChange = useCallback((t) => {
    setTitle(t);
    emitChange({ content: contentRef.current, language: languageRef.current, title: t });
    scheduleAutoSave();
  }, [emitChange, scheduleAutoSave]);

  const handleExport = useCallback(() => {
    const extMap = { javascript:'js', typescript:'ts', python:'py', html:'html', css:'css', json:'json', markdown:'md', sql:'sql', bash:'sh', java:'java', cpp:'cpp', rust:'rs', php:'php' };
    const ext = extMap[languageRef.current] || 'txt';
    const blob = new Blob([contentRef.current], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (titleRef.current || 'untitled') + '.' + ext;
    a.click();
    URL.revokeObjectURL(a.href);
    addToastRef.current('💾 Downloaded!', 'success');
    setMobileMenuOpen(false);
  }, []);

  const closeTab = useCallback((tabShortId, e) => {
    e.stopPropagation();
    setTabs(prev => {
      const tab = prev.find(t => t.shortId === tabShortId);
      if (tab?.unsaved && !window.confirm('This tab has unsaved changes. Close anyway?')) return prev;
      const remaining = prev.filter(t => t.shortId !== tabShortId);
      if (tabShortId === shortIdRef.current) {
        if (remaining.length > 0) navigate(`/s/${remaining[remaining.length - 1].shortId}`);
        else navigate(userRef.current ? '/dashboard' : '/');
      }
      return remaining;
    });
  }, [navigate]);

  const cyclePreview = useCallback(() => {
    if (languageRef.current !== 'markdown') return;
    const modes = ['edit', 'split', 'preview'];
    setPreviewMode(m => modes[(modes.indexOf(m) + 1) % modes.length]);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const statusText = { saved: savedLabel ? `Saved ${savedLabel}` : 'Saved', saving: 'Saving…', unsaved: 'Unsaved changes' };

  if (passwordRequired) {
    return (
      <div className={styles.lockScreen}>
        <div className={styles.lockCard}>
          <div className={styles.lockIcon}>🔒</div>
          <h2>Password Protected</h2>
          <p>This document requires a password to view.</p>
          <input className="form-input" type="password" placeholder="Enter password…"
            value={pwInput} onChange={e => setPwInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setDocPassword(pwInput); }} autoFocus />
          <button className="btn accent" style={{ marginTop: 8 }} onClick={() => setDocPassword(pwInput)}>Unlock</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <span>Loading…</span>
      </div>
    );
  }

  if (loadDocError) {
    return (
      <div className={styles.loading}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <span style={{ color: 'var(--text)' }}>{loadDocError}</span>
        <button className="btn accent" onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  return (
    <div className={`${styles.editorPage} ${isDark ? '' : 'light'}`}>

      {/* ── TAB BAR ── */}
      {tabs.length > 0 && (
        <div className={styles.tabBar}>
          <div className={styles.tabs}>
            {tabs.map(tab => (
              <div
                key={tab.shortId}
                className={`${styles.tab} ${tab.shortId === shortId ? styles.tabActive : ''}`}
                onClick={() => { if (tab.shortId !== shortId) navigate(`/s/${tab.shortId}`); }}
              >
                <span className={styles.tabTitle}>{tab.title || 'Untitled'}</span>
                {tab.unsaved && <span className={styles.tabDot} title="Unsaved">●</span>}
                <button className={styles.tabClose} onClick={(e) => closeTab(tab.shortId, e)} title="Close">×</button>
              </div>
            ))}
          </div>
          <button className={styles.tabNew} onClick={() => navigate('/editor')} title="New tab">＋</button>
        </div>
      )}

      {/* ── TOOLBAR ── */}
      <header className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.logoSmall} onClick={() => navigate(user ? '/dashboard' : '/')}>
            N<span>247</span>
          </div>
          <div className={styles.sep} />
          <input
            className={styles.titleInput}
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Untitled"
            spellCheck={false}
          />
        </div>

        {/* Desktop actions */}
        <div className={styles.desktopActions}>
          <select className={styles.langSelect} value={language} onChange={e => handleLangChange(e.target.value)}>
            {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <div className={styles.sep} />
          <button className="btn sm ghost" onClick={() => doSave(false)} title="Ctrl+S">💾 Save</button>
          <button className="btn sm ghost" onClick={() => doSave(true)} title="Ctrl+Shift+S">+ Version</button>
          <button className="btn sm ghost" onClick={handleExport}>↓ Export</button>
          {language === 'markdown' && (
            <button className={`btn sm ghost ${previewMode !== 'edit' ? styles.activeBtn : ''}`} onClick={cyclePreview}>
              {previewMode === 'edit' ? '👁 Preview' : previewMode === 'split' ? '✏️ Edit' : '⚡ Split'}
            </button>
          )}
          <div className="spacer" />
          {isEncryptionActive && <div className={styles.e2eeIndicator} title="E2EE active">🔐</div>}
          {collaborators.length > 0 && (
            <div className={styles.collaborators}>
              {collaborators.slice(0, 3).map(c => (
                <div key={c.socketId} className={styles.avatar} title={c.username}>
                  {c.username[0].toUpperCase()}
                </div>
              ))}
            </div>
          )}
          <div className={`${styles.connDot} ${connected ? styles.connGreen : styles.connRed}`} />
          <button className="btn sm ghost" onClick={() => setShowVersions(true)}>🕑</button>
          <button className="btn sm ghost" onClick={() => setShowPasswordModal(true)}>🔒</button>
          <button className="btn sm ghost" onClick={() => setShowShare(true)}>🔗</button>
          <button className={`btn sm ghost ${showAI ? styles.activeBtn : ''}`} onClick={() => setShowAI(v => !v)} title="AI Assistant">✨ AI</button>
          <button className="btn sm ghost" onClick={() => setIsDark(d => !d)}>{isDark ? '☀️' : '🌙'}</button>
          {!user && <button className="btn sm accent" onClick={() => navigate('/signup')}>Sign Up</button>}
        </div>

        {/* Mobile actions */}
        <div className={styles.mobileActions}>
          <div className={`${styles.connDot} ${connected ? styles.connGreen : styles.connRed}`} />
          <button className="btn sm ghost" onClick={() => doSave(false)}>💾</button>
          <button className={`btn sm ghost ${showAI ? styles.activeBtn : ''}`} onClick={() => setShowAI(v => !v)}>✨</button>
          <div className={styles.mobileMenuWrap} ref={mobileMenuRef}>
            <button className="btn sm ghost" onClick={() => setMobileMenuOpen(o => !o)}>☰</button>
            {mobileMenuOpen && (
              <div className={styles.mobileMenu}>
                <div className={styles.mobileMenuSection}>
                  <span className={styles.mobileMenuLabel}>Language</span>
                  <select className={styles.langSelect} value={language}
                    onChange={e => { handleLangChange(e.target.value); setMobileMenuOpen(false); }}
                    style={{ width: '100%', marginTop: 6 }}>
                    {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div className={styles.mobileMenuDivider} />
                {language === 'markdown' && (
                  <button className={styles.mobileMenuItem} onClick={() => { cyclePreview(); setMobileMenuOpen(false); }}>
                    👁 {previewMode === 'edit' ? 'Preview' : previewMode === 'split' ? 'Edit Only' : 'Split View'}
                  </button>
                )}
                <button className={styles.mobileMenuItem} onClick={() => { doSave(true); setMobileMenuOpen(false); }}>💾 Save Version</button>
                <button className={styles.mobileMenuItem} onClick={() => { setShowVersions(true); setMobileMenuOpen(false); }}>🕑 Version History</button>
                <button className={styles.mobileMenuItem} onClick={() => { setShowShare(true); setMobileMenuOpen(false); }}>🔗 Share Link</button>
                <button className={styles.mobileMenuItem} onClick={() => { setShowPasswordModal(true); setMobileMenuOpen(false); }}>🔒 Set Password</button>
                <button className={styles.mobileMenuItem} onClick={handleExport}>↓ Export File</button>
                <div className={styles.mobileMenuDivider} />
                <button className={styles.mobileMenuItem} onClick={() => { setIsDark(d => !d); setMobileMenuOpen(false); }}>
                  {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
                </button>
                {!user && <button className={`${styles.mobileMenuItem} ${styles.mobileMenuAccent}`} onClick={() => navigate('/signup')}>Sign Up Free →</button>}
              </div>
            )}
          </div>
        </div>
      </header>

      {isGuest && <GuestLimitBanner onSignup={() => navigate('/signup')} />}

      {/* ── MAIN AREA ── */}
      <div className={styles.mainArea}>
        <div className={`${styles.editorArea} ${showAI ? styles.editorWithSidebar : ''}`}>
          {previewMode !== 'preview' && (
            <div className={`${styles.editorPane} ${previewMode === 'split' ? styles.splitPane : ''}`}>
              <CodeMirrorEditor
                value={content}
                language={language}
                isDark={isDark}
                onChange={handleContentChange}
                onCursorChange={({ line, col }) => setCursor({ line, col })}
              />
            </div>
          )}
          {language === 'markdown' && previewMode !== 'edit' && (
            <div className={`${styles.previewPane} ${previewMode === 'split' ? styles.splitPane : ''}`}>
              <MarkdownPreview content={content} isDark={isDark} />
            </div>
          )}
        </div>

        {showAI && (
          <AIChatSidebar
            docContent={content}
            language={language}
            isDark={isDark}
            onClose={() => setShowAI(false)}
            onInsert={(text) => {
              setContent(c => c + '\n' + text);
              scheduleAutoSave();
            }}
          />
        )}
      </div>

      {/* ── STATUS BAR ── */}
      <footer className={styles.statusBar}>
        <span className={`${styles.saveStatus} ${styles[saveStatus]}`}>
          {saveStatus === 'saved' ? '●' : saveStatus === 'saving' ? '○' : '◌'} {statusText[saveStatus]}
        </span>
        <span className={styles.sep2} />
        <span className={styles.hideOnMobile}>Ln {cursor.line}, Col {cursor.col}</span>
        <span className={`${styles.sep2} ${styles.hideOnMobile}`} />
        <span className={styles.hideOnMobile}>{charCount.toLocaleString()} chars · {lineCount} lines</span>
        <div className="spacer" />
        {isEncryptionActive && <span className={styles.encryptBadge}>🔐 E2EE</span>}
        <span className={styles.sep2} />
        <span>{LANGS.find(l => l.value === language)?.label || language}</span>
        <span className={styles.sep2} />
        <span className={styles.hideOnMobile}>Ctrl+S to save</span>
      </footer>

      {/* ── MODALS ── */}
      {showVersions && (
        <VersionsModal shortId={shortId || doc?.short_id}
          onRestore={async (v) => {
            const plain = await decrypt(v.content);
            setContent(plain); setTitle(v.title); setLanguage(v.language);
            scheduleAutoSave(); setShowVersions(false); addToast('✅ Version restored');
          }}
          onClose={() => setShowVersions(false)} />
      )}
      {showShare && (
        <ShareModal shortId={shortId || doc?.short_id} title={title}
          onClose={() => setShowShare(false)} onCopy={() => addToast('🔗 Link copied!')} />
      )}
      {showPasswordModal && (
        <PasswordModal shortId={shortId || doc?.short_id} hasPassword={doc?.hasPassword}
          onClose={() => setShowPasswordModal(false)}
          onSaved={() => { addToast('🔒 Password updated'); setShowPasswordModal(false); }} />
      )}

      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}
      </div>
    </div>
  );
}
