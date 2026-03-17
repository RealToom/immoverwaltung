import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api, setToken, clearToken } from "@/lib/api";
import type { CustomRole } from "@/lib/permissions";
import type { BillingStatus } from "@/hooks/api/useBilling";

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
  billing: BillingStatus | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, companyName: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchBilling: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBilling = useCallback(async (): Promise<BillingStatus | null> => {
    try {
      const res = await api<{ data: BillingStatus }>("/billing/status");
      return res.data;
    } catch {
      return null;
    }
  }, []);

  // Fetch user + billing in parallel on mount
  useEffect(() => {
    Promise.all([
      api<{ data: User }>("/auth/me").catch(() => null),
      fetchBilling(),
    ]).then(([userRes, billingRes]) => {
      if (userRes) {
        setUser(userRes.data);
        setBilling(billingRes);
      } else {
        clearToken();
        setUser(null);
        setBilling(null);
      }
    }).finally(() => setIsLoading(false));
  }, [fetchBilling]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ data: { user: User; accessToken: string } }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(res.data.accessToken);
    setUser(res.data.user);
    const billingRes = await fetchBilling();
    setBilling(billingRes);
  }, [fetchBilling]);

  const register = useCallback(async (name: string, email: string, password: string, companyName: string) => {
    const res = await api<{ data: { user: User; accessToken: string } }>("/auth/register", {
      method: "POST",
      body: { name, email, password, companyName },
    });
    setToken(res.data.accessToken);
    setUser(res.data.user);
    const billingRes = await fetchBilling();
    setBilling(billingRes);
  }, [fetchBilling]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    clearToken();
    setUser(null);
    setBilling(null);
  }, []);

  const refetchBilling = useCallback(async () => {
    const billingRes = await fetchBilling();
    setBilling(billingRes);
  }, [fetchBilling]);

  return (
    <AuthContext.Provider value={{
      user,
      billing,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      refetchBilling,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
