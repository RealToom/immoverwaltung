import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUploadDocument } from "@/hooks/api/useTenantDocuments";
import { ArrowLeft, Upload } from "lucide-react";

const CATEGORIES = [
  "Personalausweis",
  "Mietbescheinigung",
  "Einkommensnachweis",
  "Versicherung",
  "Sonstiges",
];

export default function UploadDocument() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const uploadMutation = useUploadDocument(slug!);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(f.type)) {
      setError("Nur PDF, JPG und PNG sind erlaubt.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Datei darf maximal 10 MB groß sein.");
      return;
    }
    setError(null);
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    if (description) fd.append("description", description);
    await uploadMutation.mutateAsync(fd);
    navigate(`/${slug}/documents`);
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Dokument hochladen</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-4">
        {/* File picker */}
        <div
          onClick={() => fileRef.current?.click()}
          className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-primary transition-colors"
        >
          <Upload className="w-8 h-8 text-gray-400" />
          {file ? (
            <p className="text-sm font-medium text-gray-900">{file.name}</p>
          ) : (
            <p className="text-sm text-gray-500">PDF, JPG oder PNG · max. 10 MB</p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Category */}
        <div className="bg-white border rounded-2xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Kategorie</label>
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

        {/* Description */}
        <div className="bg-white border rounded-2xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Beschreibung <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="z. B. Personalausweis Vorderseite"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!file || uploadMutation.isPending}
          className="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-semibold disabled:opacity-50"
        >
          {uploadMutation.isPending ? "Wird hochgeladen…" : "Hochladen"}
        </button>
      </form>
    </div>
  );
}
