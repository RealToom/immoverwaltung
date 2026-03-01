import { createContext, useContext, useState, type ReactNode } from "react";

interface SuperAdminContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const SuperAdminContext = createContext<SuperAdminContextType | null>(null);
const STORAGE_KEY = "superadmin_token";

export function SuperAdminProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  const login = (t: string) => {
    localStorage.setItem(STORAGE_KEY, t);
    setToken(t);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  };

  return (
    <SuperAdminContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
      {children}
    </SuperAdminContext.Provider>
  );
}

export function useSuperAdminAuth() {
  const ctx = useContext(SuperAdminContext);
  if (!ctx) throw new Error("useSuperAdminAuth must be used within SuperAdminProvider");
  return ctx;
}
