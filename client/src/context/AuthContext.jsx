import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function bootstrap() {
    try {
      const { data } = await client.get('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { bootstrap(); }, []);

  async function login(username, password) {
    const { data } = await client.post('/auth/login', { username, password });
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await client.post('/auth/logout');
    setUser(null);
  }

  async function changePassword(currentPassword, newPassword) {
    await client.post('/auth/change-password', { currentPassword, newPassword });
    await bootstrap();
  }

  function has(perm) {
    if (!user) return false;
    const perms = user.permissions || [];
    return perms.includes('*') || perms.includes(perm);
  }

  function hasAny(...codes) { return codes.some((c) => has(c)); }

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, logout, changePassword, has, hasAny, refresh: bootstrap }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);