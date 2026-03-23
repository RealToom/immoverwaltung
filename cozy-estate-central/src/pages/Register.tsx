import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Eye, EyeOff, Mail, Lock, User, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    name: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.name || !form.email || !form.password) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }
    setIsSubmitting(true);
    try {
      await register(form.name, form.email, form.password, form.companyName);
      toast.success("Konto erstellt — willkommen bei ImmoHub!");
      navigate("/");
    } catch (err: unknown) {
      const apiError = err as any;
      if (apiError.status === 409) {
        toast.error("Diese E-Mail-Adresse ist bereits registriert");
      } else {
        toast.error(err instanceof Error ? err.message : "Registrierung fehlgeschlagen");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">ImmoHub</h1>
            <p className="text-sm text-muted-foreground">14 Tage kostenlos testen — keine Kreditkarte</p>
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="company">Firmenname</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="company" placeholder="Mustermann Hausverwaltung GmbH" className="pl-10"
                    value={form.companyName} onChange={field("companyName")} autoFocus />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Ihr Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="name" placeholder="Max Mustermann" className="pl-10"
                    value={form.name} onChange={field("name")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="max@firma.de" className="pl-10"
                    value={form.email} onChange={field("email")} autoComplete="email" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 Zeichen, Groß-/Kleinbuchstaben + Zahl" className="pl-10 pr-10"
                    value={form.password} onChange={field("password")} autoComplete="new-password" />
                  <button type="button" tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Konto wird erstellt..." : "Kostenlos starten"}
              </Button>
            </CardContent>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Bereits registriert?{" "}
          <a href="/login" className="underline hover:text-foreground">Jetzt anmelden</a>
        </p>
        <p className="text-center text-xs text-muted-foreground">
          <a href="/landing" className="hover:text-foreground">Zurück zur Startseite</a>
        </p>
      </div>
    </div>
  );
};

export default Register;
