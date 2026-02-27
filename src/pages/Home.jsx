import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGuestSession } from '../hooks/useGuestSession';
import api, { getApiErrorMessage } from '../utils/api';
import TemplateModal from '../components/TemplateModal';
import styles from './Home.module.css';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isGuest, limitReached, remaining, addGuestDoc } = useGuestSession();
  const [actionError, setActionError] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  const handleNewDoc = () => {
    setActionError('');
    if (isGuest && limitReached) { navigate('/signup?reason=limit'); return; }
    setShowTemplates(true);
  };

  const handleSelectTemplate = async (template) => {
    setShowTemplates(false);
    setActionError('');
    try {
      const language = template.mode === 'code'
        ? (template.language || 'javascript')
        : 'richtext';
      const res = await api.post('/docs', {
        title: template.docTitle || 'Untitled',
        content: template.content || '',
        language,
        is_public: isGuest ? true : false,
      });
      const { short_id } = res.data.document;
      if (isGuest) addGuestDoc(short_id);
      navigate(`/s/${short_id}`);
    } catch (err) {
      const code = err?.response?.data?.error;
      if (code === 'GUEST_LIMIT_REACHED') { navigate('/signup?reason=limit'); return; }
      setActionError(getApiErrorMessage(err, 'Could not create a new document. Check server settings and try again.'));
    }
  };

  return (
    <div className={styles.home}>
      <nav className={styles.nav}>
        <div className={styles.logo}>Note<span>247</span></div>
        <div className={styles.navLinks}>
          {user ? (
            <>
              <button className="btn ghost" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="btn accent" onClick={handleNewDoc}>+ New Document</button>
            </>
          ) : (
            <>
              <button className="btn ghost" onClick={() => navigate('/login')}>Login</button>
              <button className="btn accent" onClick={() => navigate('/signup')}>Sign Up Free</button>
            </>
          )}
        </div>
      </nav>

      <main className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className="badge green">Live</span>
          Real-time collaboration
        </div>
        <h1 className={styles.heroTitle}>
          Write anything.<br />
          <span className={styles.heroAccent}>Share instantly.</span>
        </h1>
        <p className={styles.heroSub}>
          Notes, docs, code — all in one place. Collaborate in real‑time,<br />
          stay organized, and never lose a version. No setup required.
        </p>
        <div className={styles.heroActions}>
          <button className="btn accent lg" onClick={handleNewDoc}>✨ New Document</button>
          {isGuest && !limitReached && (
            <span className={styles.guestNote}>{remaining} free doc{remaining !== 1 ? 's' : ''} remaining as guest</span>
          )}
        </div>

        {actionError && <div className="form-error" role="alert">{actionError}</div>}

        <div className={styles.features}>
          {[
            { icon: '✍️', title: 'Rich Text & Code',        desc: 'Switch between a beautiful rich text editor and a full syntax-highlighted code editor — your choice.' },
            { icon: '🤝', title: 'Real-time Collaboration', desc: 'Work together with your team, see changes instantly from anywhere.' },
            { icon: '🔒', title: 'Password Protection',     desc: 'Lock any document with a password. Your sensitive notes stay private.' },
            { icon: '🕑', title: 'Version History',         desc: 'Never lose your work. Browse and restore any previous save.' },
            { icon: '✨', title: 'AI Assistant',            desc: 'Improve writing, summarize, translate, or generate a first draft — right inside the editor.' },
            { icon: '📄', title: 'PDF Export',              desc: 'Export any document as a polished PDF with one click.' },
          ].map(f => (
            <div className={styles.featureCard} key={f.title}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className={styles.footer}>
        <span>Note247 © {new Date().getFullYear()}</span>
        {!user && <button className="btn sm ghost" onClick={() => navigate('/signup')}>Create free account</button>}
      </footer>

      {showTemplates && (
        <TemplateModal onSelect={handleSelectTemplate} onClose={() => setShowTemplates(false)} />
      )}
    </div>
  );
}
