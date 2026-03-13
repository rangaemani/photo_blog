import { useState, useEffect, useCallback } from 'react';
import type { User, OTPRequestResponse, OTPVerifyResponse } from '../types';
import * as api from '../api/client';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  requestOtp: (identifier: string) => Promise<OTPRequestResponse>;
  verifyOtp: (identifier: string, code: string) => Promise<OTPVerifyResponse>;
  setDisplayName: (name: string) => Promise<void>;
}

/** Manages session-based authentication state, including login/logout and current user.
 * @returns Auth state and actions including OTP methods.
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.getUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const requestOtp = useCallback(async (identifier: string) => {
    return api.requestOtp(identifier);
  }, []);

  const verifyOtp = useCallback(async (identifier: string, code: string) => {
    const res = await api.verifyOtp(identifier, code);
    if (res.ok && res.user) {
      setUser(res.user);
    }
    return res;
  }, []);

  const setDisplayName = useCallback(async (name: string) => {
    const res = await api.setDisplayName(name);
    if (res.ok && res.user) {
      setUser(res.user);
    }
  }, []);

  return {
    isAuthenticated: user !== null,
    user,
    isLoading,
    login,
    logout,
    requestOtp,
    verifyOtp,
    setDisplayName,
  };
}
