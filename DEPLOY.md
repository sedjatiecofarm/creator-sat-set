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
AI_PROVIDER=gemini
AI_PROVIDER_ORDER=gemini,openrouter,groq
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
OPENROUTER_API_KEY=...
OPENROUTER_MODELS=...
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
```

## Data

State workspace disimpan di tabel SQL `app_state` dengan kolom `id`, `data`, `createdAt`, dan `updatedAt`.
