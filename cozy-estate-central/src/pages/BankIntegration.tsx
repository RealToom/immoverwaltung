import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    Landmark, Plus, Link2, Upload, CheckCircle2, AlertCircle,
    CreditCard, ArrowUpRight, ArrowDownRight, RefreshCcw,
    Building2, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBankAccounts, useCreateBankAccount, useSyncBankAccount, useImportTransactions } from "@/hooks/api/useBankAccounts";
import { useTransactions } from "@/hooks/api/useFinance";

export default function BankIntegration() {
    const { toast } = useToast();
    const { data: banks = [], isLoading: pLoading } = useBankAccounts();
    const { data: transactionsData, isLoading: tLoading } = useTransactions(1, 10);

    // Mutations
    const createBank = useCreateBankAccount();
    const syncBank = useSyncBankAccount();
    const importStats = useImportTransactions();

    const [connectOpen, setConnectOpen] = useState(false);
    const [csvUploadOpen, setCsvUploadOpen] = useState(false);
    const [newBank, setNewBank] = useState({ name: "", iban: "", bic: "" });
    const [csvFile, setCsvFile] = useState<File | null>(null);

    const totalBalance = banks.reduce((s, b) => s + b.balance, 0);

    const handleConnect = () => {
        if (!newBank.name.trim() || !newBank.iban.trim()) {
            toast({ title: "Fehler", description: "Name und IBAN sind Pflichtfelder.", variant: "destructive" });
            return;
        }

        createBank.mutate(newBank, {
            onSuccess: () => {
                setNewBank({ name: "", iban: "", bic: "" });
                setConnectOpen(false);
                toast({ title: "Verbunden", description: "Bankkonto wurde erfolgreich angelegt." });
            },
            onError: () => {
                toast({ title: "Fehler", description: "Bankkonto konnte nicht angelegt werden.", variant: "destructive" });
            }
        });
    };

    const handleSync = (bankId: number) => {
        syncBank.mutate(bankId, {
            onSuccess: () => {
                toast({ title: "Synchronisiert", description: "Kontodaten wurden aktualisiert." });
            }
        });
    };

    const handleCsvUpload = () => {
        if (!csvFile) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) return;

            // Simple CSV Parser (Datum, Beschreibung, Betrag, IBAN)
            // Assumes Header row, semicolon or comma separated
            const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
            const transactions = [];

            // Skip header if it contains "Datum" or "Date"
            const startIndex = (lines[0].toLowerCase().includes("datum") || lines[0].toLowerCase().includes("date")) ? 1 : 0;

            for (let i = startIndex; i < lines.length; i++) {
                // Split by ; or , but act dumb for now (smart CSV parsing is complex)
                const cols = lines[i].split(/[;,]/).map(s => s.trim().replace(/^"|"$/g, ''));
                if (cols.length < 3) continue;

                // Expected: Date, Description, Amount, IBAN
                const dateStr = cols[0]; // YYYY-MM-DD or DD.MM.YYYY
                let date = new Date(dateStr);
                if (isNaN(date.getTime()) && dateStr.includes(".")) {
                    const parts = dateStr.split(".");
                    date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                }

                const description = cols[1];
                const amount = parseFloat(cols[2].replace(",", "."));
                const iban = cols[3] || "";

                if (!isNaN(amount) && !isNaN(date.getTime())) {
                    transactions.push({ date: date.toISOString(), description, amount, iban });
                }
            }

            importStats.mutate(transactions, {
                onSuccess: (res) => {
                    setCsvUploadOpen(false);
                    setCsvFile(null);
                    toast({ title: "Importiert", description: `${res.data.imported} Transaktionen erfolgreich importiert.` });
                },
                onError: () => {
                    toast({ title: "Fehler", description: "Import fehlgeschlagen.", variant: "destructive" });
                }
            });
        };
        reader.readAsText(csvFile);
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);

    const formatDate = (date: Date | string) => {
        const d = new Date(date);
        return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const formatDateTime = (date: Date | string) => {
        const d = new Date(date);
        return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    return (
        <div className="flex-1 flex flex-col min-h-screen">
            <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                <Separator orientation="vertical" className="h-6" />
                <div className="flex-1">
                    <h1 className="font-heading text-lg font-semibold text-foreground">Bankanbindung</h1>
                    <p className="text-xs text-muted-foreground">Bankkonten verwalten & Transaktionen importieren</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCsvUploadOpen(true)} className="gap-1.5">
                        <Upload className="h-4 w-4" />
                        CSV Import
                    </Button>
                    <Button size="sm" onClick={() => setConnectOpen(true)} className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        Bank verbinden
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-6 space-y-6 overflow-auto">
                {/* KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="border border-border/60 shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                <Landmark className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Verbundene Konten</p>
                                <p className="text-xl font-heading font-bold">{banks.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border border-border/60 shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
                                <CreditCard className="h-5 w-5 text-success" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Gesamtsaldo</p>
                                <p className="text-xl font-heading font-bold text-success">{formatCurrency(totalBalance)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border border-border/60 shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
                                <Link2 className="h-5 w-5 text-accent-foreground" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Status</p>
                                <p className="text-xl font-heading font-bold">
                                    {banks.every((b) => b.status === "connected") ? "Alle verbunden" : "Fehler"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Bank Accounts */}
                {pLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {banks.map((bank) => (
                            <Card key={bank.id} className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                                <Building2 className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base font-heading font-semibold">{bank.name}</CardTitle>
                                                <p className="text-xs text-muted-foreground font-mono">{bank.iban}</p>
                                            </div>
                                        </div>
                                        <Badge className={bank.status === "connected" ? "bg-success/15 text-success border-0" : "bg-destructive/15 text-destructive border-0"}>
                                            {bank.status === "connected" ? (
                                                <><CheckCircle2 className="h-3 w-3 mr-1" /> Verbunden</>
                                            ) : (
                                                <><AlertCircle className="h-3 w-3 mr-1" /> Fehler</>
                                            )}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                                        <span className="text-xs text-muted-foreground">Kontostand</span>
                                        <span className="text-lg font-heading font-bold text-foreground">{formatCurrency(bank.balance)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Letzte Sync: {formatDateTime(bank.lastSync)}</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 gap-1 text-xs"
                                            onClick={() => handleSync(bank.id)}
                                            disabled={syncBank.isPending}
                                        >
                                            {syncBank.isPending ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <RefreshCcw className="h-3.5 w-3.5" />
                                            )}
                                            Sync
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Recent Transactions */}
                <Card className="border border-border/60 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-heading font-semibold">Letzte Banktransaktionen</CardTitle>
                        <CardDescription>Automatisch importierte Kontobewegungen</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {tLoading ? (
                            <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : (
                            <div className="divide-y divide-border/40">
                                {transactionsData?.data.map((tx) => {
                                    const isIncome = tx.type === "EINNAHME";
                                    return (
                                        <div key={tx.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                                            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isIncome ? "bg-success/15" : "bg-destructive/10"}`}>
                                                {isIncome ? (
                                                    <ArrowUpRight className="h-4 w-4 text-success" />
                                                ) : (
                                                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDate(tx.date)}
                                                    {tx.bankAccount && <span className="ml-1">· {tx.bankAccount.name}</span>}
                                                </p>
                                            </div>
                                            <span className={`text-sm font-semibold ${isIncome ? "text-success" : "text-destructive"}`}>
                                                {isIncome ? "+" : ""}{formatCurrency(Math.abs(tx.amount))}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>

            {/* Connect Bank Dialog */}
            <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Bankverbindung hinzufügen</DialogTitle>
                        <DialogDescription>Geben Sie die Kontodaten ein, um ein Bankkonto zu verbinden.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label htmlFor="bank-name">Kontoname *</Label>
                            <Input id="bank-name" value={newBank.name} onChange={(e) => setNewBank((b) => ({ ...b, name: e.target.value }))} placeholder="z.B. Sparkasse Hausverwaltung" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="bank-iban">IBAN *</Label>
                            <Input id="bank-iban" value={newBank.iban} onChange={(e) => setNewBank((b) => ({ ...b, iban: e.target.value }))} placeholder="DE89 3704 0044 ..." />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="bank-bic">BIC</Label>
                            <Input id="bank-bic" value={newBank.bic} onChange={(e) => setNewBank((b) => ({ ...b, bic: e.target.value }))} placeholder="COBADEFFXXX" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConnectOpen(false)}>Abbrechen</Button>
                        <Button onClick={handleConnect} disabled={createBank.isPending} className="gap-1.5">
                            {createBank.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            <Link2 className="h-4 w-4" />
                            Verbinden
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* CSV Upload Dialog */}
            <Dialog open={csvUploadOpen} onOpenChange={setCsvUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Transaktionen importieren</DialogTitle>
                        <DialogDescription>Laden Sie eine CSV-Datei mit Banktransaktionen hoch.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="csv-file">CSV-Datei</Label>
                            <Input
                                id="csv-file"
                                type="file"
                                accept=".csv"
                                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                            />
                            <p className="text-xs text-muted-foreground">Format: Datum, Beschreibung, Betrag, IBAN</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCsvUploadOpen(false)}>Abbrechen</Button>
                        <Button onClick={handleCsvUpload} disabled={!csvFile || importStats.isPending} className="gap-1.5">
                            {importStats.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Importieren
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
