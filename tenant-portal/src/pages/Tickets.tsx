import { useParams, useNavigate } from "react-router-dom";
import { useTenantTickets } from "@/hooks/api/useTenantTickets";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Plus, AlertCircle } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  OFFEN: "Offen",
  IN_BEARBEITUNG: "In Bearbeitung",
  ERLEDIGT: "Erledigt",
  GESCHLOSSEN: "Geschlossen",
};

const STATUS_COLORS: Record<string, string> = {
  OFFEN: "bg-red-100 text-red-700",
  IN_BEARBEITUNG: "bg-yellow-100 text-yellow-700",
  ERLEDIGT: "bg-green-100 text-green-700",
  GESCHLOSSEN: "bg-gray-100 text-gray-600",
};

export default function Tickets() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: tickets, isLoading } = useTenantTickets(slug!);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Meine Tickets</h1>
        <button
          onClick={() => navigate(`/${slug}/tickets/new`)}
          className="flex items-center gap-1.5 text-sm text-primary font-medium"
        >
          <Plus className="w-4 h-4" />
          Neu
        </button>
      </div>

      <div className="flex-1 p-4 space-y-2">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="bg-white border rounded-2xl p-4 animate-pulse h-20" />
          ))
        ) : !tickets?.length ? (
          <div className="bg-white border rounded-2xl p-8 flex flex-col items-center gap-3 text-center mt-4">
            <AlertCircle className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-500">Sie haben noch keine Tickets erstellt.</p>
            <button
              onClick={() => navigate(`/${slug}/tickets/new`)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold"
            >
              Ersten Schaden melden
            </button>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div key={ticket.id} className="bg-white border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{ticket.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ticket.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(ticket.createdAt), "dd.MM.yyyy", { locale: de })} · {ticket.category}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${STATUS_COLORS[ticket.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
