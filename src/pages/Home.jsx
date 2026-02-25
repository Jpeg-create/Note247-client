import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGuestSession } from '../hooks/useGuestSession';
import api from '../utils/api';
import styles from './Home.module.css';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isGuest, limitReached, remaining, addGuestDoc } = useGuestSession();

  const handleNewDoc = async () => {
    if (isGuest && limitReached) {
      navigate('/signup?reason=limit');
      return;
    }
    try {
      const res = await api.post('/docs', {
        title: 'Untitled',
        content: '',
        language: 'plaintext',
        is_public: isGuest ? true : false,
      });
      const { short_id } = res.data.document;
      if (isGuest) addGuestDoc(short_id);
      navigate(`/s/${short_id}`);
    } catch (err) {
      console.error(err);
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
          <span className="badge green">● Live</span>
          Real-time collaboration
        </div>
        <h1 className={styles.heroTitle}>
          The online editor<br />
          <span className={styles.heroAccent}>built for developers.</span>
        </h1>
        <p className={styles.heroSub}>
          Write code, take notes, and collaborate in real-time.<br />
          Syntax highlighting for 17+ languages. No setup required.
        </p>
        <div className={styles.heroActions}>
          <button className="btn accent lg" onClick={handleNewDoc}>
            {isGuest && limitReached ? '🔒 Sign up to continue' : '⚡ New Document'}
          </button>
          {isGuest && !limitReached && (
            <span className={styles.guestNote}>
              {remaining} free doc{remaining !== 1 ? 's' : ''} remaining as guest
            </span>
          )}
        </div>

        <div className={styles.features}>
          {[
            { icon: '⚡', title: 'Real-time Collaboration', desc: 'Work together with your team, see changes instantly.' },
            { icon: '🔒', title: 'Password Protection', desc: 'Lock your documents with a password.' },
            { icon: '🕑', title: 'Version History', desc: 'Never lose work — restore any previous version.' },
            { icon: '🔗', title: 'Short Share URLs', desc: 'Share docs with a clean short link.' },
            { icon: '🌓', title: 'Dark & Light Mode', desc: 'Easy on the eyes, day or night.' },
            { icon: '💾', title: 'Export Files', desc: 'Download your work in any format.' },
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
    </div>
  );
}
