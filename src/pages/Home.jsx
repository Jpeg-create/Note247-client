import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGuestSession } from '../hooks/useGuestSession';
import api, { getApiErrorMessage } from '../utils/api';
import TemplateModal from '../components/TemplateModal';
import styles from './Home.module.css';

// ── Number ticker ──────────────────────────────────────────────────────────
function useTicker(target, suffix = '', active = false) {
  const [display, setDisplay] = useState('0');
  useEffect(() => {
    if (!active) return;
    const dur = 700, t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const fmt = v => Math.round(v).toLocaleString() + suffix;
    let raf;
    const tick = now => {
      const p = Math.min((now - t0) / dur, 1);
      setDisplay(fmt(target * ease(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setDisplay(fmt(target));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, suffix]);
  return display;
}

// ── Stat card with cursor spotlight ───────────────────────────────────────
function StatCard({ icon, target, suffix = '', label, delta, deltaDown = false, featured = false, tickActive = false }) {
  const val = useTicker(target, suffix, tickActive);
  const ref = useRef(null);
  const onMove = e => {
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    ref.current.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  const onLeave = () => { ref.current.style.setProperty('--mx', '50%'); ref.current.style.setProperty('--my', '50%'); };
  return (
    <div ref={ref} className={`${styles.statCard} ${featured ? styles.statFeatured : ''}`} onMouseMove={onMove} onMouseLeave={onLeave}>
      {featured && <div className={styles.glowInner} />}
      <div className={styles.statIcon}>{icon}</div>
      <span className={styles.statValue}>{val}</span>
      <div className={styles.statLabel}>{label}</div>
      <span className={`${styles.statDelta} ${deltaDown ? styles.deltaDown : ''}`}>{delta}</span>
    </div>
  );
}

// ── Feature card with cursor spotlight ────────────────────────────────────
function FeatureCard({ icon, title, desc, featured = false }) {
  const ref = useRef(null);
  const onMove = e => {
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    ref.current.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  const onLeave = () => { ref.current.style.setProperty('--mx', '50%'); ref.current.style.setProperty('--my', '50%'); };
  return (
    <div ref={ref} className={`${styles.featureCard} ${featured ? styles.featureCardFeatured : ''}`} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className={`${styles.featureIconWrap} ${featured ? styles.featureIconFeatured : ''}`}>{icon}</div>
      <h3 className={styles.featureTitle}>
        {title}
        {featured && <span className={styles.featureBadge}>Zero-knowledge</span>}
      </h3>
      <p className={styles.featureDesc}>{desc}</p>
    </div>
  );
}

const FEATURES = [
  { icon: '🔐', title: 'End-to-End Encrypted',   desc: 'Your documents are encrypted in your browser before reaching our servers. We store only ciphertext — even we cannot read your notes.', featured: true },
  { icon: '✍️', title: 'Rich Text & Code',        desc: 'Switch between a beautiful rich text editor and a full syntax-highlighted code editor — your choice.' },
  { icon: '🤝', title: 'Real-time Collaboration', desc: 'Work together with your team, see changes instantly from anywhere in the world.' },
  { icon: '🔒', title: 'Password Protection',     desc: 'Lock any document with a password. Your sensitive notes stay private.' },
  { icon: '🕑', title: 'Version History',         desc: 'Never lose your work. Browse and restore any previous save with one click.' },
  { icon: '✨', title: 'AI Assistant',            desc: 'Fix bugs, summarize, translate, or generate a first draft — right inside the editor.' },
  { icon: '📄', title: 'PDF Export',              desc: 'Export any document as a polished PDF with one click.' },
];

const STATS = [
  { icon: '📄', target: 48291, suffix: '',   label: 'Documents created', delta: '↑ 12% this week', featured: true },
  { icon: '👥', target: 3842,  suffix: '',   label: 'Active users',      delta: '↑ 8% this week' },
  { icon: '🔗', target: 127,   suffix: 'K',  label: 'Links shared',      delta: '↑ 21% this week' },
  { icon: '⚡', target: 14,    suffix: 'ms', label: 'Avg. save latency', delta: 'p99 · 38ms', deltaDown: true },
];

// ── Main component ─────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isGuest, limitReached, remaining, addGuestDoc } = useGuestSession();
  const [actionError, setActionError] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  // Animation state
  const [navVisible,     setNavVisible]     = useState(false);
  const [badgeVisible,   setBadgeVisible]   = useState(false);
  const [typedText,      setTypedText]      = useState('');
  const [showCursor,     setShowCursor]     = useState(true);
  const [line2Visible,   setLine2Visible]   = useState(false);
  const [subVisible,     setSubVisible]     = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [statsVisible,   setStatsVisible]   = useState(false);
  const [tickActive,     setTickActive]     = useState(false);
  const [cardVisible,    setCardVisible]    = useState([false, false, false, false]);

  // ── Entrance sequence ────────────────────────────────────────────────────
  useEffect(() => {
    const TARGET = 'Write anything.';
    let cancelled = false;
    const timers = [];
    const T = (fn, ms) => { const id = setTimeout(() => !cancelled && fn(), ms); timers.push(id); };

    T(() => setNavVisible(true), 50);
    T(() => setBadgeVisible(true), 180);

    T(() => {
      let i = 0;
      const type = () => {
        if (cancelled) return;
        if (i >= TARGET.length) {
          // pause then hide cursor + snap line2
          setTimeout(() => {
            if (cancelled) return;
            setShowCursor(false);
            setLine2Visible(true);
            T(() => setSubVisible(true), 120);
            T(() => setActionsVisible(true), 220);
            T(() => setStatsVisible(true), 360);
            [0, 1, 2, 3].forEach(idx => {
              T(() => {
                setCardVisible(prev => { const n=[...prev]; n[idx]=true; return n; });
                if (idx === 0) setTickActive(true);
              }, 460 + idx * 80);
            });
          }, 820);
          return;
        }
        setTypedText(TARGET.slice(0, i + 1));
        i++;
        const ch = TARGET[i - 1];
        const delay = ch === '.' ? 150 : 44 + (Math.random() - 0.5) * 16;
        setTimeout(type, delay);
      };
      type();
    }, 380);

    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, []);

  // ── Doc creation ─────────────────────────────────────────────────────────
  const handleNewDoc = () => {
    setActionError('');
    if (isGuest && limitReached) { navigate('/signup?reason=limit'); return; }
    setShowTemplates(true);
  };

  const handleSelectTemplate = async (template) => {
    setShowTemplates(false);
    setActionError('');
    try {
      const language = template.mode === 'code' ? (template.language || 'javascript') : 'richtext';
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
      setActionError(getApiErrorMessage(err, 'Could not create document.'));
    }
  };

  return (
    <>
    <div className={styles.home}>
      <div className={styles.bgRadial} aria-hidden="true" />

      {/* NAV */}
      <nav className={`${styles.nav} ${navVisible ? styles.show : ''}`}>
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

      {/* HERO */}
      <section className={styles.hero}>
        <div className={`${styles.badge} ${badgeVisible ? styles.show : ''}`}>
          <span className={styles.dot} />
          Real-time collaboration — Live
        </div>

        <h1 className={styles.heroTitle}>
          <span className={styles.typeLine}>
            {typedText}
            {showCursor && <span className={styles.cursor} aria-hidden="true">|</span>}
          </span>
          {/* "Share instantly." — no transition, just opacity toggled */}
          <span className={styles.snapLine} style={{ opacity: line2Visible ? 1 : 0 }}>
            Share instantly.
          </span>
        </h1>

        <p className={`${styles.heroSub} ${subVisible ? styles.show : ''}`}>
          Notes, docs, code — all in one place. Collaborate in real-time,
          stay organized, and never lose a version. No setup required.
        </p>

        <div className={`${styles.heroActions} ${actionsVisible ? styles.show : ''}`}>
          <button className="btn accent lg" onClick={handleNewDoc}>⚡ New Document</button>
          {isGuest && !limitReached && (
            <span className={styles.guestNote}>
              {remaining} free doc{remaining !== 1 ? 's' : ''} remaining as guest
            </span>
          )}
        </div>

        {actionError && <div className="form-error" role="alert">{actionError}</div>}
      </section>

      {/* STATS */}
      <section className={`${styles.statsSection} ${statsVisible ? styles.show : ''}`}>
        <p className={styles.statsLabel}>Platform stats</p>
        <div className={styles.statsGrid}>
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`${styles.cardWrap} ${cardVisible[i] ? styles.cardVisible : ''}`}
            >
              <StatCard {...s} tickActive={tickActive} />
            </div>
          ))}
        </div>
      </section>

      {/* E2EE SPOTLIGHT */}
      <section className={styles.e2eeSection}>
        <div className={styles.e2eeInner}>
          <div className={styles.e2eeLeft}>
            <div className={styles.e2eePill}>
              <span>🔐</span> End-to-End Encrypted
            </div>
            <h2 className={styles.e2eeTitle}>
              Your notes are yours.<br />
              <span>Not ours. Not anyone's.</span>
            </h2>
            <p className={styles.e2eeDesc}>
              Every document is encrypted in your browser using AES-256-GCM before a single byte leaves your device. Our servers only ever see ciphertext — even a full database breach exposes nothing readable.
            </p>
            <div className={styles.e2eeTechRow}>
              <span className={styles.e2eeTechChip}>AES-256-GCM</span>
              <span className={styles.e2eeTechChip}>PBKDF2</span>
              <span className={styles.e2eeTechChip}>WebCrypto API</span>
              <span className={styles.e2eeTechChip}>Recovery key</span>
            </div>
          </div>
          <div className={styles.e2eeRight}>
            <div className={styles.e2eeFlow}>
              <div className={styles.e2eeStep}>
                <div className={styles.e2eeStepIcon}>✍️</div>
                <div className={styles.e2eeStepLabel}>You write</div>
                <div className={styles.e2eeStepSub}>Plain text, in your browser</div>
              </div>
              <div className={styles.e2eeArrow}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className={styles.e2eeStep}>
                <div className={`${styles.e2eeStepIcon} ${styles.e2eeStepAccent}`}>🔑</div>
                <div className={styles.e2eeStepLabel}>Encrypted</div>
                <div className={styles.e2eeStepSub}>With your password-derived key</div>
              </div>
              <div className={styles.e2eeArrow}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className={styles.e2eeStep}>
                <div className={styles.e2eeStepIcon}>☁️</div>
                <div className={styles.e2eeStepLabel}>Stored</div>
                <div className={styles.e2eeStepSub}>Only ciphertext — unreadable</div>
              </div>
            </div>
            <div className={styles.e2eeWarning}>
              <span>⚠</span>
              Forgot your password? Your recovery key restores access. Without either, data is unrecoverable — by design.
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.featuresSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>Everything you need</p>
          <h2 className={styles.sectionTitle}>
            Built for developers.<br />
            <span>Loved by everyone.</span>
          </h2>
        </div>
        <div className={styles.featuresGrid}>
          {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <span>Note247 © {new Date().getFullYear()}</span>
        {!user && <button className="btn sm ghost" onClick={() => navigate('/signup')}>Create free account</button>}
      </footer>

    </div>
    {showTemplates && (
      <TemplateModal onSelect={handleSelectTemplate} onClose={() => setShowTemplates(false)} />
    )}
    </>
  );
}
