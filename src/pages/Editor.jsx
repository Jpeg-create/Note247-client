import { useState, useEffect, useRef, useCallback } from 'react';
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

export default function Editor() {
  const { shortId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isGuest } = useGuestSession();
  const { encrypt, decrypt, isEncryptionActive } = useEncryption();
  const token = localStorage.getItem('nf_token');

  const [doc, setDoc] = useState(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('Untitled');
  const [language, setLanguage] = useState('plaintext');
  const [isDark, setIsDark] = useState(true);
  const [loading, setLoading] = useState(!!shortId);
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

  const autoSaveTimer = useRef(null);
  const isRemoteChange = useRef(false);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target))
        setMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, []);

  const { connected, emitChange, emitSave } = useSocket({
    shortId: shortId || doc?.short_id,
    token, password: docPassword,
    onDocChange: async (state) => {
      if (state.content !== undefined) {
        const plain = await decrypt(state.content);
        if (plain !== content) { isRemoteChange.current = true; setContent(plain); }
      }
      if (state.language) setLanguage(state.language);
      if (state.title) setTitle(state.title);
    },
    onCollaboratorsUpdate: setCollaborators,
    onSaveSuccess: (data) => {
      setSaveStatus('saved');
      setLastSaved(new Date(data.timestamp));
      addToast('✅ Saved!', 'success');
    },
  });

  useEffect(() => {
    if (!shortId) { setLoading(false); return; }
    loadDoc();
  }, [shortId, docPassword]);

  const loadDoc = async () => {
    try {
      const params = docPassword ? `?password=${encodeURIComponent(docPassword)}` : '';
      const res = await api.get(`/docs/${shortId}${params}`);
      const d = res.data.document;
      setDoc(d);
      const plain = await decrypt(d.content);
      setContent(plain);
      setCharCount(plain.length);
      setLineCount(plain.split('\n').length);
      setTitle(d.title);
      setLanguage(d.language);
      setPasswordRequired(false);
    } catch (err) {
      if (err.response?.status === 423 || err.response?.data?.passwordRequired) {
        setPasswordRequired(true);
      } else if (err.response?.status === 403) {
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const scheduleAutoSave = useCallback(() => {
    setSaveStatus('unsaved');
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => doSave(false), 2000);
  }, []);

  const doSave = async (saveVersion = false) => {
    const sid = shortId || doc?.short_id;
    if (!sid) return;
    setSaveStatus('saving');
    try {
      const encryptedContent = await encrypt(content);
      if (user) {
        emitSave(saveVersion);
        await api.put(`/docs/${sid}`, { content: encryptedContent, title, language, saveVersion });
      } else {
        await api.put(`/docs/${sid}`, { content: encryptedContent, title, language });
      }
      setSaveStatus('saved');
      setLastSaved(new Date());
      if (saveVersion) addToast('✅ Version saved!', 'success');
    } catch {
      setSaveStatus('unsaved');
      addToast('❌ Save failed', 'error');
    }
  };

  const handleContentChange = (val) => {
    if (isRemoteChange.current) { isRemoteChange.current = false; return; }
    setContent(val);
    setCharCount(val.length);
    setLineCount(val.split('\n').length);
    emitChange({ content: val, language, title });
    scheduleAutoSave();
  };

  const handleLangChange = (lang) => {
    setLanguage(lang);
    emitChange({ content, language: lang, title });
    scheduleAutoSave();
  };

  const handleTitleChange = (t) => {
    setTitle(t);
    emitChange({ content, language, title: t });
    scheduleAutoSave();
  };

  const handleExport = () => {
    const extMap = { javascript:'js', typescript:'ts', python:'py', html:'html', css:'css', json:'json', markdown:'md', sql:'sql', bash:'sh', java:'java', cpp:'cpp', rust:'rs', php:'php' };
    const ext = extMap[language] || 'txt';
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (title || 'untitled') + '.' + ext;
    a.click();
    URL.revokeObjectURL(a.href);
    addToast('💾 Downloaded!', 'success');
    setMobileMenuOpen(false);
  };

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };

  const statusText = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved' };

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
        <span>Loading document…</span>
      </div>
    );
  }

  return (
    <div className={`${styles.editorPage} ${isDark ? '' : 'light'}`}>
      <header className={styles.toolbar}>
        {/* Left group: logo + title */}
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

        {/* Desktop only: lang + actions */}
        <div className={styles.desktopActions}>
          <select className={styles.langSelect} value={language} onChange={e => handleLangChange(e.target.value)}>
            {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <div className={styles.sep} />
          <button className="btn sm ghost" onClick={() => doSave(true)}>💾 Save</button>
          <button className="btn sm ghost" onClick={handleExport}>↓ Export</button>
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
          <div className={`${styles.connDot} ${connected ? styles.connGreen : styles.connRed}`} title={connected ? 'Connected' : 'Disconnected'} />
          <button className="btn sm ghost" onClick={() => setShowVersions(true)}>🕑 History</button>
          <button className="btn sm ghost" onClick={() => setShowPasswordModal(true)}>🔒</button>
          <button className="btn sm ghost" onClick={() => setShowShare(true)}>🔗 Share</button>
          <button className="btn sm ghost" onClick={() => setIsDark(d => !d)}>{isDark ? '☀️' : '🌙'}</button>
          {!user && <button className="btn sm accent" onClick={() => navigate('/signup')}>Sign Up</button>}
        </div>

        {/* Mobile only: save + hamburger */}
        <div className={styles.mobileActions}>
          <div className={`${styles.connDot} ${connected ? styles.connGreen : styles.connRed}`} />
          <button className="btn sm ghost" onClick={() => doSave(true)}>💾</button>
          <div className={styles.mobileMenuWrap} ref={mobileMenuRef}>
            <button className="btn sm ghost" onClick={() => setMobileMenuOpen(o => !o)} aria-label="Menu">
              ☰
            </button>
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
                <button className={styles.mobileMenuItem} onClick={() => { setShowVersions(true); setMobileMenuOpen(false); }}>🕑 Version History</button>
                <button className={styles.mobileMenuItem} onClick={() => { setShowShare(true); setMobileMenuOpen(false); }}>🔗 Share Link</button>
                <button className={styles.mobileMenuItem} onClick={() => { setShowPasswordModal(true); setMobileMenuOpen(false); }}>🔒 Set Password</button>
                <button className={styles.mobileMenuItem} onClick={handleExport}>↓ Export File</button>
                <div className={styles.mobileMenuDivider} />
                <button className={styles.mobileMenuItem} onClick={() => { setIsDark(d => !d); setMobileMenuOpen(false); }}>
                  {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
                </button>
                {!user && (
                  <button className={`${styles.mobileMenuItem} ${styles.mobileMenuAccent}`} onClick={() => navigate('/signup')}>
                    Sign Up Free →
                  </button>
                )}
                {isEncryptionActive && <div className={styles.mobileMenuE2ee}>🔐 End-to-end encrypted</div>}
              </div>
            )}
          </div>
        </div>
      </header>

      {isGuest && <GuestLimitBanner onSignup={() => navigate('/signup')} />}

      <div className={styles.editorArea}>
        <CodeMirrorEditor
          value={content} language={language} isDark={isDark}
          onChange={handleContentChange}
          onCursorChange={({ line, col }) => setCursor({ line, col })}
        />
      </div>

      <footer className={styles.statusBar}>
        <span className={`${styles.saveStatus} ${styles[saveStatus]}`}>
          {saveStatus === 'saved' && '●'} {statusText[saveStatus]}
          {lastSaved && saveStatus === 'saved' && ` · ${lastSaved.toLocaleTimeString()}`}
        </span>
        <span className={styles.sep2} />
        <span className={styles.hideOnMobile}>Ln {cursor.line}, Col {cursor.col}</span>
        <span className={`${styles.sep2} ${styles.hideOnMobile}`} />
        <span className={styles.hideOnMobile}>{charCount} chars · {lineCount} lines</span>
        <div className="spacer" />
        {isEncryptionActive && <span className={styles.encryptBadge}>🔐 E2EE</span>}
        <span className={styles.sep2} />
        <span>{LANGS.find(l => l.value === language)?.label || language}</span>
      </footer>

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
