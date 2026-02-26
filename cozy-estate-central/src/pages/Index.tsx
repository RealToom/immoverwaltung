import { Building2, Users, CreditCard, AlertTriangle, Loader2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { KpiCard } from "@/components/KpiCard";
import { PropertyTable } from "@/components/PropertyTable";
import { QuickActions } from "@/components/QuickActions";
import { RecentActivity } from "@/components/RecentActivity";
import { Separator } from "@/components/ui/separator";
import { useDashboardStats } from "@/hooks/api/useDashboard";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/mappings";

const Index = () => {
  const { user } = useAuth();
  const { data: response, isLoading } = useDashboardStats();
  const stats = response?.data;

  const firstName = user?.name?.split(" ")[0] ?? "User";
  const vacancyRate = stats && stats.totalUnits > 0
    ? Math.round((stats.vacantUnits / stats.totalUnits) * 100 * 10) / 10
    : 0;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h1 className="font-heading text-lg font-semibold text-foreground">
            Dashboard
          </h1>
          <p className="text-xs text-muted-foreground">
            Willkommen zurück, {firstName}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Setup Warnings – only visible to ADMIN */}
        {user?.role === "ADMIN" && stats?.setupStatus && (!stats.setupStatus.smtpSet || !stats.setupStatus.nordigenSet || !stats.setupStatus.anthropicSet) && (
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

        {/* KPI Row */}
        {isLoading || !stats ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Immobilien"
              value={String(stats.properties)}
              change={`${stats.totalUnits} Einheiten gesamt`}
              changeType="positive"
              icon={Building2}
            />
            <KpiCard
              title="Mieter"
              value={String(stats.tenants)}
              change={`${stats.occupiedUnits} belegte Einheiten`}
              changeType="positive"
              icon={Users}
              iconBg="bg-accent/15"
              iconColor="text-accent-foreground"
            />
            <KpiCard
              title="Monatl. Einnahmen"
              value={formatCurrency(stats.monthlyRevenue)}
              change={`${stats.openTickets} offene Tickets`}
              changeType="positive"
              icon={CreditCard}
              iconBg="bg-success/15"
              iconColor="text-success"
            />
            <KpiCard
              title="Leerstand"
              value={String(stats.vacantUnits)}
              change={`${vacancyRate}% Leerstandsquote`}
              changeType="negative"
              icon={AlertTriangle}
              iconBg="bg-destructive/10"
              iconColor="text-destructive"
            />
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <PropertyTable />
          </div>
          <div className="space-y-6">
            {user?.role !== "READONLY" && <QuickActions />}
            <RecentActivity />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
