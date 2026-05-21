# Deploy Creator Sat Set ke Vercel

Gunakan Vercel kalau tidak ingin memakai kartu di Render.

## 1. Upload file baru ke GitHub

Upload struktur project ini ke repo GitHub:

```text
api/
src/
index.html
package.json
package-lock.json
vite.config.mjs
vercel.json
```

Pastikan file pendukung tetap ada:

```text
supabase-schema.sql
```

Jangan upload:

```text
.env
data/
```

## 2. Import repo di Vercel

1. Buka https://vercel.com
2. Login dengan GitHub.
3. Klik Add New Project.
4. Import repo `creator-sat-set`.
5. Framework preset: Other.
6. Build command: `npm run build`.
7. Output directory: `dist`.

## 3. Environment Variables

Isi environment variables:

```text
AI_PROVIDER=gemini
AI_PROVIDER_ORDER=gemini,openrouter,groq
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
OPENROUTER_API_KEY=...
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_TABLE=creator_app_state
SUPABASE_STATE_ID=creator-sat-set
```

## 4. Deploy

Klik Deploy. Setelah selesai, buka URL Vercel dari tablet.
