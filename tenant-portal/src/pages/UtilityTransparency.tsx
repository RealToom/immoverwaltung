import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingDown, TrendingUp, Droplets, Flame } from "lucide-react";
// In a real implementation we would use a charting library like Recharts here

export default function UtilityTransparency() {
  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Verbrauchstransparenz</h1>
        <p className="text-sm text-muted-foreground">
          Dein Energie- und Wasserverbrauch im Überblick.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Heizwärme
            </CardTitle>
            <CardDescription>Dein Verbrauch im Vergleich zum Hausdurchschnitt</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end h-32 mt-4 gap-2">
              {/* Mock Chart Bars */}
              <div className="flex flex-col items-center justify-end h-full w-full gap-1">
                <div className="bg-orange-200 w-full rounded-t-sm" style={{ height: "60%" }}></div>
                <span className="text-xs text-muted-foreground">Du</span>
              </div>
              <div className="flex flex-col items-center justify-end h-full w-full gap-1">
                <div className="bg-slate-200 w-full rounded-t-sm" style={{ height: "80%" }}></div>
                <span className="text-xs text-muted-foreground">Haus</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-green-600 font-medium">
              <TrendingDown className="w-4 h-4" />
              25% unter dem Durchschnitt
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-500" />
              Wasser
            </CardTitle>
            <CardDescription>Verbrauch der letzten Monate</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="flex justify-between items-end h-32 mt-4 gap-2">
              {/* Mock Chart Bars */}
              {[40, 60, 45, 50, 70, 55].map((h, i) => (
                <div key={i} className="flex flex-col items-center justify-end h-full w-full gap-1">
                  <div className="bg-blue-300 w-full rounded-t-sm" style={{ height: `${h}%` }}></div>
                  <span className="text-xs text-muted-foreground">{['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun'][i]}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-red-500 font-medium">
              <TrendingUp className="w-4 h-4" />
              Leichter Anstieg im letzten Monat
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Tipps zum Energiesparen
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>• Stoßlüften statt Fenster auf Kipp (spart bis zu 15% Heizkosten).</p>
          <p>• Thermostat um 1 Grad senken spart rund 6% Energie.</p>
          <p>• Waschmaschine nur voll beladen nutzen.</p>
        </CardContent>
      </Card>
    </div>
  );
}
