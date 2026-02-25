import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';

export default function Recover() {
  const navigate = useNavigate();
  const { recoverAccount } = useAuth();
  const [step, setStep] = useState(1); // 1=email, 2=key+newpw
  const [email, setEmail] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRecover = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) { setError('Passwords do not match'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await recoverAccount(email, recoveryKey, newPassword);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || err.response?.data?.error || 'Recovery failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <Link to="/" className={styles.logo}>Note<span>247</span></Link>
        <h1 className={styles.title}>Recover Account</h1>
        <p className={styles.sub}>Use your 24-word recovery key to regain access.</p>

        <div className={styles.e2eeBadge} style={{ background: 'rgba(232,255,71,0.08)', borderColor: 'rgba(232,255,71,0.2)', color: 'var(--accent)' }}>
          ℹ️ Your notes remain intact — your recovery key unlocks them without needing your old password.
        </div>

        <form onSubmit={handleRecover}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Recovery Key (24 words)</label>
            <textarea
              className="form-input"
              placeholder="word1 word2 word3 … word24"
              value={recoveryKey}
              onChange={e => setRecoveryKey(e.target.value)}
              rows={4}
              style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 13 }}
              required
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Separate words with spaces, dashes, or commas.
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input className="form-input" type="password" placeholder="Min. 8 characters"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input className="form-input" type="password" placeholder="••••••••"
              value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn accent" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Verifying recovery key…' : 'Recover Account'}
          </button>
        </form>
        <p className={styles.switchLink}>
          Remember your password? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
