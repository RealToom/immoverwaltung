import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/lib/api";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading, refetchUser } = useAuth();
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) { setChecked(true); return; }

    const token = getToken();
    if (token && slug && !user) {
      setChecking(true);
      refetchUser(slug).finally(() => {
        setChecking(false);
        setChecked(true);
      });
    } else {
      setChecked(true);
    }
  }, [loading, user, slug, refetchUser]);

  if (loading || checking || !checked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/${slug}/login`} replace />;
  }

  return <>{children}</>;
}
