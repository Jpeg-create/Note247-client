import { useState } from 'react';
import styles from './RecoveryKeyDisplay.module.css';

export default function RecoveryKeyDisplay({ words, onConfirmed }) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [copyError, setCopyError] = useState('');

  const phrase = words.join(' ');

  const copyToClipboard = async () => {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      setCopyError('Clipboard is blocked in this browser tab. Download the key file instead.');
    }
  };

  const downloadKey = () => {
    const content = [
      'Note247 Recovery Key',
      '======================',
      '',
      'Keep this file safe. This is the ONLY way to recover your account',
      'if you forget your password. Store it somewhere secure.',
      '',
      'Recovery Key (24 words):',
      '',
      phrase,
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      'DO NOT share this with anyone, including Note247 support.',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'note247-recovery-key.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    setDownloaded(true);
  };

  const canContinue = confirmed && (copied || downloaded);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon}>KEY</div>
        <h2 className={styles.title}>Save Your Recovery Key</h2>
        <p className={styles.subtitle}>
          This is the <strong>only way</strong> to recover your account if you forget your password.
          It will <strong>never be shown again</strong>.
        </p>

        <div className={styles.warningBox}>
          Warning: Note247 uses end-to-end encryption. We <strong>cannot</strong> recover your notes
          without this key. Store it somewhere safe like a password manager, printed paper, or encrypted drive.
        </div>

        <div className={styles.wordGrid}>
          {words.map((word, i) => (
            <div key={i} className={styles.word}>
              <span className={styles.wordNum}>{i + 1}</span>
              <span className={styles.wordText}>{word}</span>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button className="btn" onClick={copyToClipboard}>
            {copied ? 'Copied' : 'Copy to Clipboard'}
          </button>
          <button className="btn accent" onClick={downloadKey}>
            {downloaded ? 'Downloaded' : 'Download Key File'}
          </button>
        </div>

        {copyError ? <p className="form-error">{copyError}</p> : null}

        <label className={styles.confirmRow}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
          />
          <span>I have saved my recovery key in a safe place</span>
        </label>

        <button
          className="btn accent lg"
          style={{ width: '100%', marginTop: 8 }}
          disabled={!canContinue}
          onClick={onConfirmed}
        >
          Continue to Dashboard
        </button>

        {!canContinue ? (
          <p className={styles.hint}>
            Copy or download your recovery key before continuing.
          </p>
        ) : null}
      </div>
    </div>
  );
}
