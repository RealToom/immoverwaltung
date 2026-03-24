import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Copy, Check } from "lucide-react";
import { OTPInput } from "input-otp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSetup2FA, useVerifySetup } from "@/hooks/api/useTwoFactor";

type Step = "qr" | "verify" | "backup";

export default function TwoFactorSetup() {
  const navigate = useNavigate();
  const { setupToken, clearMfaTokens, finalizeLogin } = useAuth();
  const [step, setStep] = useState<Step>("qr");
  const [qrData, setQrData] = useState<{ qrCodeDataUrl: string; secret: string } | null>(null);
  const [otp, setOtp] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [pendingAccessToken, setPendingAccessToken] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const setup = useSetup2FA(setupToken ?? "");
  const verifySetup = useVerifySetup(setupToken ?? "");

  if (!setupToken) {
    navigate("/login");
    return null;
  }

  // Fetch QR code on mount
  useEffect(() => {
    setup.mutateAsync(undefined).then(setQrData).catch(() => {
      toast.error("Fehler beim Laden des QR-Codes");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerify() {
    if (otp.length < 6) { toast.error("Bitte 6-stelligen Code eingeben"); return; }
    try {
      const result = await verifySetup.mutateAsync(otp);
      setBackupCodes(result.backupCodes);
      setPendingAccessToken(result.accessToken);
      setStep("backup");
    } catch {
      toast.error("Ungültiger Code. Bitte erneut versuchen.");
    }
  }

  async function handleFinish() {
    if (!confirmed) { toast.error("Bitte bestätigen, dass Sie die Backup-Codes gesichert haben"); return; }
    await finalizeLogin(pendingAccessToken!);
    clearMfaTokens();
    toast.success("2FA erfolgreich eingerichtet!");
    navigate("/");
  }

  function copySecret() {
    if (qrData?.secret) {
      navigator.clipboard.writeText(qrData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Zwei-Faktor-Authentifizierung einrichten</h1>
            <p className="text-sm text-muted-foreground">Schritt {step === "qr" ? 1 : step === "verify" ? 2 : 3} von 3</p>
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardContent className="space-y-4 pt-6">

            {step === "qr" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Scannen Sie den QR-Code mit Ihrer Authenticator-App (z.B. Google Authenticator, Authy).
                </p>
                {qrData ? (
                  <div className="flex justify-center">
                    <img src={qrData.qrCodeDataUrl} alt="QR-Code" className="h-48 w-48" />
                  </div>
                ) : (
                  <div className="flex justify-center h-48 items-center text-muted-foreground text-sm">Lade QR-Code...</div>
                )}
                {qrData && (
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground mb-1">Kein Scanner? Code manuell eingeben:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono break-all">{qrData.secret}</code>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copySecret}>
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                )}
                <Button className="w-full" onClick={() => setStep("verify")} disabled={!qrData}>
                  Weiter →
                </Button>
              </>
            )}

            {step === "verify" && (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein, um die Einrichtung zu bestätigen.
                </p>
                <div className="flex justify-center">
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
                </div>
                <Button className="w-full" onClick={handleVerify} disabled={verifySetup.isPending || otp.length < 6}>
                  {verifySetup.isPending ? "Überprüfe..." : "Code bestätigen"}
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setStep("qr")}
                >
                  ← Zurück zum QR-Code
                </button>
              </>
            )}

            {step === "backup" && (
              <>
                <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 dark:bg-yellow-950 dark:border-yellow-700">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    ⚠️ Diese Backup-Codes werden nur einmal angezeigt. Jetzt sichern!
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code) => (
                    <code key={code} className="rounded bg-muted px-2 py-1 text-sm font-mono text-center">
                      {code}
                    </code>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="confirm"
                    checked={confirmed}
                    onCheckedChange={(v) => setConfirmed(!!v)}
                  />
                  <Label htmlFor="confirm" className="text-sm cursor-pointer">
                    Ich habe die Backup-Codes an einem sicheren Ort gespeichert.
                  </Label>
                </div>
                <Button className="w-full" onClick={handleFinish} disabled={!confirmed}>
                  Fertig — zur App →
                </Button>
              </>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
