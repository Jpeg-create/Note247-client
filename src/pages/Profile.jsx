import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import styles from './Profile.module.css';

function timeAgo(dateStr) {
  const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s/86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month:'short', year:'numeric' });
}

const langColors = {
  javascript:'#f7df1e', typescript:'#3178c6', python:'#3572A5',
  html:'#e34c26', css:'#563d7c', json:'#47ffb8',
  markdown:'#69b3ff', sql:'#e38c00', rust:'#ce422b', plaintext:'#7070a0',
};

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    try {
      const res = await api.get(`/users/${username}`);
      setProfile(res.data.user);
      setDocs(res.data.documents);
    } catch (err) {
      setError(err.response?.status === 404 ? 'User not found.' : 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const copyProfileLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
    </div>
  );

  if (error) return (
    <div className={styles.errorPage}>
      <div className={styles.errorCard}>
        <div style={{ fontSize: 48 }}>👤</div>
        <h2>{error}</h2>
        <button className="btn accent" onClick={() => navigate('/')}>Go Home</button>
      </div>
    </div>
  );

  const memberDate = new Date(profile.memberSince).toLocaleDateString('en-US', { month:'long', year:'numeric' });

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link to="/" className={styles.logo}>Note<span>247</span></Link>
      </header>

      <main className={styles.main}>
        {/* Profile card */}
        <div className={styles.profileCard}>
          <div className={styles.avatar} style={{ background: profile.avatarColor || '#e8ff47' }}>
            {profile.username[0].toUpperCase()}
          </div>
          <div className={styles.profileInfo}>
            <h1 className={styles.username}>@{profile.username}</h1>
            <p className={styles.memberSince}>Member since {memberDate}</p>
          </div>
          <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={copyProfileLink}>
            {copied ? '✅ Copied!' : '🔗 Share'}
          </button>
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{docs.length}</span>
            <span className={styles.statLabel}>Public docs</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum}>
              {[...new Set(docs.map(d => d.language))].length}
            </span>
            <span className={styles.statLabel}>Languages</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum}>
              {docs.length ? timeAgo(Math.max(...docs.map(d => new Date(d.updated_at)))) : '—'}
            </span>
            <span className={styles.statLabel}>Last active</span>
          </div>
        </div>

        {/* Docs grid */}
        <div className={styles.docsSection}>
          <h2 className={styles.sectionTitle}>Public Documents</h2>
          {docs.length === 0 ? (
            <div className={styles.empty}>
              <p>No public documents yet.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {docs.map(doc => (
                <div key={doc.short_id} className={styles.docCard} onClick={() => navigate(`/s/${doc.short_id}`)}>
                  <div className={styles.docHeader}>
                    <span className={styles.docTitle}>{doc.title || 'Untitled'}</span>
                    <span className={styles.docLang} style={{ color: langColors[doc.language] || '#7070a0' }}>
                      {doc.language}
                    </span>
                  </div>
                  <div className={styles.docMeta}>
                    <span>Updated {timeAgo(doc.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <span>Note247 — the developer's editor</span>
        <Link to="/signup" className="btn sm ghost">Create free account</Link>
      </footer>
    </div>
  );
}
