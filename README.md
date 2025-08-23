# HOLSHIP RMS (Rampe Management System)

Mørkt tema web-applikasjon for booking av lasting og lossing på Holship Norge lager.

## Funksjoner
- Admin oppretter brukere (epost + auto-generert passord sendes via Office 365 SMTP)
 - Admin oppretter brukere (epost + auto-generert passord sendes via SMTP)
 - Automatisk epost-bekreftelse ved booking
- Innlogging med epost/passord (JWT i httpOnly cookie)
- Kalender dagvisning med ramper og tidsslots
  - Lasting: Rampe 8-11, 60 min slots, 07:00-17:00 (siste start 16:00)
  - Lossing: Rampe 3-5, 45 min slots, 07:00-18:00 (siste start 17:15)
- Bookede slots gråes ut
- Admin ser oversikt over alle bookinger for valgt dato

## Teknologi
- Next.js (React) + API routes
- Prisma + SQLite (enkelt å bytte til PostgreSQL senere)
- Tailwind CSS (dark mode)
- Nodemailer (Office 365 SMTP)

## Kom i gang
1. Kopier `.env.example` til `.env` og fyll inn verdier.
2. Installer avhengigheter:
```powershell
npm install
```
3. Kjør migrering og generer klient:
```powershell
npx prisma migrate dev --name init
```
4. Seed admin (bruker .env variabler):
```powershell
npm run seed
```
5. Start utviklingsserver:
```powershell
npm run dev
```
6. Åpne http://localhost:3000

## Endre database
Produksjon / nåværende konfig: bruker PostgreSQL (`provider = "postgresql"`). Sett `DATABASE_URL` og kjør migrering.

## Epost
Office 365 krever ofte moderne auth eller app-passord. Denne koden bruker SMTP basic auth; vurder OAuth 2.0 i produksjon.

Variabler i `.env`:
```
O365_HOST=smtp.office365.com
O365_PORT=587
O365_SECURE=false
O365_USER=booking@holship.com
O365_PASS=<passord eller app-passord>
MAIL_FROM="HOLSHIP RMS <booking@holship.com>"
MAIL_BCC=logg@holship.com # valgfri
```
Eposter som sendes:
- Brukeropprettelse (sender midlertidig passord)
- Booking bekreftelse (type, rampe, tidspunkt, regnr, firma, godstype)

Hvis SMTP ikke er konfigurert (mangler bruker/pass) logges advarsel og utsendelse hoppes over.

## Videre arbeid / Neste steg
- Passord-endring for brukere
- Rate limiting / Brute force beskyttelse
- Mulighet for å slette / endre booking (admin)
- Validatorer og bedre feilhåndtering
- Flerspråklig støtte
- Dag-/ukevisning

## Deploy gratis (Render + Neon/Supabase Postgres)

### 1. Oppgrader database til Postgres
Endre i `prisma/schema.prisma` datasourcen til `provider = "postgresql"` og sett `DATABASE_URL` (fra Neon/Supabase). Lokalt:
```
npx prisma migrate dev --name init
npm run seed
```

### 2. Opprett gratis Postgres
Neon.tech → New Project → Kopier connection string → sett som `DATABASE_URL`.

### 3. Opprett repo (GitHub)
Push koden (inkluder `render.yaml`).

### 4. Render
1. Gå til dashboard.render.com
2. New + → Blueprint → peker til GitHub repo (render.yaml autodetekteres)
3. Sett miljøvariabler:
  - DATABASE_URL
  - JWT_SECRET (lang random streng)
  - O365_HOST=smtp.office365.com
  - O365_PORT=587
  - O365_SECURE=false
  - O365_USER / O365_PASS / MAIL_FROM / MAIL_BCC
4. Deploy.

### 5. Migrering i produksjon
Etter første build: Åpne Shell i Render servicen og kjør
```
npm run prisma:migrate:deploy
npm run seed   # valgfritt for admin
```

### 6. Test
Besøk URL fra Render. Logg inn, test booking & epost.

Gratis-begrensninger: Render free kan sove etter inaktivitet. Neon free har begrenset lagring. For mer stabilitet: oppgrader senere.

## Sikkerhet
Ikke la standard admin-passord leve lenge. Bytt til et sterkt passord straks.
