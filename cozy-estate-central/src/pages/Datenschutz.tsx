import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Datenschutz = () => {
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
                <h1 className="text-3xl font-bold mb-6">Datenschutzerklärung</h1>
                <div className="space-y-6 text-muted-foreground">
                    <section className="bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800 rounded">
                        <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                            🚧 Platzhalter für den Live-Betrieb
                        </p>
                        <p className="text-sm">
                            Bitte ersetzen Sie diesen Text durch Ihre rechtlich verbindliche Datenschutzerklärung gemäß DSGVO.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">1. Datenschutz auf einen Blick</h2>
                        <p>Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Anwendung nutzen.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">2. Datenerfassung in dieser Anwendung</h2>
                        <p>Die Datenverarbeitung erfolgt durch den Betreiber der Anwendung. Die Kontaktdaten können Sie dem Impressum entnehmen.</p>
                        <p><strong>Wie erfassen wir Ihre Daten?</strong> Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen (z. B. durch Eingabe in Formulare). Andere Daten werden automatisch beim Besuch der Anwendung durch unsere IT-Systeme erfasst (z. B. IP-Adresse, Browserversion).</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">3. Hosting</h2>
                        <p>Unsere Anwendung wird bei einem deutschen Cloud-Betreiber (z. B. Hetzner Online GmbH) gehostet. Der Standort der Server ist Deutschland.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">4. SSL- bzw. TLS-Verschlüsselung</h2>
                        <p>Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung vertraulicher Inhalte eine SSL-bzw. TLS-Verschlüsselung.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">5. Besondere Funktionen</h2>
                        <p>Diese Anwendung verarbeitet Bankdaten über die Nordigen/GoCardless Schnittstelle und Dokumente über einen KI-Scan (Anthropic). Details hierzu müssen in der finalen Fassung ergänzt werden.</p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Datenschutz;
