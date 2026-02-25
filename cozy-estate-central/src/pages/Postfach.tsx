import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Reply, CalendarDays, Sparkles, Check, X, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEmailMessages, useEmailMessage, useUpdateEmailMessage, useReplyEmail, useCreateEventFromEmail, useSendNewEmail } from "@/hooks/api/useEmailMessages";
import { useEmailAccounts } from "@/hooks/api/useEmailAccounts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/mappings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Filter = "alle" | "ungelesen" | "anfragen";

export default function Postfach() {
  const [filter, setFilter] = useState<Filter>("alle");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeAccountId, setComposeAccountId] = useState<string>("");

  const isReadFilter = filter === "ungelesen" ? false : undefined;
  const isInquiryFilter = filter === "anfragen" ? true : undefined;

  const { data: listData, isLoading } = useEmailMessages({
    isRead: isReadFilter,
    isInquiry: isInquiryFilter,
    limit: 50,
  });
  const { data: detailData } = useEmailMessage(selectedId ?? 0);
  const updateMsg = useUpdateEmailMessage();
  const replyEmail = useReplyEmail();
  const createEvent = useCreateEventFromEmail();
  const sendNew = useSendNewEmail();
  const { data: accountsRes } = useEmailAccounts();
  const accounts = accountsRes?.data ?? [];

  const messages = listData?.data ?? [];
  const detail = detailData?.data;

  const handleSelect = (id: number) => {
    setSelectedId(id);
    updateMsg.mutate({ id, isRead: true });
  };

  const handleReply = async () => {
    if (!selectedId || !replyBody) return;
    try {
      await replyEmail.mutateAsync({ id: selectedId, body: replyBody });
      toast.success("Antwort gesendet");
      setReplyOpen(false);
      setReplyBody("");
    } catch {
      toast.error("Fehler beim Senden");
    }
  };

  const handleCreateEvent = async () => {
    if (!selectedId || !eventTitle || !eventStart) return;
    try {
      await createEvent.mutateAsync({
        id: selectedId,
        title: eventTitle,
        start: new Date(eventStart).toISOString(),
        allDay: false,
      });
      toast.success("Termin erstellt");
      setEventDialogOpen(false);
    } catch {
      toast.error("Fehler");
    }
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "alle", label: "Alle" },
    { key: "ungelesen", label: "Ungelesen" },
    { key: "anfragen", label: "Anfragen" },
  ];

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <span className="font-heading font-semibold">Postfach</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* E-Mail-Liste */}
        <div className="w-[360px] border-r flex flex-col shrink-0">
          <div className="p-3 border-b flex flex-col gap-2">
            <Button size="sm" className="gap-1.5 w-full" onClick={() => { setComposeTo(""); setComposeSubject(""); setComposeBody(""); setComposeAccountId(accounts[0] ? String(accounts[0].id) : ""); setComposeOpen(true); }}>
              <Pencil className="h-4 w-4" /> Neue E-Mail
            </Button>
            <div className="flex gap-1.5 flex-wrap">
              {filters.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors",
                    filter === f.key ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex justify-center p-8">
                <Loader2 className="animate-spin" />
              </div>
            )}
            {messages.map((msg) => (
              <button key={msg.id} onClick={() => handleSelect(msg.id)} className={cn(
                "w-full text-left p-3 border-b hover:bg-muted/50 transition-colors",
                selectedId === msg.id && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}>
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <span className={cn("text-sm truncate", !msg.isRead ? "font-bold" : "font-medium")}>
                    {msg.fromName ?? msg.fromAddress}
                  </span>
                  <span className="text-xs shrink-0 opacity-70">{formatDate(msg.receivedAt)}</span>
                </div>
                <p className="text-xs truncate opacity-90 mb-0.5">{msg.subject}</p>
                {msg.isInquiry && (
                  <Badge variant="secondary" className="text-[10px] h-4">Anfrage</Badge>
                )}
              </button>
            ))}
            {!isLoading && messages.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">Keine Nachrichten</p>
            )}
          </div>
        </div>

        {/* Detail */}
        {detail ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b flex flex-col gap-3">
              <h2 className="font-semibold text-lg">{detail.subject}</h2>
              <p className="text-sm text-muted-foreground">
                Von: {detail.fromName ? `${detail.fromName} <${detail.fromAddress}>` : detail.fromAddress}
                {" · "}{formatDate(detail.receivedAt)}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setReplyOpen(true)}>
                  <Reply className="h-4 w-4 mr-1" /> Antworten
                </Button>
                <Button size="sm" onClick={() => { setEventTitle(detail.subject); setEventDialogOpen(true); }}>
                  <CalendarDays className="h-4 w-4 mr-1" /> Termin erstellen
                </Button>
              </div>

              {/* KI-Terminvorschlag Banner */}
              {detail.suggestedEventId && (
                <div className="flex items-center justify-between p-3 rounded-md bg-purple-50 border border-purple-200 dark:bg-purple-950/30">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-300">KI-Terminvorschlag erkannt</p>
                      <p className="text-xs text-purple-600">Termin wurde automatisch im Kalender vorgemerkt</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm"><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="outline"><X className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {detail.bodyHtml ? (
                <iframe
                  srcDoc={detail.bodyHtml}
                  sandbox=""
                  className="w-full h-full border-0"
                  title="E-Mail-Inhalt"
                />
              ) : (
                <pre className="text-sm whitespace-pre-wrap font-sans">{detail.bodyText}</pre>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            E-Mail auswählen
          </div>
        )}
      </div>

      {/* Reply Dialog */}
      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Antworten</DialogTitle></DialogHeader>
          <div>
            <Label>Nachricht</Label>
            <Textarea rows={6} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyOpen(false)}>Abbrechen</Button>
            <Button onClick={handleReply} disabled={replyEmail.isPending}>
              {replyEmail.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Neue E-Mail Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Neue E-Mail schreiben</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            {accounts.length > 1 && (
              <div>
                <Label className="text-xs mb-1 block">Absender-Postfach</Label>
                <Select value={composeAccountId} onValueChange={setComposeAccountId}>
                  <SelectTrigger><SelectValue placeholder="Postfach auswählen" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.label} ({a.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs mb-1 block">An</Label>
              <Input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="empfaenger@example.com" type="email" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Betreff</Label>
              <Input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Betreff..." />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Nachricht</Label>
              <Textarea rows={7} value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Ihre Nachricht..." />
            </div>
            {accounts.length === 0 && (
              <p className="text-xs text-destructive">Kein E-Mail-Postfach konfiguriert. Bitte zuerst ein Postfach in den Einstellungen anlegen.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Abbrechen</Button>
            <Button
              disabled={sendNew.isPending || accounts.length === 0 || !composeTo || !composeSubject || !composeBody}
              onClick={async () => {
                const accountId = composeAccountId ? Number(composeAccountId) : accounts[0]?.id;
                if (!accountId) return;
                try {
                  await sendNew.mutateAsync({ accountId, to: composeTo, subject: composeSubject, body: composeBody });
                  toast.success("E-Mail gesendet");
                  setComposeOpen(false);
                } catch {
                  toast.error("Fehler beim Senden der E-Mail");
                }
              }}
            >
              {sendNew.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Termin-Dialog */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Termin erstellen</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div><Label>Titel</Label><Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} /></div>
            <div><Label>Datum & Uhrzeit</Label><Input type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreateEvent} disabled={createEvent.isPending}>Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
