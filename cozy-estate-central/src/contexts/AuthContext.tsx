import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api, setToken, clearToken, ApiError } from "@/lib/api";

interface CustomRole {
  id: number;
  name: string;
  pages: string[];
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  companyId: number;
  customRole?: CustomRole | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, companyName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    api<{ data: User }>("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ data: { user: User; accessToken: string } }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(res.data.accessToken);
    setUser(res.data.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, companyName: string) => {
    const res = await api<{ data: { user: User; accessToken: string } }>("/auth/register", {
      method: "POST",
      body: { name, email, password, companyName },
    });
    setToken(res.data.accessToken);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
