import { createContext, useContext, useState, useEffect } from 'react';
import api, { getApiErrorMessage } from '../utils/api';
import {
  deriveKeyFromPassword,
  deriveKeyFromRecoveryWords,
  generateRecoveryKey,
  generateSalt,
  wrapKey,
  unwrapKey,
  setSessionKey,
  getSessionKey,
  clearSessionKey,
} from '../utils/crypto';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('nf_token');
    const savedUser = localStorage.getItem('nf_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      api.get('/auth/me')
        .then(res => setUser(res.data.user))
        .catch((err) => {
          if (err?.response?.status === 401) logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const signup = async (email, username, password) => {
    try {
      const keySalt = generateSalt();
      const recoverySalt = generateSalt();
      const encryptionKey = await deriveKeyFromPassword(password, keySalt, {
        usages: ['encrypt', 'decrypt'],
        extractable: true,
      });
      const { words: recoveryWords } = generateRecoveryKey();
      const backupKey = await deriveKeyFromRecoveryWords(recoveryWords, recoverySalt);
      const wrappedKey = await wrapKey(encryptionKey, backupKey);

      const res = await api.post('/auth/signup', {
        email, username, password, keySalt, recoverySalt, wrappedKey,
      });

      if (!res?.data?.token || !res?.data?.user) {
        throw new Error('Signup response was missing token/user data.');
      }

      localStorage.setItem('nf_token', res.data.token);
      localStorage.setItem('nf_user', JSON.stringify(res.data.user));
      setSessionKey(encryptionKey);
      setUser(res.data.user);
      return { ...res.data, recoveryWords };
    } catch (err) {
      throw new Error(getApiErrorMessage(err, 'Signup failed'));
    }
  };

  const login = async (email, password) => {
    try {
      const saltRes = await api.get(`/auth/salt?email=${encodeURIComponent(email)}`);
      const { keySalt } = saltRes.data;
      const encryptionKey = await deriveKeyFromPassword(password, keySalt, {
        usages: ['encrypt', 'decrypt'],
        extractable: true,
      });
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('nf_token', res.data.token);
      localStorage.setItem('nf_user', JSON.stringify(res.data.user));
      setSessionKey(encryptionKey);
      setUser(res.data.user);
      return res.data;
    } catch (err) {
      throw new Error(getApiErrorMessage(err, 'Login failed'));
    }
  };

  const recoverAccount = async (email, recoveryWords, newPassword) => {
    try {
      const res = await api.get(`/auth/recovery-data?email=${encodeURIComponent(email)}`);
      const { recoverySalt, wrappedKey } = res.data;
      const words = typeof recoveryWords === 'string'
        ? recoveryWords.trim().split(/[\s\-,]+/)
        : recoveryWords;
      const backupKey = await deriveKeyFromRecoveryWords(words, recoverySalt);
      let encryptionKey;
      try {
        encryptionKey = await unwrapKey(wrappedKey, backupKey);
      } catch {
        throw new Error('Invalid recovery key. Please check and try again.');
      }
      const newKeySalt = generateSalt();
      const newBackupKey = await deriveKeyFromPassword(newPassword, newKeySalt, {
        usages: ['wrapKey', 'unwrapKey'],
        extractable: true,
      });
      const newWrappedKey = await wrapKey(encryptionKey, newBackupKey);
      const updateRes = await api.post('/auth/recover', {
        email, newPassword, newKeySalt, newWrappedKey,
      });
      localStorage.setItem('nf_token', updateRes.data.token);
      localStorage.setItem('nf_user', JSON.stringify(updateRes.data.user));
      setSessionKey(encryptionKey);
      setUser(updateRes.data.user);
      return updateRes.data;
    } catch (err) {
      throw new Error(getApiErrorMessage(err, err.message || 'Recovery failed'));
    }
  };

  const logout = () => {
    localStorage.removeItem('nf_token');
    localStorage.removeItem('nf_user');
    clearSessionKey();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, getEncryptionKey: getSessionKey, login, signup, recoverAccount, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
