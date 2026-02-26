import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Impressum = () => {
    const navigate = useNavigate();

    return (
        <div className="container mx-auto py-10 px-4 max-w-4xl">
            <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="mb-6"
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück
            </Button>

            <div className="bg-card p-8 rounded-lg border shadow-sm">
                <h1 className="text-3xl font-bold mb-6">Impressum</h1>
                <div className="space-y-6 text-muted-foreground">
                    <section className="bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800 rounded">
                        <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                            🚧 Platzhalter für den Live-Betrieb
                        </p>
                        <p className="text-sm">
                            Bitte ersetzen Sie diesen Text durch Ihr rechtlich verbindliches Impressum gemäß § 5 DDG.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">Angaben gemäß § 5 DDG</h2>
                        <p>[Vorname Nachname / Firmenname]</p>
                        <p>[Straße Hausnummer]</p>
                        <p>[PLZ Ort]</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">Kontakt</h2>
                        <p>Telefon: [Telefonnummer]</p>
                        <p>E-Mail: [E-Mail-Adresse]</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">Vertretungsberechtigt</h2>
                        <p>[Name der vertretungsberechtigten Person]</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">Registereintrag</h2>
                        <p>Registergericht: [Name des Registergerichts]</p>
                        <p>Registernummer: [Nummer des Registereintrags]</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">Umsatzsteuer-ID</h2>
                        <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: [Umsatzsteuer-ID]</p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Impressum;
