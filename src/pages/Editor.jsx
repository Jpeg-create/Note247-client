import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGuestSession } from '../hooks/useGuestSession';
import { useSocket } from '../hooks/useSocket';
import { useEncryption } from '../hooks/useEncryption';
import api from '../utils/api';
import CodeMirrorEditor from '../components/CodeMirrorEditor';
import VersionsModal from '../components/VersionsModal';
import { ShareModal } from '../components/ShareModal';
import { PasswordModal } from '../components/ShareModal';
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
  const { isGuest, limitReached } = useGuestSession();
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

  const autoSaveTimer = useRef(null);
  const isRemoteChange = useRef(false);

  const { connected, emitChange, emitSave } = useSocket({
    shortId: shortId || doc?.short_id,
    token,
    password: docPassword,
    onDocChange: async (state) => {
      if (state.content !== undefined) {
        // Decrypt incoming content before displaying
        const plain = await decrypt(state.content);
        if (plain !== content) {
          isRemoteChange.current = true;
          setContent(plain);
        }
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
      // Decrypt content before showing
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
      // Encrypt before sending to server
      const encryptedContent = await encrypt(content);
      if (user) {
        // Emit encrypted content over socket
        emitSave(saveVersion);
        // Also persist via REST to ensure DB is updated
        await api.put(`/docs/${sid}`, {
          content: encryptedContent,
          title,
          language,
          saveVersion,
        });
      } else {
        await api.put(`/docs/${sid}`, { content: encryptedContent, title, language });
      }
      setSaveStatus('saved');
      setLastSaved(new Date());
      if (saveVersion) addToast('✅ Version saved!', 'success');
    } catch (err) {
      setSaveStatus('unsaved');
      addToast('❌ Save failed', 'error');
    }
  };

  const handleContentChange = (val) => {
    if (isRemoteChange.current) { isRemoteChange.current = false; return; }
    setContent(val);
    setCharCount(val.length);
    setLineCount(val.split('\n').length);
    // Emit PLAINTEXT to collaborators (they decrypt with their own keys)
    // For true multi-user E2EE collab, all users would need the same shared key
    // — for now, collab docs are unencrypted (guest mode), user docs are E2EE
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
  };

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };

  const statusText = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved changes' };

  if (passwordRequired) {
    return (
      <div className={styles.lockScreen}>
        <div className={styles.lockCard}>
          <div className={styles.lockIcon}>🔒</div>
          <h2>Password Protected</h2>
          <p>This document requires a password to view.</p>
          <input className="form-input" type="password" placeholder="Enter password…"
            value={pwInput} onChange={e => setPwInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setDocPassword(pwInput); }}
            autoFocus />
          <button className="btn accent" onClick={() => setDocPassword(pwInput)}>Unlock</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}></div>
        <span>Loading document…</span>
      </div>
    );
  }

  return (
    <div className={`${styles.editorPage} ${isDark ? '' : 'light'}`}>
      <header className={styles.toolbar}>
        <div className={styles.logoSmall} onClick={() => navigate(user ? '/dashboard' : '/')}>N<span>247</span></div>
        <div className={styles.sep} />
        <input ref={null} className={styles.titleInput} value={title}
          onChange={e => handleTitleChange(e.target.value)} placeholder="Untitled" spellCheck={false} />
        <div className={styles.sep} />
        <select className={styles.langSelect} value={language} onChange={e => handleLangChange(e.target.value)}>
          {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <div className={styles.sep} />
        <button className="btn sm ghost" onClick={() => doSave(true)}>💾 Save</button>
        <button className="btn sm ghost" onClick={handleExport}>↓ Export</button>
        <div className="spacer" />

        {/* E2EE indicator */}
        {isEncryptionActive && (
          <div className={styles.e2eeIndicator} title="End-to-end encrypted">
            🔐 E2EE
          </div>
        )}

        {collaborators.length > 0 && (
          <div className={styles.collaborators}>
            {collaborators.slice(0, 4).map(c => (
              <div key={c.socketId} className={styles.avatar} title={c.username}>
                {c.username[0].toUpperCase()}
              </div>
            ))}
          </div>
        )}

        <div className={`${styles.connDot} ${connected ? styles.connGreen : styles.connRed}`}
          title={connected ? 'Connected' : 'Disconnected'} />

        <button className="btn sm ghost" onClick={() => setShowVersions(true)}>🕑 History</button>
        <button className="btn sm ghost" onClick={() => setShowPasswordModal(true)}>🔒</button>
        <button className="btn sm ghost" onClick={() => setShowShare(true)}>🔗 Share</button>
        <button className="btn sm ghost" onClick={() => setIsDark(d => !d)}>{isDark ? '☀️' : '🌙'}</button>
        {!user && <button className="btn sm accent" onClick={() => navigate('/signup')}>Sign Up</button>}
      </header>

      {isGuest && <GuestLimitBanner onSignup={() => navigate('/signup')} />}

      <div className={styles.editorArea}>
        <CodeMirrorEditor
          value={content}
          language={language}
          isDark={isDark}
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
        <span>Ln {cursor.line}, Col {cursor.col}</span>
        <span className={styles.sep2} />
        <span>{charCount} chars · {lineCount} lines</span>
        <div className="spacer" />
        {isEncryptionActive && <span style={{ color: 'var(--accent2)', fontWeight: 600 }}>🔐 Encrypted</span>}
        <span className={styles.sep2} />
        <span>{LANGS.find(l => l.value === language)?.label || language}</span>
        <span className={styles.sep2} />
        <span>UTF-8</span>
      </footer>

      {showVersions && (
        <VersionsModal shortId={shortId || doc?.short_id}
          onRestore={async (v) => {
            const plain = await decrypt(v.content);
            setContent(plain); setTitle(v.title); setLanguage(v.language);
            scheduleAutoSave(); setShowVersions(false); addToast('✅ Version restored');
          }}
          onClose={() => setShowVersions(false)}
        />
      )}
      {showShare && (
        <ShareModal shortId={shortId || doc?.short_id} title={title}
          onClose={() => setShowShare(false)}
          onCopy={() => addToast('🔗 Link copied!')}
        />
      )}
      {showPasswordModal && (
        <PasswordModal shortId={shortId || doc?.short_id} hasPassword={doc?.hasPassword}
          onClose={() => setShowPasswordModal(false)}
          onSaved={() => { addToast('🔒 Password updated'); setShowPasswordModal(false); }}
        />
      )}

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
