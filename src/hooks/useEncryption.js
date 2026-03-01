import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { encryptText, decryptText, getSessionKey, setSessionKey as _setSessionKey } from '../utils/crypto';

/**
 * Hook that provides encrypt/decrypt functions bound to the current session key.
 * isEncryptionActive is reactive — updates when the session key is set after login.
 */
export const useEncryption = () => {
  const { user } = useAuth();
  // Track session key reactively so isEncryptionActive updates after login/logout
  const [hasKey, setHasKey] = useState(() => !!getSessionKey());

  useEffect(() => {
    // Re-check whenever user changes (login/logout)
    setHasKey(!!getSessionKey());
  }, [user]);

  const encrypt = useCallback(async (plaintext) => {
    const key = getSessionKey();
    if (!key || !user) return plaintext; // guests: no encryption
    try {
      return await encryptText(plaintext, key);
    } catch (err) {
      console.error('Encryption failed:', err);
      throw new Error('Encryption failed. Please reload and try again.');
    }
  }, [user]);

  const decrypt = useCallback(async (ciphertext) => {
    if (!ciphertext) return '';
    const key = getSessionKey();
    if (!key || !user) return ciphertext; // guests: no decryption needed
    // Detect if content is encrypted (hex string, min 24 chars for IV)
    if (!/^[0-9a-f]{24,}$/i.test(ciphertext)) {
      return ciphertext; // not encrypted (legacy or guest content)
    }
    try {
      return await decryptText(ciphertext, key);
    } catch (err) {
      // Could be a doc from before encryption was enabled, or wrong key
      console.warn('Decryption failed — returning raw content');
      return ciphertext;
    }
  }, [user]);

  const isEncryptionActive = !!(hasKey && user);

  return { encrypt, decrypt, isEncryptionActive };
};
