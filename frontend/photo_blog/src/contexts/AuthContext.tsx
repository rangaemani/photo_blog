import { createContext, useContext } from 'react';
import { useAuth, type AuthState } from '../hooks/useAuth';

const AuthContext = createContext<AuthState | null>(null);

/** Provides session-based auth state to the component tree. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

/** Access auth state (user, login, logout). Must be called inside `<AuthProvider>`.
 * @returns Auth state: isAuthenticated, user, isLoading, login(), logout().
 */
export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
