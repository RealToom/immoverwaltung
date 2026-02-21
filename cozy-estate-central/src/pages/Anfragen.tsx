import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useEmailMessages, useUpdateEmailMessage } from "@/hooks/api/useEmailMessages";
import { formatDate } from "@/lib/mappings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type InquiryStatus = "NEU" | "IN_BEARBEITUNG" | "AKZEPTIERT" | "ABGELEHNT";

const STATUS_CONFIG: Record<InquiryStatus, { label: string; className: string }> = {
  NEU:            { label: "Neu",            className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  IN_BEARBEITUNG: { label: "In Bearbeitung", className: "bg-blue-100   text-blue-800   border-blue-200"   },
  AKZEPTIERT:     { label: "Akzeptiert",     className: "bg-green-100  text-green-800  border-green-200"  },
  ABGELEHNT:      { label: "Abgelehnt",      className: "bg-red-100    text-red-800    border-red-200"    },
};

type TabFilter = "ALLE" | InquiryStatus;

export default function Anfragen() {
  const [tab, setTab] = useState<TabFilter>("ALLE");
  const navigate = useNavigate();
  const updateMsg = useUpdateEmailMessage();

  const { data, isLoading } = useEmailMessages({
    isInquiry: true,
    inquiryStatus: tab === "ALLE" ? undefined : tab,
    limit: 100,
  });

  const messages = data?.data ?? [];

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "ALLE", label: `Alle (${data?.meta?.total ?? 0})` },
    { key: "NEU", label: "Neu" },
    { key: "IN_BEARBEITUNG", label: "In Bearbeitung" },
    { key: "AKZEPTIERT", label: "Akzeptiert" },
    { key: "ABGELEHNT", label: "Abgelehnt" },
  ];

  const handleStatusChange = async (id: number, status: InquiryStatus) => {
    try {
      await updateMsg.mutateAsync({ id, inquiryStatus: status });
      toast.success("Status aktualisiert");
    } catch {
      toast.error("Fehler beim Speichern");
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <span className="font-heading font-semibold">Anfragen</span>
      </header>

      <div className="flex flex-col flex-1 overflow-hidden p-6 gap-4">
        <div>
          <h1 className="text-xl font-bold">Anfragen</h1>
          <p className="text-sm text-muted-foreground">Interessentenanfragen aus Immobilienportalen</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn("px-3 py-1.5 text-sm rounded-md transition-colors",
                tab === t.key ? "bg-background shadow-sm font-medium" : "hover:bg-background/50")}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tabelle */}
        <div className="rounded-lg border overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground w-52">Absender</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Betreff</th>
                <th className="text-left p-3 font-medium text-muted-foreground w-28">Datum</th>
                <th className="text-left p-3 font-medium text-muted-foreground w-36">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground w-44">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="text-center p-8">
                    <Loader2 className="animate-spin inline-block" />
                  </td>
                </tr>
              )}
              {!isLoading && messages.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-muted-foreground">Keine Anfragen</td>
                </tr>
              )}
              {messages.map((msg) => (
                <tr key={msg.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <div className="font-medium">{msg.fromName ?? msg.fromAddress}</div>
                    <div className="text-xs text-muted-foreground">{msg.fromAddress}</div>
                  </td>
                  <td className="p-3 max-w-xs">
                    <span className="line-clamp-2">{msg.subject}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(msg.receivedAt)}</td>
                  <td className="p-3">
                    {msg.inquiryStatus && (
                      <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium",
                        STATUS_CONFIG[msg.inquiryStatus as InquiryStatus].className)}>
                        {STATUS_CONFIG[msg.inquiryStatus as InquiryStatus].label}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => navigate("/postfach")}>
                        Öffnen
                      </Button>
                      {msg.inquiryStatus === "NEU" && (
                        <Button size="sm" className="h-7 text-xs"
                          onClick={() => handleStatusChange(msg.id, "IN_BEARBEITUNG")}>
                          Bearbeiten
                        </Button>
                      )}
                      {msg.inquiryStatus === "IN_BEARBEITUNG" && (
                        <>
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => handleStatusChange(msg.id, "AKZEPTIERT")}>
                            Akzeptieren
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs"
                            onClick={() => handleStatusChange(msg.id, "ABGELEHNT")}>
                            Ablehnen
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
