import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchDocs();
  }, [user]);

  const fetchDocs = async () => {
    setError('');
    try {
      const res = await api.get('/docs');
      setDocs(res.data.documents);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load documents.');
    } finally {
      setLoading(false);
    }
  };

  const newDoc = async () => {
    setError('');
    try {
      const res = await api.post('/docs', { title: 'Untitled', content: '', language: 'plaintext' });
      navigate(`/s/${res.data.document.short_id}`);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not create a new document.');
    }
  };

  const deleteDoc = async (shortId) => {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    try {
      await api.delete(`/docs/${shortId}`);
      setDocs(d => d.filter(doc => doc.short_id !== shortId));
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not delete document.');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const langColors = { javascript: '#f7df1e', python: '#3572A5', html: '#e34c26', css: '#563d7c', json: '#47ffb8', plaintext: '#7070a0' };

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.logo} onClick={() => navigate('/')}>Note<span>247</span></div>
        <div className={styles.headerRight}>
          <span className={styles.username}>@{user?.username}</span>
          <button className="btn sm ghost" onClick={() => { logout(); navigate('/'); }}>Logout</button>
          <button className="btn sm accent" onClick={newDoc}>+ New</button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <h1>My Documents</h1>
          <button className="btn accent" onClick={newDoc}>+ New Document</button>
        </div>
        {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <div className={styles.empty}>Loading…</div>
        ) : docs.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📄</div>
            <h3>No documents yet</h3>
            <p>Create your first document to get started.</p>
            <button className="btn accent" onClick={newDoc}>Create Document</button>
          </div>
        ) : (
          <div className={styles.grid}>
            {docs.map(doc => (
              <div key={doc.id} className={styles.docCard} onClick={() => navigate(`/s/${doc.short_id}`)}>
                <div className={styles.docHeader}>
                  <span className={styles.docTitle}>{doc.title || 'Untitled'}</span>
                  <span className={styles.docLang} style={{ color: langColors[doc.language] || '#7070a0' }}>
                    {doc.language}
                  </span>
                </div>
                <div className={styles.docMeta}>
                  <span>Updated {formatDate(doc.updated_at)}</span>
                  {doc.is_public && <span className="badge green">Public</span>}
                </div>
                <div className={styles.docActions} onClick={e => e.stopPropagation()}>
                  <button className="btn sm ghost" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/s/${doc.short_id}`);
                  }}>🔗 Copy Link</button>
                  <button className="btn sm ghost" onClick={() => deleteDoc(doc.short_id)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
