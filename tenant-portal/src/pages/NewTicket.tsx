import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCreateTicket } from "@/hooks/api/useTenantTickets";
import { ArrowLeft } from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateTicket(slug!);

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
      await createMutation.mutateAsync({ title: title.trim(), description: description.trim(), category });
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
