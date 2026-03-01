import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSuperAdminLogin } from "@/hooks/api/useSuperAdmin";
import { useSuperAdminAuth } from "@/contexts/SuperAdminContext";

export default function SuperAdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useSuperAdminAuth();
  const navigate = useNavigate();
  const mutation = useSuperAdminLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await mutation.mutateAsync(password);
      login(res.data.token);
      navigate("/superadmin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falsches Passwort");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm border border-border/60 shadow-sm">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <Shield className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-xl">Superadmin</CardTitle>
          <p className="text-sm text-muted-foreground">Nur für interne Verwaltung</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Master-Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Einloggen
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
