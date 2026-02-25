import { useState } from 'react'
import styles from './Modal.module.css'

export default function PasswordModal({ hasPassword, onClose, onSave }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')

  const handleSave = () => {
    if (pw && pw !== pw2) { setError('Passwords do not match'); return }
    if (pw && pw.length < 4) { setError('Minimum 4 characters'); return }
    onSave(pw)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>🔒 Password Protection</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          {hasPassword && <p className={styles.note}>This document currently has a password set.</p>}
          <label className={styles.label}>New Password</label>
          <input className={styles.input} type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Enter new password…" />
          <label className={styles.label} style={{ marginTop: 14 }}>Confirm Password</label>
          <input className={styles.input} type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Confirm…" />
          {error && <p className={styles.error}>{error}</p>}
          <p className={styles.note} style={{ marginTop: 12 }}>Leave blank to remove password protection.</p>
          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.saveBtn} onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}