import { useState, useEffect } from 'react';
import api from '../utils/api';
import { exportKeyToBase64 } from '../utils/crypto';
import styles from './Modal.module.css';

export function ShareModal({ shortId, title, docKey, onClose, onCopy }) {
  const [shareUrl, setShareUrl]   = useState('');
  const [status, setStatus]       = useState('building'); // 'building' | 'ready' | 'error'
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    if (!shortId) return;
    let cancelled = false;

    const build = async () => {
      setStatus('building');
      try {
        // ── Step 1: Mark the doc as public so anyone with the URL can fetch it.
        // The hash key (#k=...) is the real security — without it the content
        // is AES-256-GCM ciphertext and unreadable. "Public" just means the
        // server will serve the bytes; you still need the key to read them.
        await api.put(`/docs/${shortId}`, { is_public: true });

        if (cancelled) return;

        // ── Step 2: Build the URL with the decryption key in the hash.
        // The hash fragment (#) is never sent to the server by any browser.
        let url = `${window.location.origin}/s/${shortId}`;
        if (docKey) {
          const b64 = await exportKeyToBase64(docKey);
          url += `#k=${b64}`;
        }

        if (cancelled) return;
        setShareUrl(url);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        console.error('[ShareModal] failed to publish doc:', err);
        // Fallback: build URL without server call — may not work for E2EE docs
        // but at least gives the user something to copy
        let url = `${window.location.origin}/s/${shortId}`;
        if (docKey) {
          try {
            const b64 = await exportKeyToBase64(docKey);
            url += `#k=${b64}`;
          } catch { /* non-fatal */ }
        }
        setShareUrl(url);
        setStatus('error');
      }
    };

    build();
    return () => { cancelled = true; };
  }, [shortId, docKey]);

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      onCopy?.();
    } catch { /* clipboard blocked — user can select manually */ }
  };

  const isE2EE = !!docKey;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>🔗 Share Document</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <label className={styles.label}>Share Link</label>
          <div className={styles.urlRow}>
            <input
              className={styles.urlInput}
              value={status === 'building' ? 'Publishing…' : shareUrl}
              readOnly
              onFocus={e => e.target.select()}
            />
            <button
              className={styles.copyBtn}
              onClick={copy}
              disabled={status === 'building' || !shareUrl}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>

          {status === 'error' && (
            <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 8 }}>
              ⚠ Could not publish — make sure you are online. The link may not work for others.
            </p>
          )}

          {status === 'ready' && isE2EE && (
            <div className={styles.e2eeNote}>
              <span className={styles.e2eeIcon}>🔐</span>
              <div>
                <strong>End-to-end encrypted link</strong>
                <p>
                  The decryption key is embedded after <code>#k=</code> in the URL.
                  Anyone with the full link can read this document — the key never reaches our servers.
                </p>
              </div>
            </div>
          )}

          {status === 'ready' && !isE2EE && (
            <p className={styles.note}>
              Anyone with this link can view this document.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PasswordModal({ shortId, hasPassword, onClose, onSaved }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await api.put(`/docs/${shortId}/password`, { password: password || null });
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      await api.put(`/docs/${shortId}/password`, { password: null });
      onSaved?.();
    } catch (err) {
      setError('Failed to remove password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>🔒 Document Password</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <label className={styles.label}>
            {hasPassword ? 'Change Password' : 'Set Password'}
          </label>
          <input
            className={styles.urlInput}
            type="password"
            placeholder="Enter new password…"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            autoFocus
          />
          {error && <p style={{ color: 'var(--error)', marginTop: 8 }}>{error}</p>}
          <div className={styles.modalActions}>
            <button className="btn accent" onClick={handleSave} disabled={loading || !password}>
              {loading ? 'Saving…' : 'Set Password'}
            </button>
            {hasPassword && (
              <button className="btn ghost" onClick={handleRemove} disabled={loading}>
                Remove Password
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShareModal;
