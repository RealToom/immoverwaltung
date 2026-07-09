import React, { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function MeterReadingSelfService() {
  const [reading, setReading] = useState("");
  const [imageCaptured, setImageCaptured] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // In a real app we would access device camera
  const handleCaptureClick = () => {
    // Mocking camera capture
    setTimeout(() => {
      setImageCaptured(true);
      toast.success("Foto erfolgreich aufgenommen");
    }, 500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reading || !imageCaptured) {
      toast.error("Bitte Zählerstand eingeben und ein Foto machen.");
      return;
    }
    
    setIsSubmitting(true);
    // Mock API call
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      toast.success("Zählerstand erfolgreich übermittelt");
    }, 1000);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-20">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
        <h2 className="text-xl font-bold">Vielen Dank!</h2>
        <p className="text-muted-foreground text-center max-w-sm">
          Dein Zählerstand wurde erfolgreich übermittelt und wird für die nächste Nebenkostenabrechnung verwendet.
        </p>
        <Button variant="outline" onClick={() => { setSubmitted(false); setReading(""); setImageCaptured(false); }} className="mt-4">
          Weiteren Zähler erfassen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Zählerstand melden</h1>
        <p className="text-sm text-muted-foreground">
          Stichtagsmeldung für Wasser, Strom oder Heizung.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 flex gap-3 text-sm text-amber-800 dark:text-amber-200">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p>Wichtiger Hinweis: Ein Foto des Zählers ist für die rechtssichere Nebenkostenabrechnung zwingend erforderlich.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zählerdaten eingeben</CardTitle>
          <CardDescription>Zählernummer: 12345678 (Kaltwasser)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="reading">Aktueller Zählerstand (in m³)</Label>
              <Input
                id="reading"
                type="number"
                step="0.001"
                placeholder="z.B. 145.5"
                value={reading}
                onChange={(e) => setReading(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Belegfoto (Zwingend erforderlich)</Label>
              <div 
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center space-y-3 transition-colors ${
                  imageCaptured ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                {imageCaptured ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-400">Foto aufgenommen</p>
                      <button type="button" onClick={() => setImageCaptured(false)} className="text-xs text-muted-foreground underline mt-1">Neu aufnehmen</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex gap-4">
                      <Button type="button" variant="secondary" onClick={handleCaptureClick}>
                        <Camera className="w-4 h-4 mr-2" />
                        Kamera starten
                      </Button>
                      <Button type="button" variant="outline">
                        <UploadCloud className="w-4 h-4 mr-2" />
                        Datei wählen
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Bitte stelle sicher, dass die Zählernummer und der Stand gut lesbar sind.
                    </p>
                  </>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={!reading || !imageCaptured || isSubmitting}>
              {isSubmitting ? "Wird gesendet..." : "Zählerstand verbindlich übermitteln"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
