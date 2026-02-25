import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const GUEST_LIMIT = parseInt(import.meta.env.VITE_GUEST_DOC_LIMIT || '3');
const STORAGE_KEY = 'nf_guest_docs';

export const useGuestSession = () => {
  const { user } = useAuth();
  const [guestDocs, setGuestDocs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  });

  const isGuest = !user;
  const guestDocCount = guestDocs.length;
  const limitReached = isGuest && guestDocCount >= GUEST_LIMIT;
  const remaining = Math.max(0, GUEST_LIMIT - guestDocCount);

  const addGuestDoc = (shortId) => {
    if (!isGuest) return;
    const updated = [...new Set([...guestDocs, shortId])];
    setGuestDocs(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const clearGuestDocs = () => {
    setGuestDocs([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    isGuest,
    guestDocCount,
    guestLimit: GUEST_LIMIT,
    limitReached,
    remaining,
    addGuestDoc,
    clearGuestDocs,
  };
};
