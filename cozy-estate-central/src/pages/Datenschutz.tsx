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
                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">1. Verantwortlicher</h2>
                        <p>Verantwortlicher im Sinne der DSGVO ist der Betreiber dieser Anwendung. Name und Kontaktdaten
                            entnehmen Sie bitte dem <button onClick={() => navigate("/impressum")} className="underline">Impressum</button>.
                            Einen Datenschutzbeauftragten haben wir bestellt, sofern gesetzlich vorgeschrieben; ist einer
                            benannt, finden Sie die Kontaktdaten ebenfalls im Impressum.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">2. Verarbeitete Daten &amp; Zwecke</h2>
                        <p>Zur Erbringung der Immobilienverwaltung verarbeiten wir insbesondere:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li>Stammdaten von Mietern, Eigentümern und Ansprechpartnern (Name, Anschrift, Kontaktdaten);</li>
                            <li>Vertrags- und Objektdaten (Mietverträge, Einheiten, Laufzeiten, Mieten, Nebenkosten);</li>
                            <li>Zahlungs- und Bankdaten (Kontoumsätze, IBAN) zur Zahlungszuordnung und Abrechnung;</li>
                            <li>Kommunikationsdaten (E-Mails, Nachrichten, Tickets);</li>
                            <li>technische Nutzungsdaten (IP-Adresse, Zeitpunkt, Browser) sowie Sicherheits-/Audit-Logs.</li>
                        </ul>
                        <p className="mt-2">Zwecke sind die Vertragsdurchführung, die Abrechnung, die Erfüllung gesetzlicher
                            Pflichten sowie die Gewährleistung von IT-Sicherheit.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">3. Rechtsgrundlagen</h2>
                        <p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 DSGVO: lit. b (Vertragserfüllung),
                            lit. c (rechtliche Verpflichtung, z. B. steuer- und handelsrechtliche Aufbewahrung) und
                            lit. f (berechtigtes Interesse an einem sicheren, funktionsfähigen Betrieb).</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">4. Hosting</h2>
                        <p>Die Anwendung wird bei der Hetzner Online GmbH, Gunzenhausen (Deutschland), betrieben; der
                            Serverstandort liegt in Deutschland. Mit dem Anbieter besteht ein Vertrag zur Auftragsverarbeitung
                            nach Art. 28 DSGVO.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">5. Empfänger &amp; Auftragsverarbeiter</h2>
                        <p>Zur Leistungserbringung setzen wir sorgfältig ausgewählte Dienstleister (Auftragsverarbeiter nach
                            Art. 28 DSGVO) ein, u. a.:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li><strong>Hetzner Online GmbH</strong> – Hosting (Deutschland);</li>
                            <li><strong>Anthropic</strong> – KI-gestützte Belegerkennung (Beleg-Scan), sofern aktiviert;</li>
                            <li><strong>GoCardless / Nordigen</strong> – Kontoinformationsdienst (PSD2) zum Abruf von
                                Kontoumsätzen, sofern die Bankanbindung aktiviert ist;</li>
                            <li><strong>E-Mail-Provider</strong> – Verarbeitung ein- und ausgehender E-Mails via IMAP/SMTP,
                                sofern ein Postfach eingerichtet ist.</li>
                        </ul>
                        <p className="mt-2">Eine Übermittlung in Drittländer findet nur statt, soweit ein angemessenes
                            Schutzniveau (z. B. Standardvertragsklauseln) sichergestellt ist.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">6. Speicherdauer</h2>
                        <p>Personenbezogene Daten werden gelöscht, sobald der Zweck entfällt und keine gesetzlichen
                            Aufbewahrungspflichten entgegenstehen. Insbesondere gelten die steuer- und handelsrechtlichen
                            Aufbewahrungsfristen (§ 147 AO, § 257 HGB) von in der Regel 6 bzw. 10 Jahren.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">7. Ihre Rechte</h2>
                        <p>Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
                            Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) sowie Widerspruch
                            (Art. 21) und – soweit die Verarbeitung auf einer Einwilligung beruht – auf jederzeitigen
                            Widerruf (Art. 7 Abs. 3 DSGVO). Zudem steht Ihnen ein Beschwerderecht bei einer
                            Datenschutz-Aufsichtsbehörde zu (Art. 77 DSGVO).</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">8. Cookies</h2>
                        <p>Diese Anwendung verwendet ausschließlich technisch notwendige Session-Cookies bzw. lokalen
                            Speicher, die für den Login und den Betrieb erforderlich sind (§ 25 Abs. 2 TDDDG, Art. 6 Abs. 1
                            lit. f DSGVO). Es findet kein Tracking und keine Weitergabe zu Werbezwecken statt; eine
                            Einwilligung ist hierfür nicht erforderlich.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">9. Datensicherheit</h2>
                        <p>Die Übertragung erfolgt verschlüsselt (SSL/TLS). Zugriffe erfolgen rollenbasiert; sicherheits­relevante
                            Aktionen werden protokolliert.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-2">10. Auftragsverarbeitung für Hausverwaltungen</h2>
                        <p>Nutzt eine Hausverwaltung diese Software zur Verwaltung der Daten ihrer Mieter und Eigentümer,
                            ist die jeweilige Hausverwaltung der datenschutzrechtlich Verantwortliche; der Betreiber der
                            Software handelt insoweit als Auftragsverarbeiter (Art. 28 DSGVO) auf Grundlage eines
                            gesonderten Auftragsverarbeitungsvertrags.</p>
                    </section>

                    <p className="text-sm italic pt-4 border-t">
                        Stand: {new Date().getFullYear()}. Diese Erklärung wird bei Änderungen der Verarbeitung aktualisiert.
                        Hinweis: Muster ohne Gewähr – vor dem Produktivbetrieb rechtlich prüfen lassen (z. B. Anwalt oder
                        e-Recht24) und die konkreten Auftragsverarbeiter/Fristen ergänzen.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Datenschutz;
