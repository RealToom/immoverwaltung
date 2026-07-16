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
                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">Angaben gemäß § 5 DDG</h2>
                        <p>[Vorname Nachname / Firmenname]</p>
                        <p>[Rechtsform, z. B. GmbH / GbR / Einzelunternehmen]</p>
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
                        <p>[Name der vertretungsberechtigten Person(en)]</p>
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

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">Redaktionell verantwortlich</h2>
                        <p>[Name und Anschrift der verantwortlichen Person gemäß § 18 Abs. 2 MStV]</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">Haftung für Inhalte</h2>
                        <p>Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
                            verantwortlich (§ 7 Abs. 1 DDG). Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht
                            verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">Haftung für Links</h2>
                        <p>Unser Angebot enthält ggf. Links zu externen Websites Dritter, auf deren Inhalte wir keinen
                            Einfluss haben. Für diese fremden Inhalte ist stets der jeweilige Anbieter verantwortlich.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">Urheberrecht</h2>
                        <p>Die durch die Betreiber erstellten Inhalte und Werke unterliegen dem deutschen Urheberrecht.
                            Beiträge Dritter sind als solche gekennzeichnet.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">Verbraucherstreitbeilegung</h2>
                        <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
                            Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG). Die Plattform der EU zur
                            Online-Streitbeilegung ist zum 20.07.2025 eingestellt worden.</p>
                    </section>

                    <p className="text-sm italic pt-4 border-t">
                        Hinweis: Die mit [ ] markierten Felder sind vor dem Produktivbetrieb mit den tatsächlichen
                        Betreiberdaten zu füllen. Vor Veröffentlichung rechtlich prüfen lassen (z. B. Anwalt oder e-Recht24).
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Impressum;
