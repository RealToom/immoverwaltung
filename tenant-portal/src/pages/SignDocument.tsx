import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SignaturePad from "signature_pad";
import { useSignDocument } from "@/hooks/api/useTenantDocuments";
import { ArrowLeft } from "lucide-react";

export default function SignDocument() {
  const { slug, documentId } = useParams<{ slug: string; documentId: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [mode, setMode] = useState<"SIMPLE" | "SIGNATURE_PAD">("SIMPLE");
  const [accepted, setAccepted] = useState(false);
  const signMutation = useSignDocument(slug!);

  useEffect(() => {
    if (mode === "SIGNATURE_PAD" && canvasRef.current) {
      padRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: "rgb(249,250,251)",
      });
      return () => {
        padRef.current?.off();
      };
    }
  }, [mode]);

  function handleClear() {
    padRef.current?.clear();
  }

  async function handleSubmit() {
    if (mode === "SIMPLE" && !accepted) return;
    if (mode === "SIGNATURE_PAD" && padRef.current?.isEmpty()) return;

    const signatureData =
      mode === "SIGNATURE_PAD" ? padRef.current?.toDataURL() : undefined;

    await signMutation.mutateAsync({
      documentId: parseInt(documentId!, 10),
      type: mode,
      signatureData,
    });
    navigate(`/${slug}/documents`);
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Dokument signieren</h1>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Mode selector */}
        <div className="bg-white border rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Signaturmethode</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("SIMPLE")}
              className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                mode === "SIMPLE"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-gray-700 border-gray-200"
              }`}
            >
              Einfache Bestätigung
            </button>
            <button
              onClick={() => setMode("SIGNATURE_PAD")}
              className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                mode === "SIGNATURE_PAD"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-gray-700 border-gray-200"
              }`}
            >
              Unterschrift zeichnen
            </button>
          </div>
        </div>

        {/* Simple mode */}
        {mode === "SIMPLE" && (
          <div className="bg-white border rounded-2xl p-4">
            <p className="text-sm text-gray-700 mb-4">
              Mit der Bestätigung unten erklären Sie Ihr Einverständnis mit dem Inhalt des Dokuments.
            </p>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary"
              />
              <span className="text-sm text-gray-700">
                Ich habe das Dokument gelesen und stimme dem Inhalt zu.
              </span>
            </label>
          </div>
        )}

        {/* Signature pad mode */}
        {mode === "SIGNATURE_PAD" && (
          <div className="bg-white border rounded-2xl p-4">
            <p className="text-sm text-gray-700 mb-3">Bitte zeichnen Sie Ihre Unterschrift:</p>
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
              <canvas
                ref={canvasRef}
                width={320}
                height={180}
                className="w-full touch-none"
              />
            </div>
            <button
              onClick={handleClear}
              className="mt-2 text-xs text-gray-500 underline"
            >
              Löschen
            </button>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={
            signMutation.isPending ||
            (mode === "SIMPLE" && !accepted)
          }
          className="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-semibold disabled:opacity-50"
        >
          {signMutation.isPending ? "Wird gespeichert…" : "Signieren & bestätigen"}
        </button>
      </div>
    </div>
  );
}
