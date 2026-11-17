# Miss Nederland – Headshot-keuze-app

Mobielvriendelijke webapp waarmee deelnemers hun gekozen headshot (TLP-fotonummer) doorgeven, met een afgeschermd beheerdersdashboard per provincie/regio en per shoot.

## Gekozen techniek

| Onderdeel | Keuze | Waarom |
|---|---|---|
| Front-end + server | **Next.js 15** (React) | Eén project voor formulier, dashboard en API; werkt uitstekend op mobiel. |
| Database | **Postgres via Neon** (Vercel Storage, gratis plan) | Betrouwbaar, automatisch gekoppeld aan Vercel. De tabellen worden bij het eerste gebruik vanzelf aangemaakt. |
| Hosting | **Vercel** | HTTPS automatisch, eigen subdomein mogelijk, gratis plan volstaat. |
| Beheerder-login | E-mail + wachtwoord, wachtwoord alleen als **bcrypt-hash** opgeslagen, sessie in een beveiligde cookie (12 uur), blokkade na 8 mislukte pogingen per 15 min. | Eenvoudig in beheer, geen extra accounts nodig. |
| Export | CSV (Excel-NL, puntkomma) en **Excel .xlsx** | |

Werkt ook met een Supabase-Postgres-database: zet dan de verbindingslink als `DATABASE_URL`.

## Projectstructuur

```
app/
  s/[token]/page.js        Deelnemersformulier (unieke link per shoot)
  admin/                   Beheerdersdashboard + login
  api/submit               Inzending ontvangen (publiek)
  api/admin/...            Beheer-API (alleen na login)
components/                Formulier en dashboardonderdelen
lib/
  schema.js                Databaseschema (shoots, submissions, settings, ...)
  service.js               Alle logica: validatie, dubbelcontrole, voortgang
  constants.js             Provincies, teksten, huisstijlnaam
app/globals.css            Kleuren en typografie (variabelen bovenaan)
```

## Publiceren (eenmalig, ±15 minuten)

1. **GitHub** – Maak een nieuwe repository (bijv. `miss-nederland-headshots`) en upload deze projectmap (zonder `node_modules` en `.env.local`).
2. **Vercel** – *Add New → Project* → kies de repository → *Deploy*. (De eerste deploy mag mislukken zolang de instellingen hieronder nog ontbreken.)
3. **Database** – In het Vercel-project: *Storage → Create Database → Neon (Postgres)* → koppel aan het project. Vercel zet `DATABASE_URL` automatisch.
4. **Beheerder-login instellen** – zie hieronder.
5. **Redeploy** – *Deployments → … → Redeploy*.
6. **Eigen adres (optioneel)** – *Settings → Domains* → bijv. `headshots.thelightportraits.nl`. Voeg bij je domeinbeheerder een CNAME toe naar `cname.vercel-dns.com`.
7. Log in op `https://<jouw-adres>/admin`, maak de shoots aan en deel de links.

> De hoofdpagina (`/`) toont alleen een uitleg; deelnemers gebruiken altijd de link van hun shoot (`/s/...`). Alle deelnemers van dezelfde shoot krijgen dezelfde link.

## Beheerder-login instellen

1. Ga naar `https://<jouw-adres>/admin/wachtwoord`, kies een sterk wachtwoord (minimaal 10 tekens) en klik *Maak versleutelde waarde*. Dit gebeurt volledig in je eigen browser.
   (Alternatief op de computer: `npm run hash-password -- "JouwWachtwoord"`.)
2. Zet in Vercel onder *Settings → Environment Variables*:
   | Naam | Waarde |
   |---|---|
   | `ADMIN_EMAIL` | het e-mailadres waarmee je inlogt |
   | `ADMIN_PASSWORD_HASH` | de `b64:...`-waarde uit stap 1 |
   | `SESSION_SECRET` | optioneel; zonder wordt automatisch een veilige sleutel afgeleid |
3. Redeploy. Wachtwoord wijzigen = stap 1–3 opnieuw; iedereen wordt dan automatisch uitgelogd.

Het wachtwoord zelf wordt nergens opgeslagen.

## Lokaal draaien (voor ontwikkelaars)

```
npm install
cp .env.example .env.local   # vul de waarden in
npm run dev                  # http://localhost:3000
```

## Privacy (AVG)

- Alleen noodzakelijke gegevens: naam, categorie, provincie, fotonummers. Geen geboortedatum en geen deelnemernummer (dat veld bestaat alleen optioneel voor de beheerder).
- Deelnemers zien alleen het formulier en hun eigen bevestiging; meldingen over dubbele inzendingen tonen nooit gegevens van anderen.
- Alle pagina's hebben `noindex` (niet vindbaar via Google), HTTPS verplicht, beveiligingsheaders en CSRF-bescherming.
- Verwijderen in het dashboard verwijdert een inzending **definitief**. Het logboek (`audit_log`) bewaart alleen wát er gewijzigd is, geen persoonsgegevens.
- Advies: verwijder of archiveer na afloop van de verkiezing de inzendingen die niet meer nodig zijn.

## Huisstijl aanpassen

- Kleuren: bovenaan `app/globals.css` (`--accent`, `--dark`, …).
- Naam/teksten: `lib/constants.js` (`BRAND`).
- Logo: zet een bestand in `public/` en voeg een `<img>` toe in de header van `components/ParticipantForm.js`.
