import { useGuestSession } from '../hooks/useGuestSession';
import styles from './GuestLimitBanner.module.css';

export default function GuestLimitBanner({ onSignup }) {
  const { guestDocCount, guestLimit, limitReached, remaining } = useGuestSession();

  if (!limitReached && remaining > 1) return null;

  return (
    <div className={`${styles.banner} ${limitReached ? styles.locked : styles.warning}`}>
      <span>
        {limitReached
          ? `🔒 You've used all ${guestLimit} guest documents.`
          : `⚠️ ${remaining} guest document${remaining !== 1 ? 's' : ''} remaining.`}
        {' '}Sign up for unlimited documents — it's free!
      </span>
      <button className="btn sm accent" onClick={onSignup}>Sign Up Free →</button>
    </div>
  );
}
