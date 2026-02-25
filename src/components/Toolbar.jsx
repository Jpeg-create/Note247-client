import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Toolbar.module.css'

const LANGUAGES = [
  'plaintext','javascript','typescript','python','html','css','json',
  'markdown','sql','bash','java','cpp','rust','php'
]

export default function Toolbar({
  title, language, saved, activeUsers, user, isOwner,
  onTitleChange, onLangChange, onSaveVersion, onShowVersions,
  onShowShare, onShowPassword, shortId
}) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(title)
  const titleRef = useRef(null)

  const handleTitleBlur = () => {
    setEditingTitle(false)
    if (titleVal.trim() !== title) onTitleChange(titleVal.trim() || 'Untitled')
  }

  return (
    <div className={styles.toolbar}>
      <Link to={user ? '/dashboard' : '/'} className={styles.logo}>N<span>247</span></Link>
      <div className={styles.sep} />

      {editingTitle ? (
        <input
          ref={titleRef}
          className={styles.titleInput}
          value={titleVal}
          onChange={e => setTitleVal(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') titleRef.current.blur() }}
          autoFocus
        />
      ) : (
        <div className={styles.title} onClick={() => { setTitleVal(title); setEditingTitle(true) }} title="Click to rename">
          {title}
        </div>
      )}

      <div className={styles.savedIndicator} title={saved ? 'All changes saved' : 'Unsaved changes'}>
        {saved ? <span className={styles.saved}>✓ Saved</span> : <span className={styles.unsaved}>● Saving…</span>}
      </div>

      <div className={styles.sep} />

      <select className={styles.langSelect} value={language} onChange={e => onLangChange(e.target.value)}>
        {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
      </select>

      <div className={styles.sep} />

      <button className={styles.btn} onClick={onShowShare} title="Share">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        <span>Share</span>
      </button>

      {user && isOwner && <>
        <button className={styles.btn} onClick={onShowVersions} title="Version History">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
          <span>History</span>
        </button>

        <button className={styles.btn} onClick={onSaveVersion} title="Save Version Snapshot">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>Save</span>
        </button>

        <button className={styles.btn} onClick={onShowPassword} title="Password Protect">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Lock</span>
        </button>
      </>}

      <div className={styles.spacer} />

      {/* Active users */}
      <div className={styles.users}>
        {activeUsers.slice(0, 5).map(u => (
          <div key={u.id} className={styles.avatar} style={{ background: u.avatarColor + '33', borderColor: u.avatarColor }} title={u.username}>
            {u.username.slice(0,1).toUpperCase()}
          </div>
        ))}
        {activeUsers.length > 5 && <div className={styles.moreUsers}>+{activeUsers.length - 5}</div>}
      </div>

      {user ? (
        <div className={styles.userMenu}>
          <div className={styles.userBadge} title={user.email}>@{user.username}</div>
          <button className={styles.btnDanger} onClick={() => { logout(); navigate('/') }}>Sign Out</button>
        </div>
      ) : (
        <div className={styles.authBtns}>
          <button className={styles.btnGhost} onClick={() => navigate('/login')}>Log In</button>
          <button className={styles.btnAccent} onClick={() => navigate('/signup')}>Sign Up</button>
        </div>
      )}
    </div>
  )
}
