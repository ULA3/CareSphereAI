'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthCtx { isAuthed: boolean; login: (email: string, pass: string) => boolean; logout: () => void; }
const AuthContext = createContext<AuthCtx>({ isAuthed: false, login: () => false, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // check cookie on mount
    setIsAuthed(document.cookie.includes('cs_auth=1'));
  }, []);

  const login = (email: string, pass: string): boolean => {
    if (email === 'admin@caresphere.my' && pass === 'demo2030') {
      document.cookie = 'cs_auth=1; max-age=86400; path=/';
      setIsAuthed(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    document.cookie = 'cs_auth=; max-age=0; path=/';
    setIsAuthed(false);
    router.push('/login');
  };

  return <AuthContext.Provider value={{ isAuthed, login, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
