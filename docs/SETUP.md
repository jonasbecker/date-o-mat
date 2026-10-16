# Setup-Anleitung

Alles, was du einmalig von Hand einrichten musst. Dauer: etwa 30–40 Minuten.
Reihenfolge einhalten, weil spätere Schritte Werte aus früheren brauchen.

| Schritt | Wofür | Ab Meilenstein |
|---|---|---|
| 0. Secrets erzeugen | Verschlüsselung, Cron, Push | M1 |
| 1. Neon | Datenbank | M1 |
| 2. Vercel-Projekt | Hosting, liefert die App-URL | M1 |
| 3. Google Cloud | Login + Kalender | M1 (Kalender ab M3) |
| 4. Umgebungsvariablen | alles zusammenstecken | M1 |
| 5. Testen | | M1 |
| 6. cron-job.org | Erinnerungen, Zyklus-Wechsel | M4 |
| 7. Lokal entwickeln | optional | – |
| 8. Go-live-Check | alles einmal durchprobieren | M7 |
| 9. Betrieb & Wartung | Updates, Backups, Schlüssel | – |

Halte eine Notiz offen (z. B. im Passwortmanager), in die du alle Werte sammelst.
**Nichts davon kommt ins Git-Repo.**

---

## 0. Secrets erzeugen

Voraussetzung: [Node.js 22 LTS](https://nodejs.org) ist installiert.

```bash
git clone https://github.com/jonasbecker/date-o-mat.git
cd date-o-mat
npm install
npm run gen:keys
```

Die Ausgabe sieht so aus – alle vier Zeilen in deine Notiz kopieren:

```
TOKEN_ENCRYPTION_KEY=…
CRON_SECRET=…
VAPID_PUBLIC_KEY=…
VAPID_PRIVATE_KEY=…
```

> ⚠️ `TOKEN_ENCRYPTION_KEY` später **nie ändern**. Sonst kann die App die gespeicherten
> Google-Tokens nicht mehr lesen und ihr müsst eure Kalender neu verbinden.

## 1. Datenbank: Neon

1. <https://console.neon.tech> öffnen → **Sign up with GitHub**.
2. **Create project**
   - Project name: `date-o-mat`
   - Postgres version: Standard lassen
   - Region: **AWS Europe Central 1 (Frankfurt)**
3. Im Projekt-Dashboard oben auf **Connect** klicken.
   - Schalter **Connection pooling = an** → Connection String kopieren → in die Notiz als `DATABASE_URL`
     (der Host enthält `-pooler`).
   - Schalter **Connection pooling = aus** → kopieren → als `DATABASE_URL_UNPOOLED`.

## 2. Vercel-Projekt anlegen

1. <https://vercel.com/signup> → **Hobby** → **Continue with GitHub**.
2. **Add New… → Project** → bei „Import Git Repository“ `date-o-mat` auswählen.
   Taucht das Repo nicht auf: **Adjust GitHub App Permissions** → Zugriff auf `date-o-mat` erlauben.
3. Framework Preset: **Next.js** (wird erkannt). Root Directory und Build Command **nicht** ändern.
4. **Environment Variables** aufklappen und vorerst nur diese zwei eintragen:
   `DATABASE_URL` und `DATABASE_URL_UNPOOLED` (aus Schritt 1).
5. **Deploy**. Der Build legt dabei automatisch die Tabellen in der Datenbank an.
6. Danach **Settings → Domains** öffnen. Die Domain dort ist deine **App-URL**, z. B.
   `https://date-o-mat.vercel.app`. Falls sie einen Zufallsanhang hat, kannst du sie über
   **Edit** in etwas Hübsches ändern, z. B. `date-o-mat-jonas.vercel.app`.
   → in die Notiz als `APP_URL` (mit `https://`, **ohne** `/` am Ende).

Die App läuft jetzt schon, der Login aber noch nicht. Das ist normal.

## 3. Google Cloud

Mit **deinem** Google-Konto anmelden. Deine Freundin braucht hier nichts zu tun.

### 3.1 Projekt anlegen

1. <https://console.cloud.google.com> öffnen.
2. Oben links auf die Projektauswahl → **Neues Projekt** → Name `Date-O-Mat` → **Erstellen**.
3. Sicherstellen, dass oben das neue Projekt ausgewählt ist.

### 3.2 Google Calendar API aktivieren

1. Menü ☰ → **APIs und Dienste → Bibliothek**.
2. Nach **Google Calendar API** suchen → öffnen → **Aktivieren**.

### 3.3 Zustimmungsbildschirm („Google Auth Platform“)

1. Menü ☰ → **Google Auth Platform** (heißt teils auch „OAuth-Zustimmungsbildschirm“) → **Jetzt starten**.
2. **App-Informationen**: App-Name `Date-O-Mat`, Nutzersupport-E-Mail = deine Adresse → Weiter.
3. **Zielgruppe**: **Extern** → Weiter.
4. **Kontaktdaten**: deine Adresse → Weiter → Richtlinie akzeptieren → **Erstellen**.
5. Links **Branding**: **kein Logo hochladen**. Ein Logo verlangt eine Prüfung durch Google.
6. Links **Datenzugriff** → **Bereiche hinzufügen oder entfernen**:
   - In der Liste anhaken: `…/auth/userinfo.email`, `…/auth/userinfo.profile`, `openid`
   - Unten bei **Bereiche manuell hinzufügen** diese drei Zeilen einfügen → **Zur Tabelle hinzufügen**:
     ```
     https://www.googleapis.com/auth/calendar.events.freebusy
     https://www.googleapis.com/auth/calendar.calendarlist.readonly
     https://www.googleapis.com/auth/calendar.events.owned
     ```
   - **Aktualisieren** → **Speichern**.
   - Was die drei bedeuten: Belegt-Zeiten lesen (ohne Titel oder Details), die Namen deiner
     Kalender sehen (für die Auswahl) und Termine in deinen eigenen Kalendern anlegen
     (die Date-Einladung).
   - Falls du früher schon `calendar.freebusy` eingetragen hast: kannst du drinlassen oder
     entfernen, die App nutzt ihn nicht.
7. Links **Zielgruppe** → bei Veröffentlichungsstatus „Testen“ auf **App veröffentlichen** → bestätigen.
   Der Status ist jetzt **In Produktion**.
   - Google weist darauf hin, dass eine Überprüfung nötig sein kann → **nicht** zur Überprüfung einreichen.
   - Testnutzer braucht ihr damit nicht.
   - Warum: Im Testmodus laufen die Google-Tokens nach 7 Tagen ab und Erinnerungen würden
     ausfallen. Als unverifizierte App seht ihr beim ersten Login einmalig einen Warnhinweis,
     sonst ändert sich nichts. Wer rein darf, regelt die App selbst über `ALLOWED_EMAILS`.

### 3.4 OAuth-Client erstellen

1. **Google Auth Platform → Clients → Client erstellen**.
2. Anwendungstyp: **Webanwendung**, Name: `Date-O-Mat Web`.
3. **Autorisierte JavaScript-Quellen** → zwei Einträge:
   ```
   https://DEINE-APP.vercel.app
   http://localhost:3000
   ```
4. **Autorisierte Weiterleitungs-URIs** → zwei Einträge:
   ```
   https://DEINE-APP.vercel.app/api/auth/google/callback
   http://localhost:3000/api/auth/google/callback
   ```
   `DEINE-APP.vercel.app` durch die Domain aus Schritt 2.6 ersetzen.
5. **Erstellen**. **Client-ID** und **Clientschlüssel** sofort kopieren (oder JSON herunterladen).
   Der Schlüssel wird später unter Umständen nicht mehr angezeigt.
   → in die Notiz als `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET`.

Änderungen am Client brauchen manchmal ein paar Minuten, bis sie greifen.

## 4. Umgebungsvariablen in Vercel

Vercel → Projekt → **Settings → Environment Variables**. Alle Werte für die Umgebungen
**Production** und **Preview** anlegen. Tipp: Du kannst den ganzen Block im `KEY=wert`-Format
auf einmal ins erste Key-Feld einfügen.

| Variable | Wert |
|---|---|
| `APP_URL` | `https://DEINE-APP.vercel.app` (ohne `/` am Ende) |
| `DATABASE_URL` | aus Schritt 1 (pooled), steht schon drin |
| `DATABASE_URL_UNPOOLED` | aus Schritt 1 (direkt), steht schon drin |
| `GOOGLE_CLIENT_ID` | aus Schritt 3.4 |
| `GOOGLE_CLIENT_SECRET` | aus Schritt 3.4 |
| `ALLOWED_EMAILS` | eure zwei Google-Adressen, kommagetrennt: `du@gmail.com,sie@gmail.com` |
| `TOKEN_ENCRYPTION_KEY` | aus Schritt 0 |
| `CRON_SECRET` | aus Schritt 0 |
| `VAPID_PUBLIC_KEY` | aus Schritt 0 |
| `VAPID_PRIVATE_KEY` | aus Schritt 0 |
| `VAPID_SUBJECT` | `mailto:` + deine Adresse, z. B. `mailto:du@gmail.com` |

Danach neu deployen, denn Variablen gelten erst für neue Deployments:
**Deployments** → oberstes Deployment → **⋯ → Redeploy**.

## 5. Meilenstein 1 testen

1. App-URL am Handy öffnen → **Mit Google anmelden** → Konto wählen.
2. Hinweis „Google hat diese App nicht überprüft“ → **Erweitert** → **Weiter zu Date-O-Mat (unsicher)**.
3. Du: **Paar starten** → **Code teilen** → an deine Freundin schicken.
4. Sie: App-URL öffnen, anmelden (gleicher Hinweis), Code eingeben → **Beitreten**.
5. Ihr landet beide auf der Startseite „Ihr seid gekoppelt“. Dein Code-Bildschirm springt
   nach ein paar Sekunden von selbst weiter.
6. Gegenprobe: Mit einer dritten Google-Adresse, die nicht in `ALLOWED_EMAILS` steht,
   kommt „Diese Google-Adresse ist nicht freigeschaltet“.

### Meilenstein 3 testen: Kalender & freie Zeiten

1. Am Handy **Planen** öffnen → **Kalender verbinden** → Google fragt nach den drei
   Kalender-Berechtigungen → alle Häkchen setzen → **Weiter**.
2. Deine Freundin macht dasselbe auf ihrem Handy.
3. **Planen** zeigt jetzt bis zu fünf gemeinsame freie Zeiten für ☕ klein und 🎡 groß.
   Gegenprobe: Trag dir in Google einen Termin in einen der vorgeschlagenen Slots ein und lade
   die Seite neu. Der Slot (plus 30 Minuten Puffer) muss verschwinden.
4. Unter **Einstellungen → Kalender** wählst du, welche Kalender als „belegt“ zählen.
   Abonnierte Kalender (z. B. ein Uni-Stundenplan) sind standardmäßig an. Erscheint
   auf der Planen-Seite ein gelber Hinweis „Kalender konnte nicht gelesen werden“, sag mir
   Bescheid, welcher Kalender es ist.

### Meilenstein 5 testen: Date festlegen

1. **Planen** öffnen: Top-Tipp und eine Idee sind schon ausgewählt → **Date festlegen 🎉**.
2. In deinem Google Kalender steht jetzt „💞 Date: …“, deine Freundin bekommt eine Einladung
   (per Mail und in ihrem Kalender).
3. Sie öffnet die App → **Passt! 💚** → Konfetti, beide sehen „Date steht!“.
   (Nimmt sie stattdessen die Einladung in Google an, zeigt die App das spätestens nach dem
   nächsten Cron-Lauf als bestätigt.)
4. **Ändern** → anderen Slot wählen → der Termin verschiebt sich in beiden Kalendern.
5. **Absagen** → der Termin verschwindet, sie bekommt eine Absage von Google.

## 6. cron-job.org (ab Meilenstein 4)

Ruft alle 5 Minuten die App auf, damit Runden wechseln, Vorschläge bereitliegen und
Erinnerungen rausgehen. Ohne Cron läuft die App trotzdem: Runden werden
dann beim nächsten Öffnen nachgezogen – nur Push-Erinnerungen bräuchten den Cron.

Voraussetzung: `CRON_SECRET` ist in Vercel eingetragen (Schritt 4).

1. <https://console.cron-job.org/signup> → Konto anlegen.
2. **Cronjob erstellen**
   - Titel: `Date-O-Mat Tick`
   - URL: `https://DEINE-APP.vercel.app/api/cron/tick`
   - Ausführung: **alle 5 Minuten**
3. Tab **Erweitert**
   - Anfragemethode: **POST**
   - Header hinzufügen: Name `Authorization`, Wert `Bearer DEIN_CRON_SECRET`
4. **Erstellen** → **Testlauf**. Erwartet: Status 200 und `{"ok":true,"couples":1,…}`.
   Status 401 = falsches Secret, 503 = `CRON_SECRET` fehlt in Vercel.

### Meilenstein 4 testen: Runden über mehrere Wochen

1. Startseite: Wer zuerst das Paar gestartet hat, sieht „Du bist dran!“ mit Deadline, die
   andere Person „… ist dran“ und kann mit „Ich übernehme diese Runde“ einspringen.
2. Zum Durchspielen mehrerer Runden in Vercel vorübergehend `ENABLE_DEV_TOOLS=1` setzen
   und neu deployen. Dann gibt es in den Einstellungen die **Dev-Uhr**:
   „+1 Woche“ → Runde 2, die andere Person ist dran, Runde 1 erscheint freundlich als
   ausgefallen. Rhythmus und Modus umstellen und weiter vorspulen.
3. **Alles zurücksetzen** stellt die echte Zeit ein und löscht die Test-Runden.
4. Danach `ENABLE_DEV_TOOLS` wieder entfernen (oder `0`) und neu deployen.

### Meilenstein 6 testen: Push-Erinnerungen

Voraussetzung: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` und `VAPID_SUBJECT` sind in Vercel
eingetragen (Schritt 4). Fehlen sie, zeigen die Einstellungen „Push ist auf dem Server noch
nicht eingerichtet“.

**iPhone (iOS 16.4 oder neuer):**

1. Die App in **Safari** öffnen → unten **Teilen** → **Zum Home-Bildschirm** → **Hinzufügen**.
2. Den Date-O-Mat über das neue Icon öffnen (nicht mehr über Safari) und einloggen.
3. **Einstellungen → Erinnerungen → Push aktivieren** → Mitteilungen **Erlauben**.
4. **Test-Push** tippen → nach wenigen Sekunden kommt „Date-O-Mat“ als Mitteilung.

**Android (Chrome):** App öffnen → **Einstellungen → Erinnerungen → Push aktivieren** →
erlauben → **Test-Push**. Optional über das Chrome-Menü **App installieren**.

Danach:

- Eine Person plant ein Date → die andere bekommt sofort „… hat ein Date geplant 🎉“.
- Mit der Dev-Uhr (siehe oben) lassen sich Rundenstart, „Noch 24 Stunden“, „Morgen ist
  Date-Tag“ und „In 2 Stunden“ auslösen: Uhr vorstellen, dann in cron-job.org **Testlauf**.
- Jede Art lässt sich unter „Erinnere mich an …“ einzeln ausschalten.
- Kommt nichts an: Mitteilungen für die App in den Systemeinstellungen erlaubt? Fokus/„Nicht
  stören“ aus? Auf dem iPhone die App einmal vom Home-Bildschirm aus öffnen.

### Meilenstein 8 testen: Rückblick

1. Nach einem Date (oder mit der Dev-Uhr über das Ende eines Dates hinaus vorgestellt) fragt die
   Startseite „Wie war …?“. Antippen → Herzen wählen → optional Notiz → **Bewertung abschicken**.
2. Die andere Person bekommt „… hat verraten, wie's war“ und sieht unter **Dates** ein 🔒:
   Die Herzen werden erst sichtbar, wenn sie selbst bewertet hat.
3. Am Tag nach dem Date um 11 Uhr kommt „Wie war's? 💭“ an alle, die noch nicht bewertet haben
   (Dev-Uhr auf 11:05 am Folgetag, dann cron-job.org **Testlauf**).
4. Die Einstellungen liegen jetzt hinter dem Regler-Symbol oben rechts auf der Startseite.

### Meilenstein 9 einrichten: Fotos

1. In Vercel im Projekt **Storage → Create Database → Blob** wählen, Name z. B.
   `date-o-mat-fotos`, Zugriff **Private**, Region **Frankfurt (fra1)**.
2. Prefix `BLOB` lassen und **unbedingt den Haken bei „Add a read-write token env var to this
   connection“ setzen** – nur dann legt Vercel `BLOB_READ_WRITE_TOKEN` an, an dem die App den
   Speicher erkennt. Dann **Create** / mit dem Projekt verbinden.
3. Neu deployen (**Deployments → … → Redeploy**).
4. Test: Unter **Dates** ein vergangenes Date öffnen → **📷 Fotos hinzufügen**. Das Foto
   erscheint in der Vorschau und als Titelbild in der Liste.

Platz: Ein Foto braucht mit Vorschau etwa 0,2–0,5 MB. Im Hobby-Plan ist 1 GB frei, das
reicht für einige tausend Fotos. Stand unter **Storage → date-o-mat-fotos**.

### Meilenstein 11: KI-Vorschläge

Nichts extra einzurichten: Sie nutzen denselben `ANTHROPIC_API_KEY` wie die Event-Quellen
(Schritte unten). Das Wetter kommt von Open-Meteo und braucht keinen Schlüssel.
Test: **Planen** → Termin wählen → **✨ Ideen von der KI** → **Vorschläge holen**.
Kosten: grob 0,05 Cent pro Vorschlags-Runde; mehr als 20 Runden pro Tag lässt die App nicht zu.

### Meilenstein 12 einrichten: Event-Quellen

1. Auf [console.anthropic.com](https://console.anthropic.com) ein Konto anlegen, unter
   **Billing** etwas Guthaben aufladen (5 $ reichen lange) und unter **Limits** ein
   monatliches Ausgabenlimit setzen, z. B. 5 $.
2. **API Keys → Create Key**, Name z. B. `date-o-mat`, Schlüssel kopieren.
3. In Vercel unter **Settings → Environment Variables** `ANTHROPIC_API_KEY` eintragen
   (Production) und neu deployen.
4. In der App **Einstellungen → Event-Quellen → Köln-Quellen hinzufügen**. Nach etwa einer
   Minute steht bei jeder Quelle „✓ … Einträge“ oder ein Hinweis, warum es nicht klappte.
5. Unter **Ideen → Was läuft** erscheinen die Events; „✓ Ihr habt beide Zeit“ braucht
   verbundene Kalender bei euch beiden.

Kosten: pro gelesener Seite grob 0,1–0,5 Cent (Haiku 5.5), bei vier Quellen täglich also
wenige Cent bis etwa 50 Cent im Monat. Danach liest der Cron-Tick jede Quelle einmal am Tag
ab 5 Uhr.

Steht bei einer Quelle „Seite ist fast leer (… JavaScript)“ oder „HTTP 403“, hat die App auch
keinen RSS-Feed der Seite gefunden (den probiert sie automatisch). Oft hilft eine Unterseite (z. B. direkt der Veranstaltungskalender statt der
Startseite).

### Link → Idee (M15)

Nichts extra einzurichten – nutzt denselben `ANTHROPIC_API_KEY`. Kosten: grob 0,1–0,3 Cent
pro Link (das Vorschaubild zählt mit); mehr als 30 Links pro Tag lässt die App nicht zu.
Ohne Schlüssel wird nur der Titel aus dem Link übernommen.

- **iPhone:** In TikTok/Instagram **Teilen → Link kopieren**, in der App **+** → ins Titelfeld
  tippen → **Einsetzen** (oder **🔗 Link einfügen**).
- **Android:** Ist die App installiert (Home-Bildschirm), steht sie direkt im Teilen-Menü.
  Nach einem Update des Manifests kann es nötig sein, die App einmal vom Home-Bildschirm zu
  entfernen und neu hinzuzufügen.

### Entdecken (M17)

Nichts extra einzurichten – nutzt denselben `ANTHROPIC_API_KEY`. Die erste Ladung entsteht
beim ersten Öffnen von **Ideen → 💞 Entdecken** (etwa eine halbe Minute). Kosten: grob
0,5–1 Cent pro Ladung à 20 Karten, höchstens 6 Ladungen pro Tag. Wie viele Event-Kombis
dabei sind, stellt ihr unter **Einstellungen → Entdecken** ein.

### Budget (M18)

Nichts einzurichten. Unter **Einstellungen → Budget** einen Monatsbetrag eintragen; der
Spartopf zählt ab diesem Monat. Den Monatsabschluss macht der Cron-Tick am 1. des Monats.

### Besondere Tage (M19)

Unter **Einstellungen → Besondere Tage** Jahrestag und Geburtstage eintragen. Erinnerungen
kommen per Push (Erinnerungen → „Besondere Tage“).

### iPhone: Teilen per Kurzbefehl (M21)

Jede:r einmal auf dem eigenen iPhone: **Einstellungen → Unterwegs & Teilen → Schlüssel
erstellen**, dann der Anleitung darunter folgen (Kurzbefehle-App, etwa 2 Minuten). Danach in
TikTok/Instagram: **Teilen → Date-O-Mat**. Unter Android geht das ohne Kurzbefehl direkt.

### Status prüfen (M16)

**Einstellungen → Läuft alles?** zeigt auf einen Blick, ob der Cron läuft, beide Kalender
verbunden sind, Push auf euren Geräten an ist und wie viel KI heute verbraucht wurde.
Nach dem Deploy dieser Version braucht es einen Cron-Lauf (≤ 5 Min.), bis „Automatik“ grün ist.

## 7. Lokal entwickeln (optional)

1. In Neon: **Branches → Create branch** `dev`. Dessen Connection Strings nutzen, damit lokale
   Tests nicht eure echten Daten anfassen.
2. `cp .env.example .env.local` und ausfüllen (`APP_URL=http://localhost:3000`).
3. ```bash
   npm run db:migrate   # Tabellen anlegen
   npm run dev          # http://localhost:3000
   ```
4. Qualität prüfen: `npm run check` (Lint, Typecheck, Unit-Tests).
5. End-to-End-Tests (leeren die Datenbank – nur mit einer Wegwerf-DB, z. B. lokalem Postgres
   oder einem eigenen Neon-Branch): `E2E_DATABASE_URL=…` in `.env.local` eintragen, dann
   `npm run e2e` – der Build passiert dabei von selbst.
   Braucht `openssl` und Chromium (`npx playwright install chromium`). Dieselben Tests laufen
   bei jedem Push in GitHub Actions (Reiter **Actions** im Repo).

## 8. Go-live-Check

Einmal nach dem ersten vollständigen Deploy, am besten zu zweit mit beiden Handys:

- [ ] In Vercel sind alle Variablen aus Schritt 4 gesetzt, `ENABLE_DEV_TOOLS` **nicht**
      (oder `0`). In den Einstellungen taucht keine „Dev-Uhr“ auf.
- [ ] Beide sind eingeloggt und gekoppelt, beide Kalender sind verbunden
      (Einstellungen → Kalender: „Verbunden mit …“ und „‹Name›: verbunden ✓“).
- [ ] Beide haben die App auf dem Home-Bildschirm und Push aktiviert, **Test-Push** kommt an.
- [ ] cron-job.org: letzter Lauf grün (Status 200), Ausführung alle 5 Minuten.
- [ ] Einstellungen → **Läuft alles?** zeigt „✅ Alles läuft“.
- [ ] Ein Probe-Date planen → steht in beiden Google-Kalendern → **Passt!** → **Absagen** →
      der Termin verschwindet wieder.
- [ ] Flugmodus an, App öffnen → „Gerade offline 📡“ statt einer Browser-Fehlerseite.
- [ ] Rhythmus, Modus und Zeitfenster in den Einstellungen nach euren Wünschen einstellen.

## 9. Betrieb & Wartung

**Updates einspielen:** Jeder Push auf `main` deployt automatisch. Neue Migrationen laufen
beim Build von selbst. Schlägt ein Build fehl, bleibt die alte Version online.
Vercel → **Deployments** → älteres Deployment → **⋯ → Promote to Production** springt zurück.

**Backups:** Neon hält im Free-Plan einen Wiederherstellungszeitraum von einigen Stunden
(**Branches → Restore**). Für mehr Sicherheit gelegentlich lokal sichern:
`pg_dump "$DATABASE_URL_UNPOOLED" > date-o-mat-backup.sql`.

**Eine Person entfernen:** Adresse aus `ALLOWED_EMAILS` löschen und neu deployen. Die
Person ist beim nächsten Seitenaufruf abgemeldet.

**Secrets wechseln** (z. B. falls eins versehentlich geteilt wurde):

| Secret | Folge eines Wechsels |
|---|---|
| `CRON_SECRET` | Auch den Header in cron-job.org anpassen. |
| `GOOGLE_CLIENT_SECRET` | In Google Cloud ein neues Secret anlegen, eintragen, altes löschen. Keine Folgen für euch. |
| `TOKEN_ENCRYPTION_KEY` | Gespeicherte Google-Tokens sind danach unlesbar: beide müssen den Kalender in den Einstellungen **neu verbinden**. |
| `VAPID_*` | Alle Push-Abos werden ungültig: beide müssen Push in den Einstellungen neu aktivieren. |

Nach jedem Wechsel: **Redeploy** (siehe Schritt 4).

**Logs:** Vercel → Projekt → **Logs**. Fehler aus dem Cron-Tick beginnen mit `[tick]`,
Kalender-Abgleich mit `[dates]`, Push mit `[push]`. Kalenderdetails oder Tokens stehen
dort nie drin.

## Fehlerbehebung

| Meldung | Ursache / Lösung |
|---|---|
| Termine erscheinen nicht / „Kalender neu verbinden“ | Google-Zugriff wurde widerrufen oder ist abgelaufen → Einstellungen → Kalender → **Neu verbinden**. |
| Push aktivieren tut auf dem iPhone nichts | App muss vom Home-Bildschirm geöffnet werden, nicht in Safari (iOS 16.4+). |
| `redirect_uri_mismatch` bei Google | Die Weiterleitungs-URI im OAuth-Client muss exakt `APP_URL` + `/api/auth/google/callback` sein (https, keine Leerzeichen). |
| „Zugriff blockiert: … nur für Testnutzer“ | App ist noch im Testmodus → Schritt 3.3, Punkt 7. |
| „Diese Google-Adresse ist nicht freigeschaltet“ | Tippfehler in `ALLOWED_EMAILS`? Nach dem Ändern neu deployen. |
| Seite zeigt Fehler 500 | Vercel → Deployment → **Logs**. Bei „Invalid environment configuration“ steht dort, welche Variable fehlt. |
| Login klappt, danach sofort wieder Login-Seite | `APP_URL` passt nicht zur tatsächlich aufgerufenen Domain. |
