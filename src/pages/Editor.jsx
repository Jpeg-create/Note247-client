import { useState, useEffect, useRef, useCallback, Component } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGuestSession } from '../hooks/useGuestSession';
import { useSocket } from '../hooks/useSocket';
import { useEncryption } from '../hooks/useEncryption';
import {
  generateDocKey, exportKeyToBase64, importKeyFromBase64,
  encryptText, decryptText, exportKeyHex, importKeyFromHex,
  getSessionKey,
} from '../utils/crypto';
import api from '../utils/api';
import CodeMirrorEditor from '../components/CodeMirrorEditor';
import RichTextEditor from '../components/RichTextEditor';
import VersionsModal from '../components/VersionsModal';
import { ShareModal, PasswordModal } from '../components/ShareModal';
import GuestLimitBanner from '../components/GuestLimitBanner';
import TemplateModal from '../components/TemplateModal';
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
  { value: 'richtext', label: 'Rich Text' },
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
  const { user, sessionKeyMissing, clearSessionKeyMissing } = useAuth();
  const { isGuest } = useGuestSession();
  const { encrypt, decrypt, isEncryptionActive } = useEncryption();
  const token = localStorage.getItem('nf_token') || null; // null for guests — socket auth skips empty strings

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
  const [showTemplates, setShowTemplates] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [docKey, setDocKey] = useState(null);   // per-document AES key
  const [prevCodeLang, setPrevCodeLang] = useState('plaintext'); // for toggling back from richtext
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
  const docKeyRef = useRef(null); // always current, safe to call from effects

  // Keep all refs in sync with their state counterparts every render
  contentRef.current = content;
  titleRef.current = title;
  languageRef.current = language;
  shortIdRef.current = shortId;
  docRef.current = doc;
  userRef.current = user;
  docKeyRef.current = docKey;

  // ── Socket ─────────────────────────────────────────────────────────────────
  const { connected, emitChange, emitSave } = useSocket({
    shortId: shortId || doc?.short_id,  // reconnects when doc loads on /editor route
    token, password: docPassword,
    onDocChange: (state) => {
      // Content arrives as plaintext (never re-encrypted over the socket).
      // fromSave=true means this was pushed after an HTTP save — always apply it.
      // Regular keystroke events: only apply if content actually changed.
      if (state.content !== undefined) {
        const isDifferent = state.content !== contentRef.current;
        if (isDifferent || state.fromSave) {
          isRemoteChange.current = true;
          setContent(state.content);
          // Don't update char/line count here — that's for the local editor only
        }
      }
      if (state.language && state.language !== languageRef.current) setLanguage(state.language);
      if (state.title && state.title !== titleRef.current) setTitle(state.title);
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

  // ── Per-document key helpers ───────────────────────────────────────────────
  // Encrypts with per-doc key; falls back to session-key encrypt for guests.
  const encryptContent = useCallback(async (plaintext) => {
    const key = docKeyRef.current;
    if (!key) return encrypt(plaintext); // guest path (no doc key)
    return encryptText(plaintext, key);
  }, [encrypt]);

  // Decrypts with per-doc key if available; falls back to session key (legacy docs).
  const decryptContent = useCallback(async (ciphertext) => {
    if (!ciphertext) return '';
    const key = docKeyRef.current;
    const looksEncrypted = /^[0-9a-f]{24,}$/i.test(ciphertext);
    if (!looksEncrypted) return ciphertext; // plain text (guest or pre-encryption doc)
    if (key) {
      try { return await decryptText(ciphertext, key); } catch (_) {}
    }
    // Fall back to session-key decrypt (legacy docs encrypted before per-doc key scheme)
    return decrypt(ciphertext);
  }, [decrypt]);

  const doSave = useCallback(async (saveVersion = false) => {
    const sid = shortIdRef.current || docRef.current?.short_id;
    const currentContent = contentRef.current;
    const currentTitle = titleRef.current;
    const currentLanguage = languageRef.current;

    // Ensure we have a per-doc key if user is logged in
    // (guests save plaintext; no docKey needed)
    let currentDocKey = docKeyRef.current;
    let encrypted_doc_key;
    if (!currentDocKey && userRef.current) {
      try {
        currentDocKey = await generateDocKey();
        setDocKey(currentDocKey);
        docKeyRef.current = currentDocKey;
      } catch { /* crypto unavailable — fall back to legacy encrypt */ }
    }
    // Wrap doc key with session key so owner can recover it later
    if (currentDocKey && userRef.current) {
      try {
        const sessionKey = getSessionKey();
        if (sessionKey) {
          const rawHex = await exportKeyHex(currentDocKey);
          encrypted_doc_key = await encryptText(rawHex, sessionKey);
        }
      } catch { /* non-fatal */ }
    }

    if (!sid) {
      setSaveStatus('saving');
      try {
        const encryptedContent = await encryptContent(currentContent);
        const res = await api.post('/docs', {
          title: currentTitle, content: encryptedContent,
          language: currentLanguage, encrypted_doc_key,
        });
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
      const encryptedContent = await encryptContent(currentContent);
      if (userRef.current) {
        emitSaveRef.current(saveVersion);
        await api.put(`/docs/${sid}`, {
          content: encryptedContent, title: currentTitle,
          language: currentLanguage, saveVersion, encrypted_doc_key,
        });
      } else {
        await api.put(`/docs/${sid}`, {
          content: encryptedContent, title: currentTitle, language: currentLanguage,
        });
      }
      setSaveStatus('saved');
      setLastSaved(new Date());
      if (saveVersion) addToastRef.current('✅ Version saved!', 'success');
    } catch {
      setSaveStatus('unsaved');
      addToastRef.current('❌ Save failed', 'error');
    }
  }, [encryptContent, navigate]);

  // Keep doSave in a ref so scheduleAutoSave and keyboard handler always call the latest version
  doSaveRef.current = doSave;

  // handleShare — ensures the doc is saved (encrypted_doc_key persisted to DB) before
  // opening the share modal. If the doc has never been saved, save it now first.
  const handleShare = useCallback(async () => {
    const currentShortId = shortIdRef.current || docRef.current?.short_id;
    const needsSave = !currentShortId || saveStatus === 'unsaved' || !docKeyRef.current;
    if (needsSave && contentRef.current) {
      try {
        await doSaveRef.current(false);
      } catch {
        // Non-fatal — open modal anyway so user can at least copy the URL
      }
    }
    setShowShare(true);
  }, [saveStatus]);

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

  // Load doc — resolves the per-document decryption key from:
  //  1. URL hash (#k=BASE64) — anyone with the share link can decrypt
  //  2. Server-returned encrypted_doc_key (owner only) — unwrapped with session key
  //  3. Legacy fallback: session-key-based decrypt (pre-per-doc-key docs)
  useEffect(() => {
    if (!shortId) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const headers = docPassword ? { 'x-doc-password': docPassword } : {};
        const res = await api.get(`/docs/${shortId}`, { headers });
        if (cancelled) return;
        const d = res.data.document;
        setDoc(d);

        // ── Resolve the doc key ─────────────────────────────────────────────
        let resolvedKey = null;

        // Priority 1: key in URL hash (share link) — works for anyone, no login needed
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const hashKeyB64 = hashParams.get('k');
        if (hashKeyB64) {
          try {
            resolvedKey = await importKeyFromBase64(hashKeyB64);
          } catch { /* malformed key in URL — fall through */ }
        }

        // Priority 2: encrypted_doc_key from server (returned for owner only)
        if (!resolvedKey && d.encrypted_doc_key) {
          try {
            const sessionKey = getSessionKey();
            if (sessionKey) {
              const rawHex = await decryptText(d.encrypted_doc_key, sessionKey);
              resolvedKey = await importKeyFromHex(rawHex);
            }
          } catch { /* session key mismatch or legacy doc — fall through */ }
        }

        if (resolvedKey) {
          setDocKey(resolvedKey);
          docKeyRef.current = resolvedKey;
        }

        // ── Decrypt content ─────────────────────────────────────────────────
        let plain = d.content || '';
        const looksEncrypted = plain && /^[0-9a-f]{48,}$/i.test(plain);

        if (looksEncrypted && resolvedKey) {
          // E2EE doc opened with hash key (share link path) or owner
          try {
            plain = await decryptText(plain, resolvedKey);
          } catch {
            // Hash key doesn't match — try legacy session-key decrypt
            try { plain = await decrypt(plain); } catch { plain = ''; }
          }
        } else if (looksEncrypted && !resolvedKey) {
          // Encrypted content but no key available (e.g. owner on a new device
          // before re-login). Try session key; if that fails show empty.
          try { plain = await decrypt(plain); } catch { plain = ''; }
        }
        // else: plaintext doc — use as-is (plain is already d.content)

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
          setLoadDocError('This document is private. Ask the owner to share the link with you.');
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
  }, [shortId, docPassword, decrypt]);

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

  const handleExportPDF = useCallback(() => {
    const title = titleRef.current || 'document';
    const lang = languageRef.current;
    const isRich = lang === 'richtext';

    // Build printable HTML
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: Georgia, serif; font-size: 13pt; line-height: 1.75; color: #111;
         max-width: 720px; margin: 40px auto; padding: 0 32px; }
  h1,h2,h3 { font-family: system-ui, sans-serif; }
  h1 { font-size: 24pt; margin-bottom: 8px; } h2 { font-size: 18pt; } h3 { font-size: 14pt; }
  pre, code { background: #f4f4f6; border-radius: 4px; font-size: 10pt; }
  pre { padding: 14px; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 11pt; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #f4f4f6; font-weight: 700; }
  hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  ul, ol { padding-left: 1.6em; }
  input[type=checkbox] { margin-right: 6px; }
  @media print { body { margin: 20px; } }
</style>
</head><body>
<h1>${title}</h1>
${isRich ? contentRef.current : `<pre><code>${contentRef.current.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`}
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => {
        win.focus();
        win.print();
        setTimeout(() => { win.close(); URL.revokeObjectURL(url); }, 1000);
      };
    } else {
      // Fallback: download as HTML
      const a = document.createElement('a');
      a.href = url; a.download = title + '.html'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    addToastRef.current('📄 PDF export opened', 'success');
    setMobileMenuOpen(false);
  }, []);

  const prevCodeLangRef = useRef(prevCodeLang);
  prevCodeLangRef.current = prevCodeLang;

  const toggleEditorMode = useCallback(() => {
    const current = languageRef.current;
    if (current === 'richtext') {
      handleLangChange(prevCodeLangRef.current || 'plaintext');
    } else {
      setPrevCodeLang(current);
      handleLangChange('richtext');
    }
  }, [handleLangChange]);

  const handleNewTabWithTemplate = useCallback(() => {
    setShowTemplates(true);
  }, []);

  const handleSelectTemplate = useCallback(async (template) => {
    setShowTemplates(false);
    const language = template.mode === 'code' ? (template.language || 'javascript') : 'richtext';
    try {
      // Generate a doc key for this new tab doc if user is logged in
      let tabDocKey = docKeyRef.current;
      if (!tabDocKey && user) {
        try { tabDocKey = await generateDocKey(); setDocKey(tabDocKey); docKeyRef.current = tabDocKey; } catch {}
      }
      const encContent = await encryptContent(template.content || '');
      const res = await api.post('/docs', { title: template.docTitle || 'Untitled', content: encContent, language });
      const newDoc = res.data.document;
      navigate(`/s/${newDoc.short_id}`);
    } catch {
      addToastRef.current('❌ Could not create document', 'error');
    }
  }, [encrypt, navigate]);

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

      {/* ── SESSION KEY MISSING BANNER (shows after page refresh for logged-in users) ── */}
      {sessionKeyMissing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#ff9944', color: '#000', padding: '10px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 14, fontWeight: 600,
        }}>
          <span>🔐 Encryption unavailable after page refresh. Re-login to restore it — your content is safe.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { window.location.href = '/login'; }}
              style={{ background: '#000', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 13 }}>
              Re-login
            </button>
            <button onClick={clearSessionKeyMissing}
              style={{ background: 'transparent', border: '1px solid #000', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 13 }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

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
          <button className={styles.tabNew} onClick={handleNewTabWithTemplate} title="New tab">＋</button>
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
          {language !== 'richtext' && (
            <>
              <select className={styles.langSelect} value={language} onChange={e => handleLangChange(e.target.value)}>
                {LANGS.filter(l => l.value !== 'richtext').map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <div className={styles.sep} />
            </>
          )}
          <button className="btn sm ghost" onClick={() => doSave(false)} title="Ctrl+S">💾 Save</button>
          <button className="btn sm ghost" onClick={() => doSave(true)} title="Ctrl+Shift+S">+ Version</button>
          <button className="btn sm ghost" onClick={handleExport}>↓ Export</button>
          <button className="btn sm ghost" onClick={handleExportPDF}>📄 PDF</button>
          <button
            className={`btn sm ghost ${language === 'richtext' ? styles.activeBtn : ''}`}
            onClick={toggleEditorMode}
            title={language === 'richtext' ? 'Switch to Code Editor' : 'Switch to Rich Text'}
          >
            {language === 'richtext' ? '</> Code' : '✍️ Rich Text'}
          </button>
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
          <button className="btn sm ghost" onClick={handleShare}>🔗</button>
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
                <button className={styles.mobileMenuItem} onClick={() => { handleShare(); setMobileMenuOpen(false); }}>🔗 Share Link</button>
                <button className={styles.mobileMenuItem} onClick={() => { setShowPasswordModal(true); setMobileMenuOpen(false); }}>🔒 Set Password</button>
                <button className={styles.mobileMenuItem} onClick={handleExport}>↓ Export File</button>
                <button className={styles.mobileMenuItem} onClick={handleExportPDF}>📄 Export as PDF</button>
                <button className={styles.mobileMenuItem} onClick={() => { toggleEditorMode(); setMobileMenuOpen(false); }}>
                  {language === 'richtext' ? '</> Switch to Code Editor' : '✍️ Switch to Rich Text'}
                </button>
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
              {language === 'richtext' ? (
                <RichTextEditor
                  value={content}
                  isDark={isDark}
                  onChange={handleContentChange}
                  onWordCount={setWordCount}
                />
              ) : (
                <CodeMirrorEditor
                  value={content}
                  language={language}
                  isDark={isDark}
                  onChange={handleContentChange}
                  onCursorChange={({ line, col }) => setCursor({ line, col })}
                />
              )}
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
        <span className={styles.hideOnMobile}>
          {language === 'richtext'
            ? `${wordCount.toLocaleString()} words`
            : `${charCount.toLocaleString()} chars · ${lineCount} lines`}
        </span>
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
            const plain = await decryptContent(v.content);
            // Batch all three state updates together to avoid unnecessary re-renders
            setContent(plain);
            setTitle(v.title);
            setLanguage(v.language);
            scheduleAutoSave(); setShowVersions(false); addToast('✅ Version restored');
          }}
          onClose={() => setShowVersions(false)} />
      )}
      {showShare && (
        <ShareModal shortId={shortId || doc?.short_id} title={title}
          docKey={docKey}
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

      {showTemplates && (
        <TemplateModal onSelect={handleSelectTemplate} onClose={() => setShowTemplates(false)} />
      )}
    </div>
  );
}
