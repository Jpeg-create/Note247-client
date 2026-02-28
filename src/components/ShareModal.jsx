import { useState, useEffect } from 'react';
import api from '../utils/api';
import { exportKeyToBase64 } from '../utils/crypto';
import styles from './Modal.module.css';

export function ShareModal({ shortId, title, docKey, onClose, onCopy }) {
  const [shareUrl, setShareUrl] = useState(`${window.location.origin}/s/${shortId}`);
  const [buildingUrl, setBuildingUrl] = useState(false);
  const [copied, setCopied] = useState(false);

  // Build the share URL: base URL + #k=BASE64_DOC_KEY (if E2EE doc)
  useEffect(() => {
    if (!docKey) return; // guest doc or pre-E2EE doc — base URL is fine
    setBuildingUrl(true);
    exportKeyToBase64(docKey)
      .then(b64 => {
        setShareUrl(`${window.location.origin}/s/${shortId}#k=${b64}`);
      })
      .catch(() => {
        // Non-fatal: URL without key still works for non-encrypted docs
      })
      .finally(() => setBuildingUrl(false));
  }, [shortId, docKey]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch {}
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
              value={buildingUrl ? 'Building secure link…' : shareUrl}
              readOnly
            />
            <button className={styles.copyBtn} onClick={copy} disabled={buildingUrl}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          {isE2EE ? (
            <div className={styles.e2eeNote}>
              <span className={styles.e2eeIcon}>🔐</span>
              <div>
                <strong>End-to-end encrypted link</strong>
                <p>
                  The decryption key is embedded in the link after <code>#k=</code>.
                  Anyone with the full URL can read this document — the key never reaches our servers.
                </p>
              </div>
            </div>
          ) : (
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
