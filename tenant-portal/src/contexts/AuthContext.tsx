import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setToken, clearToken, tenantApi } from "@/lib/api";

interface TenantUserMe {
  id: number;
  email: string;
  lastLoginAt: string | null;
  companyName?: string;
  tenant: {
    id: number;
    name: string;
    phone: string;
    moveIn: string;
    units: Array<{
      id: number;
      number: string;
      floor: number | null;
      area: number | null;
      rent: number;
      type: string;
      property: { street: string; zip: string; city: string; name: string };
    }>;
    contracts: Array<{
      id: number;
      monthlyRent: number;
      status: string;
      startDate: string;
      endDate: string | null;
    }>;
  };
}

export interface MfaChallenge {
  requiresTwoFactor: true;
  mfaToken: string;
}

type LoginResponse =
  | { requiresTwoFactor: true; mfaToken: string }
  | { accessToken: string };

interface AuthContextValue {
  user: TenantUserMe | null;
  loading: boolean;
  login: (slug: string, email: string, password: string) => Promise<MfaChallenge | undefined>;
  logout: (slug: string) => Promise<void>;
  refetchUser: (slug: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => undefined,
  logout: async () => {},
  refetchUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [user, setUser] = useState<TenantUserMe | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: try to restore session via refresh cookie
  useEffect(() => {
    tenantApi<{ data: { accessToken: string } }>(slug, "/auth/refresh", { method: "POST" })
      .then(async (res) => {
        setToken(res.data.accessToken);
        // Immediately fetch /me so user is available before ProtectedRoute renders
        const meRes = await tenantApi<{ data: TenantUserMe }>(slug, "/me");
        setUser(meRes.data);
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const login = useCallback(async (slug: string, email: string, password: string): Promise<MfaChallenge | undefined> => {
    const res = await tenantApi<{ data: LoginResponse }>(slug, "/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if ("requiresTwoFactor" in res.data) {
      return { requiresTwoFactor: true, mfaToken: res.data.mfaToken };
    }
    setToken(res.data.accessToken);
    const meRes = await tenantApi<{ data: TenantUserMe }>(slug, "/me");
    setUser(meRes.data);
    return undefined;
  }, []);

  const logout = useCallback(async (slug: string) => {
    try {
      await tenantApi(slug, "/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    clearToken();
    setUser(null);
  }, []);

  const refetchUser = useCallback(async (slug: string) => {
    try {
      const res = await tenantApi<{ data: TenantUserMe }>(slug, "/me");
      setUser(res.data);
    } catch {
      clearToken();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}
