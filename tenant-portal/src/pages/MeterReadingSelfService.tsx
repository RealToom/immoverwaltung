import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTenantMeters, useSubmitMeterReading, useScanMeterReading } from "@/hooks/api/useTenantMeters";

export default function MeterReadingSelfService() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: meters, isLoading } = useTenantMeters(slug!);
  const submitReading = useSubmitMeterReading(slug!);
  const scanReading = useScanMeterReading(slug!);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [meterId, setMeterId] = useState<number | null>(null);
  const [reading, setReading] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<{ type: "success" | "warning"; text: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const selectedMeter = meters?.find((m) => m.id === meterId) ?? null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !meterId) return;
    setPhoto(file);
    setScanNotice(null);
    setError(null);
    try {
      const res = await scanReading.mutateAsync({ meterId, photo: file });
      if (res.data.value != null) {
        setReading(String(res.data.value));
        setScanNotice({ type: "success", text: "Zählerstand erkannt — bitte prüfen." });
      } else {
        setScanNotice({ type: "warning", text: "Zählerstand konnte nicht automatisch erkannt werden. Bitte manuell eingeben." });
      }
    } catch {
      setScanNotice({ type: "warning", text: "KI-Scan fehlgeschlagen. Bitte Zählerstand manuell eingeben." });
    }
  }

  function removePhoto() {
    setPhoto(null);
    setScanNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!meterId || !reading) {
      setError("Bitte Zähler auswählen und Zählerstand eingeben.");
      return;
    }
    try {
      await submitReading.mutateAsync({ meterId, value: Number(reading), readAt: new Date().toISOString() });
      setSubmitted(true);
    } catch {
      setError("Übermittlung fehlgeschlagen. Bitte erneut versuchen.");
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 space-y-4 py-20 px-6">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
        <h2 className="text-xl font-bold">Vielen Dank!</h2>
        <p className="text-gray-500 text-center max-w-sm">
          Dein Zählerstand wurde erfolgreich übermittelt und wird für die nächste Nebenkostenabrechnung verwendet.
        </p>
        <button
          onClick={() => { setSubmitted(false); setReading(""); setPhoto(null); setMeterId(null); setScanNotice(null); setError(null); }}
          className="mt-4 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold"
        >
          Weiteren Zähler erfassen
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Zählerstand melden</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-sm text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p>Wichtiger Hinweis: Ein Foto des Zählers ist für die rechtssichere Nebenkostenabrechnung zwingend erforderlich.</p>
        </div>

        <div className="bg-white border rounded-2xl p-4">
          <label htmlFor="meter" className="block text-sm font-medium text-gray-700 mb-2">Zähler</label>
          <select
            id="meter"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            value={meterId ?? ""}
            onChange={(e) => setMeterId(Number(e.target.value) || null)}
            required
          >
            <option value="" disabled>
              {isLoading ? "Lade Zähler…" : meters?.length ? "Zähler wählen" : "Keine Zähler gefunden"}
            </option>
            {(meters ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.label} ({m.type})</option>
            ))}
          </select>
          {selectedMeter?.readings[0] && (
            <p className="text-xs text-gray-500 mt-2">
              Letzter Stand: {selectedMeter.readings[0].value} am {new Date(selectedMeter.readings[0].readAt).toLocaleDateString("de-DE")}
            </p>
          )}
        </div>

        <div className="bg-white border rounded-2xl p-4">
          <label htmlFor="reading" className="block text-sm font-medium text-gray-700 mb-2">Aktueller Zählerstand</label>
          <input
            id="reading"
            type="number"
            step="0.001"
            placeholder="z.B. 145.5"
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div className="bg-white border rounded-2xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Belegfoto <span className="text-gray-400 font-normal">(empfohlen, KI liest den Stand automatisch aus)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <div
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 transition-colors ${
              photo ? "bg-green-50 border-green-200" : "border-gray-300"
            }`}
          >
            {photo ? (
              <>
                <CheckCircle2 className="w-10 h-10 text-green-500" />
                <div>
                  <p className="font-medium text-green-700">
                    Foto aufgenommen{scanReading.isPending ? " — wird analysiert…" : ""}
                  </p>
                  <button type="button" onClick={removePhoto} className="text-xs text-gray-500 underline mt-1">
                    Neu aufnehmen
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={!meterId}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-4 h-4" />
                    Foto aufnehmen
                  </button>
                  <button
                    type="button"
                    disabled={!meterId}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UploadCloud className="w-4 h-4" />
                    Datei wählen
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {meterId ? "Bitte stelle sicher, dass die Zählernummer und der Stand gut lesbar sind." : "Bitte zuerst einen Zähler auswählen."}
                </p>
              </>
            )}
          </div>
          {scanNotice && (
            <p className={`text-sm rounded-lg px-3 py-2 mt-3 ${
              scanNotice.type === "success"
                ? "text-green-700 bg-green-50 border border-green-200"
                : "text-amber-800 bg-amber-50 border border-amber-200"
            }`}>
              {scanNotice.text}
            </p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!reading || !meterId || submitReading.isPending}
          className="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-semibold disabled:opacity-50"
        >
          {submitReading.isPending ? "Wird gesendet…" : "Zählerstand verbindlich übermitteln"}
        </button>
      </form>
    </div>
  );
}
