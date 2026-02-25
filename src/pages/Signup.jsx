import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGuestSession } from '../hooks/useGuestSession';
import RecoveryKeyDisplay from '../components/RecoveryKeyDisplay';
import styles from './Auth.module.css';

export default function Signup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signup } = useAuth();
  const { clearGuestDocs } = useGuestSession();
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryWords, setRecoveryWords] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const email = form.email.trim().toLowerCase();
    const username = form.username.trim();

    if (!email) { setError('Email is required'); return; }
    if (!username) { setError('Username is required'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError('Username must be 3-20 characters and use only letters, numbers, or underscores');
      return;
    }
    setLoading(true);
    try {
      const result = await signup(email, username, form.password);
      clearGuestDocs();
      setRecoveryWords(result.recoveryWords);
    } catch (err) {
      if (err?.response?.status === 500) {
        setError('Server configuration error. Check JWT_SECRET and DATABASE_URL on the server.');
      } else {
        setError(err.response?.data?.error || 'Signup failed');
      }
    } finally {
      setLoading(false);
    }
  };

  if (recoveryWords) {
    return <RecoveryKeyDisplay words={recoveryWords} onConfirmed={() => navigate('/dashboard')} />;
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <Link to="/" className={styles.logo}>Note<span>247</span></Link>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.sub}>Free forever. End-to-end encrypted.</p>

        {params.get('reason') === 'limit' && (
          <div className={styles.limitBanner}>
            🔒 You have used all your guest documents. Create an account to keep going!
          </div>
        )}

        <div className={styles.e2eeBadge}>
          🔒 Your notes are encrypted in your browser. Not even Note247 can read them.
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com"
              value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" type="text" placeholder="cooldev42"
              value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="Min. 8 characters"
              value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input className="form-input" type="password" placeholder="••••••••"
              value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} required />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn accent" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Setting up encryption…' : 'Create Account'}
          </button>
        </form>
        <p className={styles.switchLink}>Already have an account? <Link to="/login">Sign in</Link></p>
        <p className={styles.switchLink} style={{ marginTop: 8 }}>Forgot password? <Link to="/recover">Recover with key</Link></p>
      </div>
    </div>
  );
}
