import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGuestSession } from '../hooks/useGuestSession';
import styles from './Auth.module.css';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login } = useAuth();
  const { clearGuestDocs } = useGuestSession();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const email = form.email.trim().toLowerCase();
    if (!email || !form.password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    try {
      await login(email, form.password);
      clearGuestDocs();
      navigate(params.get('redirect') || '/dashboard');
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.hint ||
        err?.response?.data?.error ||
        'Login failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <Link to="/" className={styles.logo}>Note<span>247</span></Link>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.sub}>Sign in to your account</p>

        {params.get('reason') === 'limit' && (
          <div className={styles.limitBanner}>
            🔒 You've reached the guest document limit. Sign in to continue.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
            />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn accent" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className={styles.switchLink}>
          Don't have an account? <Link to="/signup">Sign up free</Link>
        </p>
      </div>
    </div>
  );
}
