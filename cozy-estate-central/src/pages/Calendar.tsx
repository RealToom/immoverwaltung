import { useState, useMemo, useEffect } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import { de } from "date-fns/locale/de";
import "react-big-calendar/lib/css/react-big-calendar.css";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useCalendarEvents, useCreateCalendarEvent, useUpdateCalendarEvent } from "@/hooks/api/useCalendarEvents";
import { toast } from "sonner";

const EVENING_DURATION_KEY = "eveningEventDurationMin";
const EVENING_HOUR = 20;

const getEveningDefault = () => {
  const saved = localStorage.getItem(EVENING_DURATION_KEY);
  return saved ? parseInt(saved, 10) : 60;
};

const locales = { de };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar) as typeof Calendar;

const EVENT_COLORS: Record<string, string> = {
  MANUELL: "#3b82f6",
  AUTO_VERTRAG: "#f97316",
  AUTO_WARTUNG: "#ef4444",
  AUTO_MIETE: "#22c55e",
  AUTO_EMAIL: "#8b5cf6",
};

const EVENT_LABELS: Record<string, string> = {
  MANUELL: "Manuell",
  AUTO_VERTRAG: "Vertrag",
  AUTO_WARTUNG: "Wartung",
  AUTO_MIETE: "Mietzahlung",
  AUTO_EMAIL: "Aus E-Mail",
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>("month");
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newDuration, setNewDuration] = useState<number>(0);
  const [selectedEvent, setSelectedEvent] = useState<(typeof events)[0] | null>(null);

  const from = subMonths(currentDate, 1);
  const to = addMonths(currentDate, 2);
  const { data, isLoading } = useCalendarEvents(from, to);
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();

  // Auto-fill duration when time is set to ≥ 20:00
  useEffect(() => {
    if (!newStart) return;
    const hour = new Date(newStart).getHours();
    if (hour >= EVENING_HOUR) {
      setNewDuration(getEveningDefault());
    }
  }, [newStart]);

  const events = useMemo(() =>
    (data?.data ?? []).map((e) => {
      const start = new Date(e.start);
      let end: Date;
      if (e.end) {
        end = new Date(e.end);
      } else if (!e.allDay && start.getHours() >= EVENING_HOUR) {
        // Fallback: visualize evening events without explicit end as 1h block
        end = new Date(start.getTime() + 60 * 60 * 1000);
      } else {
        end = start;
      }
      return { ...e, start, end, resource: e };
    }), [data]);

  const upcoming = useMemo(() =>
    (data?.data ?? [])
      .filter((e) => new Date(e.start) >= new Date())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 8), [data]);

  const handleCreate = async () => {
    if (!newTitle || !newStart) return;
    const start = new Date(newStart);
    const hasTime = newDuration > 0;
    const end = hasTime ? new Date(start.getTime() + newDuration * 60 * 1000) : undefined;
    try {
      await createEvent.mutateAsync({
        title: newTitle,
        start: start.toISOString(),
        end: end?.toISOString(),
        allDay: !hasTime,
      });
      toast.success("Termin erstellt");
      setNewEventOpen(false);
      setNewTitle("");
      setNewStart("");
      setNewDuration(0);
    } catch {
      toast.error("Fehler beim Erstellen");
    }
  };

  const handleEventDrop = ({
    event,
    start,
    end,
  }: {
    event: (typeof events)[0];
    start: string | Date;
    end: string | Date;
  }) => {
    if (event.resource?.type !== "MANUELL") return;
    updateEvent.mutate({
      id: event.id as number,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    });
  };

  const eventStyleGetter = (event: { resource: { type: string; color?: string } }) => ({
    style: {
      backgroundColor: event.resource.color ?? EVENT_COLORS[event.resource.type] ?? "#6b7280",
      borderRadius: "3px",
      border: "none",
      fontSize: "11px",
      padding: "2px 4px",
    },
  });

  const durationLabel = (min: number) => {
    if (min === 0) return "";
    if (min < 60) return `${min} Min.`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <span className="font-heading font-semibold">Kalender</span>
      </header>

      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Kalender */}
        <div className="flex-1 flex flex-col p-4 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                if (view === "day") setCurrentDate(subDays(currentDate, 1));
                else if (view === "week") setCurrentDate(subWeeks(currentDate, 1));
                else setCurrentDate(subMonths(currentDate, 1));
              }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-semibold text-base min-w-48 text-center">
                {view === "day"
                  ? format(currentDate, "EEEE, dd. MMMM yyyy", { locale: de })
                  : view === "week"
                  ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "dd. MMM", { locale: de })} – ${format(addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), 6), "dd. MMM yyyy", { locale: de })}`
                  : format(currentDate, "MMMM yyyy", { locale: de })}
              </span>
              <Button variant="outline" size="sm" onClick={() => {
                if (view === "day") setCurrentDate(addDays(currentDate, 1));
                else if (view === "week") setCurrentDate(addWeeks(currentDate, 1));
                else setCurrentDate(addMonths(currentDate, 1));
              }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Heute</Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border overflow-hidden">
                {(["month", "week", "day"] as View[]).map((v) => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1.5 text-sm ${view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                    {{ month: "Monat", week: "Woche", day: "Tag" }[v as string]}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={() => setNewEventOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Neuer Termin
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <DnDCalendar
                localizer={localizer}
                events={events}
                view={view}
                date={currentDate}
                onNavigate={setCurrentDate}
                onView={setView}
                eventPropGetter={eventStyleGetter as never}
                culture="de"
                style={{ height: "100%" }}
                toolbar={false}
                onSelectEvent={(event) => setSelectedEvent(event as (typeof events)[0])}
                onEventDrop={handleEventDrop as never}
                draggableAccessor={(event) => (event as (typeof events)[0]).resource?.type === "MANUELL"}
                resizable={false}
              />
            </div>
          )}

          {/* Legende */}
          <div className="flex gap-4 mt-2 flex-wrap">
            {Object.entries(EVENT_LABELS).map(([type, label]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: EVENT_COLORS[type] }} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Kommende Termine Panel */}
        <div className="w-64 border-l p-4 overflow-y-auto flex flex-col gap-3">
          <p className="text-sm font-semibold">Kommende Termine</p>
          {upcoming.length === 0 && <p className="text-xs text-muted-foreground">Keine Termine</p>}
          {upcoming.map((e) => (
            <div key={e.id} className="rounded-md border p-2.5 text-xs flex flex-col gap-1"
              style={{ borderLeftColor: e.color ?? EVENT_COLORS[e.type], borderLeftWidth: 3 }}>
              <span className="font-medium line-clamp-2">{e.title}</span>
              <span className="text-muted-foreground">{format(new Date(e.start), "dd.MM.yyyy", { locale: de })}</span>
              {e.type === "AUTO_EMAIL" && (
                <Badge variant="outline" className="text-purple-600 border-purple-300 w-fit text-[10px]">KI-Vorschlag</Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Termin-Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => { if (!open) setSelectedEvent(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-3 py-1">
              <div className="flex items-center gap-2">
                <Badge style={{ backgroundColor: selectedEvent.resource?.color ?? EVENT_COLORS[selectedEvent.resource?.type] ?? "#6b7280" }} className="text-white border-0">
                  {EVENT_LABELS[selectedEvent.resource?.type] ?? selectedEvent.resource?.type}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><span className="font-medium text-foreground">Start:</span> {format(selectedEvent.start, "dd. MMMM yyyy HH:mm", { locale: de })}</p>
                {selectedEvent.end && selectedEvent.end.getTime() !== selectedEvent.start.getTime() && (
                  <p><span className="font-medium text-foreground">Ende:</span> {format(selectedEvent.end, "dd. MMMM yyyy HH:mm", { locale: de })}</p>
                )}
                {selectedEvent.resource?.notes && (
                  <p><span className="font-medium text-foreground">Notizen:</span> {selectedEvent.resource.notes}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEvent(null)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Neuer Termin Dialog */}
      <Dialog open={newEventOpen} onOpenChange={(open) => {
        setNewEventOpen(open);
        if (!open) { setNewTitle(""); setNewStart(""); setNewDuration(0); }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neuer Termin</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <Label>Titel</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Terminbezeichnung" />
            </div>
            <div>
              <Label>Datum & Uhrzeit</Label>
              <Input type="datetime-local" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </div>
            <div>
              <Label className="flex items-center justify-between">
                <span>Dauer (Minuten)</span>
                {newStart && new Date(newStart).getHours() >= EVENING_HOUR && newDuration > 0 && (
                  <span className="text-xs text-primary font-normal">
                    Abendtermin — {durationLabel(newDuration)} auto gesetzt
                  </span>
                )}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step={15}
                  value={newDuration === 0 ? "" : newDuration}
                  onChange={(e) => setNewDuration(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                  placeholder="Leer = ganztägig"
                  className="flex-1"
                />
                {newDuration > 0 && (
                  <span className="text-sm text-muted-foreground whitespace-nowrap">{durationLabel(newDuration)}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Leer lassen für ganztägigen Termin</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewEventOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={createEvent.isPending || !newTitle || !newStart}>
              {createEvent.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
