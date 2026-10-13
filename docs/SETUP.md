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
     https://www.googleapis.com/auth/calendar.freebusy
     https://www.googleapis.com/auth/calendar.calendarlist.readonly
     https://www.googleapis.com/auth/calendar.events.owned
     ```
   - **Aktualisieren** → **Speichern**.
     (Die Kalender-Bereiche nutzt die App erst ab Meilenstein 3.)
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

## 6. cron-job.org (ab Meilenstein 4)

Ruft alle 5 Minuten die App auf, damit Zyklen wechseln und Erinnerungen rausgehen.
Ich sage Bescheid, wenn es so weit ist.

1. <https://console.cron-job.org/signup> → Konto anlegen.
2. **Cronjob erstellen**
   - Titel: `Date-O-Mat Tick`
   - URL: `https://DEINE-APP.vercel.app/api/cron/tick`
   - Ausführung: **alle 5 Minuten**
3. Tab **Erweitert**
   - Anfragemethode: **POST**
   - Header hinzufügen: Name `Authorization`, Wert `Bearer DEIN_CRON_SECRET`
4. **Erstellen** → **Testlauf**. Erwartet: Status 200.

## 7. Lokal entwickeln (optional)

1. In Neon: **Branches → Create branch** `dev`. Dessen Connection Strings nutzen, damit lokale
   Tests nicht eure echten Daten anfassen.
2. `cp .env.example .env.local` und ausfüllen (`APP_URL=http://localhost:3000`).
3. ```bash
   npm run db:migrate   # Tabellen anlegen
   npm run dev          # http://localhost:3000
   ```
4. Qualität prüfen: `npm test`, `npm run lint`, `npm run typecheck`.

## Fehlerbehebung

| Meldung | Ursache / Lösung |
|---|---|
| `redirect_uri_mismatch` bei Google | Die Weiterleitungs-URI im OAuth-Client muss exakt `APP_URL` + `/api/auth/google/callback` sein (https, keine Leerzeichen). |
| „Zugriff blockiert: … nur für Testnutzer“ | App ist noch im Testmodus → Schritt 3.3, Punkt 7. |
| „Diese Google-Adresse ist nicht freigeschaltet“ | Tippfehler in `ALLOWED_EMAILS`? Nach dem Ändern neu deployen. |
| Seite zeigt Fehler 500 | Vercel → Deployment → **Logs**. Bei „Invalid environment configuration“ steht dort, welche Variable fehlt. |
| Login klappt, danach sofort wieder Login-Seite | `APP_URL` passt nicht zur tatsächlich aufgerufenen Domain. |
