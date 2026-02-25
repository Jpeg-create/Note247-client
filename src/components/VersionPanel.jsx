import { useEffect, useState } from 'react'
import api from '../utils/api'
import { formatDistanceToNow } from 'date-fns'
import styles from './VersionPanel.module.css'

export default function VersionPanel({ shortId, onRestore, onClose }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    api.get(`/docs/${shortId}/versions`)
      .then(r => setVersions(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [shortId])

  const handleSelect = async (v) => {
    setSelected(v.id)
    const { data } = await api.get(`/docs/${shortId}/versions/${v.id}`)
    setPreview(data)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Version History</h3>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading…</div>
      ) : versions.length === 0 ? (
        <div className={styles.empty}>No versions saved yet.</div>
      ) : (
        <div className={styles.list}>
          {versions.map(v => (
            <div
              key={v.id}
              className={styles.item + (selected === v.id ? ' ' + styles.itemActive : '')}
              onClick={() => handleSelect(v)}
            >
              <div className={styles.itemTop}>
                <span className={styles.itemTitle}>{v.title || 'Untitled'}</span>
                <span className={styles.itemChars}>{v.content_length} chars</span>
              </div>
              <div className={styles.itemMeta}>
                <span>{v.saved_by_name || 'Unknown'}</span>
                <span>{formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}</span>
              </div>
              {selected === v.id && preview && (
                <div className={styles.previewBox}>
                  <pre>{preview.content.slice(0, 200)}{preview.content.length > 200 ? '…' : ''}</pre>
                  <button className={styles.restoreBtn} onClick={() => onRestore(preview.content, preview.title)}>
                    Restore this version
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
