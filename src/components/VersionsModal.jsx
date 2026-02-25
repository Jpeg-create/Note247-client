import { useState, useEffect } from 'react';
import api from '../utils/api';
import styles from './Modal.module.css';

export default function VersionsModal({ shortId, onRestore, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    api.get(`/docs/${shortId}/versions`)
      .then(res => setVersions(res.data.versions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shortId]);

  const loadPreview = async (v) => {
    try {
      const res = await api.get(`/docs/${shortId}/versions/${v.id}`);
      setPreview(res.data.version);
    } catch (err) { console.error(err); }
  };

  const formatDate = (d) => new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ width: 600 }} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>🕑 Version History</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          {loading ? (
            <p style={{ color: 'var(--text-dim)' }}>Loading versions…</p>
          ) : versions.length === 0 ? (
            <p style={{ color: 'var(--text-dim)' }}>No saved versions yet. Click "💾 Save" to create a snapshot.</p>
          ) : (
            <div className={styles.versionList}>
              {versions.map(v => (
                <div
                  key={v.id}
                  className={`${styles.versionItem} ${preview?.id === v.id ? styles.active : ''}`}
                  onClick={() => loadPreview(v)}
                >
                  <div>
                    <div className={styles.versionTitle}>{v.title}</div>
                    <div className={styles.versionMeta}>
                      {formatDate(v.created_at)} · by {v.saved_by || 'unknown'} · {v.language}
                    </div>
                  </div>
                  <button
                    className="btn sm accent"
                    onClick={(e) => { e.stopPropagation(); onRestore(preview || v); }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
          {preview && (
            <div className={styles.previewBox}>
              <div className={styles.previewLabel}>Preview</div>
              <pre className={styles.previewContent}>
                {preview.content.slice(0, 500)}{preview.content.length > 500 ? '\n…' : ''}
              </pre>
            </div>
          )}
        </div>
        <div className={styles.modalActions}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
