import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { encryptText, decryptText, getSessionKey } from '../utils/crypto';

/**
 * Hook that provides encrypt/decrypt functions bound to the current session key.
 * If no session key (guest or not logged in), returns content as-is.
 */
export const useEncryption = () => {
  const { user } = useAuth();

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

  const isEncryptionActive = !!(getSessionKey() && user);

  return { encrypt, decrypt, isEncryptionActive };
};
