import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Pencil, Plus, RotateCcw, Save, X } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { WidgetLibrary } from "@/components/dashboard/WidgetLibrary";
import { WIDGET_REGISTRY, DEFAULT_LAYOUT, normalizeLayout } from "@/components/dashboard/registry";
import type { LayoutItem } from "@/components/dashboard/types";
import { useDashboardStats, useDashboardLayout, useSaveDashboardLayout } from "@/hooks/api/useDashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user } = useAuth();
  const role = user?.role ?? "READONLY";
  const { toast } = useToast();
  const firstName = user?.name?.split(" ")[0] ?? "User";

  const { data: statsRes } = useDashboardStats();
  const stats = statsRes?.data;

  const { data: layoutRes, isLoading } = useDashboardLayout();
  const saveLayout = useSaveDashboardLayout();

  const [editMode, setEditMode] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [draft, setDraft] = useState<LayoutItem[]>([]);
  const [saved, setSaved] = useState<LayoutItem[]>([]);

  useEffect(() => {
    if (layoutRes?.data) {
      const norm = normalizeLayout(layoutRes.data, role);
      setSaved(norm);
      if (!editMode) setDraft(norm);
    }
  }, [layoutRes, role, editMode]);

  const items = editMode ? draft : saved;

  const startEdit = () => { setDraft(saved); setEditMode(true); };
  const cancelEdit = () => { setDraft(saved); setEditMode(false); };

  const handleSave = async () => {
    try {
      const res = await saveLayout.mutateAsync(draft);
      const norm = normalizeLayout(res.data, role);
      setSaved(norm);
      setEditMode(false);
      toast({ title: "Dashboard gespeichert" });
    } catch {
      toast({ title: "Speichern fehlgeschlagen", variant: "destructive" });
    }
  };

  const resetDefault = () => setDraft(normalizeLayout(DEFAULT_LAYOUT, role));

  const addWidget = (key: string) => {
    if (draft.some((d) => d.key === key)) return;
    const def = WIDGET_REGISTRY[key];
    setDraft([{ key, x: 0, y: 0, w: def.defaultSize.w, h: def.defaultSize.h }, ...draft]);
    setLibraryOpen(false);
  };

  const removeWidget = (key: string) => setDraft(draft.filter((d) => d.key !== key));

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Willkommen zurück, {firstName}</p>
        </div>
        {editMode ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLibraryOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Widget
            </Button>
            <Button variant="outline" size="sm" onClick={resetDefault}>
              <RotateCcw className="h-4 w-4 mr-1" /> Standard
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              <X className="h-4 w-4 mr-1" /> Abbrechen
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saveLayout.isPending}>
              <Save className="h-4 w-4 mr-1" /> Speichern
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="h-4 w-4 mr-1" /> Dashboard anpassen
          </Button>
        )}
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {user?.role === "ADMIN" && stats?.setupStatus &&
          (!stats.setupStatus.smtpSet || !stats.setupStatus.nordigenSet || !stats.setupStatus.anthropicSet) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-sm">Systemkonfiguration unvollständig</h3>
            </div>
            <ul className="text-xs text-amber-700 list-disc list-inside space-y-1">
              {!stats.setupStatus.smtpSet && (
                <li><strong>E-Mail (SMTP):</strong> Passwort-Resets und Benachrichtigungen sind deaktiviert.</li>
              )}
              {!stats.setupStatus.nordigenSet && (
                <li><strong>Bank-Schnittstelle:</strong> Automatische Synchronisierung mit Bankkonten ist nicht möglich.</li>
              )}
              {!stats.setupStatus.anthropicSet && (
                <li><strong>KI-Funktionen:</strong> Beleg-Scan und intelligente E-Mail-Analyse sind deaktiviert.</li>
              )}
            </ul>
            <p className="text-[10px] text-amber-600 mt-2 italic">
              Bitte bearbeiten Sie die <code className="bg-amber-100 px-1 rounded">.env</code> Datei im Backend-Verzeichnis.
            </p>
          </div>
        )}

        {isLoading || !layoutRes ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Dein Dashboard ist leer.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { if (!editMode) startEdit(); setLibraryOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Widget hinzufügen
              </Button>
              <Button size="sm" variant="outline" onClick={() => { if (!editMode) startEdit(); resetDefault(); }}>
                <RotateCcw className="h-4 w-4 mr-1" /> Standard wiederherstellen
              </Button>
            </div>
          </div>
        ) : (
          <DashboardGrid
            items={items}
            editMode={editMode}
            onLayoutChange={setDraft}
            onRemove={removeWidget}
          />
        )}
      </main>

      <WidgetLibrary
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        role={role}
        activeKeys={draft.map((d) => d.key)}
        onAdd={addWidget}
      />
    </div>
  );
};

export default Index;
