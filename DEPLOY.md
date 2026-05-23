# Deploy Creator Sat Set dengan Docker + Prisma

Aplikasi sekarang memakai Prisma dan database SQL PostgreSQL. Supabase tidak lagi dipakai.

## Jalankan Lokal dengan Docker

1. Salin env contoh jika ingin mengisi API key AI:
   ```bash
   cp .env.example .env
   ```
2. Isi minimal salah satu API key provider AI di `.env`.
3. Jalankan app dan database:
   ```bash
   docker compose up --build
   ```
4. Buka aplikasi:
   ```text
   http://localhost:8787
   ```

`docker compose` akan menjalankan PostgreSQL, menjalankan migrasi Prisma, lalu menyalakan server Node.

## Jalankan Lokal Tanpa Docker

1. Jalankan PostgreSQL lokal.
2. Isi `DATABASE_URL` di `.env`.
3. Generate Prisma client dan migrasi database:
   ```bash
   npm install
   npm run db:generate
   npm run db:migrate
   ```
4. Jalankan frontend dev server:
   ```bash
   npm run dev
   ```
5. Untuk server API produksi lokal:
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

```text
DATABASE_URL=postgresql://creator:creator_password@db:5432/creator_sat_set?schema=public
APP_STATE_ID=creator-sat-set
PORT=8787
LOGIN_PIN=123456
PIN_SESSION_SECRET=ubah-ke-random-secret-panjang
PIN_SESSION_TTL_MS=604800000
AI_PROVIDER=9router
AI_PROVIDER_ORDER=9router
AI_FALLBACK=false
NINE_ROUTER_API_KEY=...
NINE_ROUTER_MODEL=content-ai
NINE_ROUTER_ENDPOINT=https://9router.crsdigi.tech/v1
```

## Data

State workspace disimpan di tabel SQL `app_state` dengan kolom `id`, `data`, `createdAt`, dan `updatedAt`.
