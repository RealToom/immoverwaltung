import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCreateTicket } from "@/hooks/api/useTenantTickets";
import { ArrowLeft, Camera, X } from "lucide-react";

const CATEGORIES = [
  "Sanitär",
  "Elektrik",
  "Heizung",
  "Fenster/Türen",
  "Böden/Wände",
  "Sonstiges",
];

export default function NewTicket() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createMutation = useCreateTicket(slug!);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Bild darf maximal 10 MB groß sein.");
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Bitte geben Sie einen Titel an.");
      return;
    }
    if (!description.trim()) {
      setError("Bitte beschreiben Sie das Problem.");
      return;
    }
    try {
      await createMutation.mutateAsync({ title: title.trim(), description: description.trim(), category, photo });
      navigate(`/${slug}/tickets`);
    } catch {
      setError("Fehler beim Erstellen des Tickets. Bitte versuchen Sie es erneut.");
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Schaden melden</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-4">
        <div className="bg-white border rounded-2xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Wasserhahn tropft"
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Foto (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200">
                <img src={photoPreview} alt="Vorschau" className="w-full max-h-48 object-cover" />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl px-4 py-6 text-sm text-gray-500 flex flex-col items-center gap-2 hover:border-primary hover:text-primary transition-colors"
              >
                <Camera className="w-6 h-6" />
                <span>Foto aufnehmen oder auswählen</span>
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreiben Sie das Problem so genau wie möglich…"
              required
              rows={5}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-semibold disabled:opacity-50"
        >
          {createMutation.isPending ? "Wird gesendet…" : "Schaden melden"}
        </button>
      </form>
    </div>
  );
}
