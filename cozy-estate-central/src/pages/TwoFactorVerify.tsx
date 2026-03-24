import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { OTPInput } from "input-otp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useVerify2FA } from "@/hooks/api/useTwoFactor";

export default function TwoFactorVerify() {
  const navigate = useNavigate();
  const { mfaToken, clearMfaTokens, finalizeLogin } = useAuth();
  const [otp, setOtp] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const verify = useVerify2FA(mfaToken ?? "");

  // Redirect to login if no mfaToken (e.g. direct navigation)
  if (!mfaToken) {
    navigate("/login");
    return null;
  }

  const handleVerify = async () => {
    const code = useBackup ? backupCode.toUpperCase() : otp;
    if (!code || (!useBackup && code.length < 6)) {
      toast.error("Bitte Code eingeben");
      return;
    }
    try {
      const result = await verify.mutateAsync(code);
      await finalizeLogin(result.accessToken);
      clearMfaTokens();
      toast.success("Erfolgreich angemeldet!");
      navigate("/");
    } catch {
      toast.error("Ungültiger Code. Bitte erneut versuchen.");
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Zwei-Faktor-Authentifizierung</h1>
            <p className="text-sm text-muted-foreground">Code aus Ihrer Authenticator-App eingeben</p>
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardContent className="space-y-4 pt-6">
            {!useBackup ? (
              <div className="flex flex-col items-center gap-4">
                <OTPInput
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  onComplete={handleVerify}
                  render={({ slots }) => (
                    <div className="flex gap-2">
                      {slots.map((slot, i) => (
                        <div
                          key={i}
                          className="flex h-12 w-10 items-center justify-center rounded-md border-2 border-input text-lg font-mono"
                        >
                          {slot.char}
                        </div>
                      ))}
                    </div>
                  )}
                />
                <Button onClick={handleVerify} className="w-full" disabled={verify.isPending || otp.length < 6}>
                  {verify.isPending ? "Überprüfe..." : "Bestätigen"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Label>Backup-Code</Label>
                <Input
                  placeholder="XXXX-XXXX"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  className="font-mono uppercase"
                  maxLength={9}
                />
                <Button onClick={handleVerify} className="w-full" disabled={verify.isPending}>
                  {verify.isPending ? "Überprüfe..." : "Backup-Code verwenden"}
                </Button>
              </div>
            )}

            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setUseBackup(!useBackup)}
            >
              {useBackup ? "← OTP-Code verwenden" : "Backup-Code verwenden →"}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
