import { useParams, useNavigate } from "react-router-dom";
import { useTenantDocuments, useTenantUploads } from "@/hooks/api/useTenantDocuments";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { FileText, Upload, CheckCircle, PenLine } from "lucide-react";

function formatBytes(bytes: string | number): string {
  const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function Documents() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: documents, isLoading: docsLoading } = useTenantDocuments(slug!);
  const { data: uploads, isLoading: uploadsLoading } = useTenantUploads(slug!);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dokumente</h1>
        <button
          onClick={() => navigate(`/${slug}/documents/upload`)}
          className="flex items-center gap-1.5 text-sm text-primary font-medium"
        >
          <Upload className="w-4 h-4" />
          Hochladen
        </button>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Documents from landlord */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Von Ihrer Verwaltung
          </h2>
          {docsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white border rounded-2xl p-4 animate-pulse h-16" />
              ))}
            </div>
          ) : !documents?.length ? (
            <div className="bg-white border rounded-2xl p-6 text-center text-gray-500 text-sm">
              Noch keine Dokumente vorhanden.
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="bg-white border rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(doc.createdAt), "dd.MM.yyyy", { locale: de })} · {doc.fileType.toUpperCase()}
                    </p>
                  </div>
                  {doc.requiresSignature && (
                    doc.signedAt ? (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <button
                        onClick={() => navigate(`/${slug}/documents/${doc.id}/sign`)}
                        className="flex items-center gap-1 text-xs text-primary font-semibold bg-primary/10 px-2 py-1 rounded-lg flex-shrink-0"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        Signieren
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tenant uploads */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Ihre Uploads
          </h2>
          {uploadsLoading ? (
            <div className="space-y-2">
              {[1].map((i) => (
                <div key={i} className="bg-white border rounded-2xl p-4 animate-pulse h-16" />
              ))}
            </div>
          ) : !uploads?.length ? (
            <div className="bg-white border rounded-2xl p-6 text-center text-gray-500 text-sm">
              Noch keine Uploads vorhanden.
            </div>
          ) : (
            <div className="space-y-2">
              {uploads.map((upload) => (
                <div key={upload.id} className="bg-white border rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Upload className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{upload.filename}</p>
                    <p className="text-xs text-gray-500">
                      {upload.category} · {formatBytes(upload.sizeBytes)} ·{" "}
                      {format(new Date(upload.createdAt), "dd.MM.yyyy", { locale: de })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
