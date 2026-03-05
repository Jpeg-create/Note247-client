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

// ── Stat card ───────────────────────────────────────────────────────────────
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

// ── Feature card ────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, featured = false, heroCard = false }) {
  const ref = useRef(null);
  const onMove = e => {
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    ref.current.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  const onLeave = () => { ref.current.style.setProperty('--mx', '50%'); ref.current.style.setProperty('--my', '50%'); };
  return (
    <div ref={ref} className={`${styles.featureCard} ${featured ? styles.featureCardFeatured : ''} ${heroCard ? styles.featureCardHero : ''}`} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className={`${styles.featureIconWrap} ${featured ? styles.featureIconFeatured : ''} ${heroCard ? styles.featureIconHero : ''}`}>{icon}</div>
      <div>
        <h3 className={styles.featureTitle}>
          {title}
          {featured && <span className={styles.featureBadge}>Zero-knowledge</span>}
        </h3>
        <p className={styles.featureDesc}>{desc}</p>
      </div>
    </div>
  );
}

// ── Animated editor preview ─────────────────────────────────────────────────
const PREVIEW_LINES = [
  { text: '# Meeting Notes — Q2 Planning', type: 'h1', delay: 0 },
  { text: '', type: 'empty', delay: 300 },
  { text: '## Goals for this quarter', type: 'h2', delay: 500 },
  { text: '- Launch the new onboarding flow', type: 'bullet', delay: 900 },
  { text: '- Hit 10k active users by June', type: 'bullet', delay: 1300 },
  { text: '- Ship mobile app v1', type: 'bullet', delay: 1700 },
  { text: '', type: 'empty', delay: 2000 },
  { text: '## Action items', type: 'h2', delay: 2200 },
  { text: '- [ ] Review designs with team', type: 'todo', delay: 2600 },
  { text: '- [x] Set up CI/CD pipeline', type: 'done', delay: 3000 },
];

function EditorPreview({ active }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [collabVisible, setCollabVisible] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;
    const timers = [];
    const T = (fn, ms) => timers.push(setTimeout(fn, ms));
    PREVIEW_LINES.forEach((_, i) => T(() => setVisibleLines(i + 1), PREVIEW_LINES[i].delay + 200));
    T(() => setCollabVisible(true), 2400);
    T(() => setAiVisible(true), 3200);
    T(() => setSavedVisible(true), 3800);
    return () => timers.forEach(clearTimeout);
  }, [active]);

  return (
    <div className={styles.previewShell}>
      {/* Title bar */}
      <div className={styles.previewTitleBar}>
        <div className={styles.previewDots}>
          <span className={styles.pdot} style={{ background: '#ff5f57' }} />
          <span className={styles.pdot} style={{ background: '#febc2e' }} />
          <span className={styles.pdot} style={{ background: '#28c840' }} />
        </div>
        <span className={styles.previewFilename}>meeting-notes.md</span>
        <span className={`${styles.previewSaved} ${savedVisible ? styles.previewSavedShow : ''}`}>✓ Saved</span>
      </div>

      {/* Toolbar */}
      <div className={styles.previewToolbar}>
        <span className={styles.previewLogo}>Note<span>247</span></span>
        <div className={styles.ptSep} />
        <span className={styles.ptBtn}>B</span>
        <span className={styles.ptBtn}><em>I</em></span>
        <span className={styles.ptBtn}>H₁</span>
        <span className={styles.ptBtn}>🔗</span>
        <div style={{ flex: 1 }} />
        <div className={`${styles.previewCollab} ${collabVisible ? styles.previewCollabShow : ''}`}>
          <div className={styles.pAvatar} style={{ background: '#47ffb822', color: '#47ffb8', borderColor: '#47ffb844' }}>A</div>
          <div className={styles.pAvatar} style={{ background: '#ff6b9d22', color: '#ff6b9d', borderColor: '#ff6b9d44' }}>M</div>
          <span className={styles.pCollabText}>2 editing</span>
        </div>
        <div className={`${styles.previewAIBtn} ${aiVisible ? styles.previewAIBtnShow : ''}`}>✨ AI</div>
      </div>

      {/* Body */}
      <div className={styles.previewBody}>
        <div className={styles.previewGutter}>
          {Array.from({ length: visibleLines }).map((_, i) => (
            <span key={i} className={styles.previewLineNum}>{i + 1}</span>
          ))}
        </div>
        <div className={styles.previewContent}>
          {PREVIEW_LINES.slice(0, visibleLines).map((line, i) => (
            <div key={i} className={`${styles.previewLine} ${styles['pline_' + line.type]}`}>
              {line.text}
              {i === visibleLines - 1 && <span className={styles.previewCaret} />}
            </div>
          ))}
          {collabVisible && (
            <div className={styles.collabCursor}>
              <div className={styles.collabCursorBar} />
              <span className={styles.collabCursorLabel}>Alex is here</span>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className={styles.previewStatus}>
        <span>Markdown</span>
        <span className={styles.pStatusSep} />
        <span>UTF-8</span>
        <div style={{ flex: 1 }} />
        <span className={styles.previewE2EE}>🔐 E2E Encrypted</span>
      </div>
    </div>
  );
}

// ── Testimonials ────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    text: "Finally a notes app that doesn't treat my data like a product. The real-time collab is buttery smooth.",
    name: 'Sarah K.', role: 'Product Designer', avatar: 'S', color: '#ff6b9d',
  },
  {
    text: "I switched from Notion for the encryption alone. The code editor with syntax highlighting is a huge bonus.",
    name: 'James R.', role: 'Backend Engineer', avatar: 'J', color: '#47ffb8',
  },
  {
    text: "My whole team uses it for shared docs now. Version history has saved us more than once.",
    name: 'Priya M.', role: 'Engineering Manager', avatar: 'P', color: '#e8ff47',
  },
];

const FEATURES_HERO = [
  {
    icon: '🔐',
    title: 'End-to-End Encrypted',
    desc: 'Your documents are encrypted in your browser before reaching our servers. We store only ciphertext — even we cannot read your notes.',
    featured: true,
  },
  {
    icon: '🤝',
    title: 'Real-time Collaboration',
    desc: 'See exactly where your teammates are editing, the moment they type. No refresh. No conflicts. Just flow.',
    heroCard: true,
  },
];

const FEATURES_SECONDARY = [
  { icon: '✍️', title: 'Rich Text & Code', desc: 'Switch between a beautiful rich text editor and a full syntax-highlighted code editor — your choice.' },
  { icon: '🔒', title: 'Password Protection', desc: 'Lock any document with a password. Your sensitive notes stay private.' },
  { icon: '🕑', title: 'Version History', desc: 'Never lose your work. Browse and restore any previous save with one click.' },
  { icon: '✨', title: 'AI Assistant', desc: 'Fix bugs, summarize, translate, or draft your first ideas — right inside the editor.' },
  { icon: '📄', title: 'PDF Export', desc: 'Export any document as a polished PDF with one click.' },
];

const STATS = [
  { icon: '📄', target: 48291, suffix: '',   label: 'Documents created', delta: '↑ 12% this week', featured: true },
  { icon: '👥', target: 3842,  suffix: '',   label: 'Active users',      delta: '↑ 8% this week' },
  { icon: '🔗', target: 127,   suffix: 'K',  label: 'Links shared',      delta: '↑ 21% this week' },
  { icon: '⚡', target: 14,    suffix: 'ms', label: 'Avg. save latency', delta: 'p99 · 38ms', deltaDown: true },
];

// ── Main ────────────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isGuest, limitReached, addGuestDoc } = useGuestSession();
  const [actionError, setActionError] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const previewRef = useRef(null);
  const [previewActive, setPreviewActive] = useState(false);

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
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    const TARGET = 'Think it. Write it.';
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
          setTimeout(() => {
            if (cancelled) return;
            setShowCursor(false);
            setLine2Visible(true);
            T(() => setSubVisible(true), 120);
            T(() => setActionsVisible(true), 240);
            T(() => { setPreviewVisible(true); setPreviewActive(true); }, 400);
            T(() => setStatsVisible(true), 600);
            [0,1,2,3].forEach(idx => {
              T(() => {
                setCardVisible(prev => { const n=[...prev]; n[idx]=true; return n; });
                if (idx === 0) setTickActive(true);
              }, 700 + idx * 80);
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

  // Intersection observer for preview section
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setPreviewActive(true);
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleNewDoc = () => {
    setActionError('');
    if (isGuest && limitReached) { navigate('/signup?reason=limit'); return; }
    setShowTemplates(true);
  };

  const handleScrollToPreview = () => {
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
          <span className={styles.snapLine} style={{ opacity: line2Visible ? 1 : 0 }}>
            Share instantly.
          </span>
        </h1>

        <p className={`${styles.heroSub} ${subVisible ? styles.show : ''}`}>
          The notes app that respects your privacy. Write anything — meeting notes,
          code snippets, ideas — collaborate live, and keep it all encrypted.
          No setup. No compromise.
        </p>

        <div className={`${styles.heroActions} ${actionsVisible ? styles.show : ''}`}>
          <button className="btn accent lg" onClick={handleNewDoc}>⚡ Start writing free</button>
          <button className={`btn ghost lg ${styles.secondaryCTA}`} onClick={handleScrollToPreview}>
            See it in action ↓
          </button>
        </div>

        {actionError && <div className="form-error" role="alert">{actionError}</div>}

        {isGuest && limitReached && (
          <p className={styles.limitNote}>
            You've used your free docs —{' '}
            <button className={styles.limitLink} onClick={() => navigate('/signup?reason=limit')}>
              create a free account
            </button>{' '}
            to continue.
          </p>
        )}
      </section>

      {/* ANIMATED PREVIEW */}
      <section ref={previewRef} className={`${styles.previewSection} ${previewVisible ? styles.previewSectionVisible : ''}`}>
        <p className={styles.statsLabel} style={{ marginBottom: 20 }}>See the editor</p>
        <EditorPreview active={previewActive} />
      </section>

      {/* STATS */}
      <section className={`${styles.statsSection} ${statsVisible ? styles.show : ''}`}>
        <p className={styles.statsLabel}>Platform stats</p>
        <div className={styles.statsGrid}>
          {STATS.map((s, i) => (
            <div key={s.label} className={`${styles.cardWrap} ${cardVisible[i] ? styles.cardVisible : ''}`}>
              <StatCard {...s} tickActive={tickActive} />
            </div>
          ))}
        </div>
      </section>

      {/* E2EE SPOTLIGHT */}
      <section className={styles.e2eeSection}>
        <div className={styles.e2eeInner}>
          <div className={styles.e2eeLeft}>
            <div className={styles.e2eePill}><span>🔐</span> End-to-End Encrypted</div>
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
              <span>🔑</span>
              Your password is the only key. Set a recovery key at signup — it's your safety net if you ever forget.
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.featuresSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>Everything you need</p>
          <h2 className={styles.sectionTitle}>
            Built for focus.<br />
            <span>Loved by teams.</span>
          </h2>
        </div>

        {/* Hero-tier features — bigger, more emphasis */}
        <div className={styles.featuresHeroGrid}>
          {FEATURES_HERO.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>

        {/* Secondary features grid */}
        <div className={styles.featuresGrid}>
          {FEATURES_SECONDARY.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className={styles.testimonialsSection}>
        <p className={styles.sectionLabel} style={{ textAlign: 'center', marginBottom: 32 }}>What people are saying</p>
        <div className={styles.testimonialsGrid}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} className={styles.testimonialCard}>
              <p className={styles.testimonialText}>"{t.text}"</p>
              <div className={styles.testimonialAuthor}>
                <div className={styles.testimonialAvatar} style={{ background: t.color + '22', color: t.color, borderColor: t.color + '55' }}>
                  {t.avatar}
                </div>
                <div>
                  <div className={styles.testimonialName}>{t.name}</div>
                  <div className={styles.testimonialRole}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER CTA BAND */}
      <section className={styles.footerCTA}>
        <div className={styles.footerCTAInner}>
          <h2 className={styles.footerCTATitle}>Your ideas deserve a safe home.</h2>
          <p className={styles.footerCTASub}>Free to start. No credit card. Encrypted from day one.</p>
          <div className={styles.footerCTAActions}>
            {user ? (
              <button className="btn accent lg" onClick={handleNewDoc}>+ New Document</button>
            ) : (
              <>
                <button className="btn accent lg" onClick={() => navigate('/signup')}>Create free account →</button>
                <button className="btn ghost lg" onClick={() => navigate('/login')}>Already have one? Log in</button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <span>Note247 © {new Date().getFullYear()}</span>
        <div className={styles.footerLinks}>
          <span className={styles.footerLink}>Privacy</span>
          <span className={styles.footerLink}>Terms</span>
        </div>
      </footer>

    </div>
    {showTemplates && (
      <TemplateModal onSelect={handleSelectTemplate} onClose={() => setShowTemplates(false)} />
    )}
    </>
  );
}
