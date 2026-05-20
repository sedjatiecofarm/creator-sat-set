# Deploy Creator Sat Set

## 1. Supabase

1. Buat project di Supabase.
2. Buka SQL Editor.
3. Jalankan isi file `supabase-schema.sql`.
4. Ambil nilai berikut dari Project Settings:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

Gunakan `service_role` hanya di server Render, jangan pernah ditaruh di frontend.

## 2. Render

1. Push folder project ini ke GitHub.
2. Di Render, buat Web Service dari repo GitHub tersebut.
3. Start command:
   ```text
   node server.js
   ```
4. Tambahkan environment variables:
   ```text
   AI_PROVIDER=gemini
   AI_PROVIDER_ORDER=gemini,openrouter,groq
   GEMINI_API_KEY=...
   GEMINI_MODEL=gemini-2.5-flash-lite
   OPENROUTER_API_KEY=...
   GROQ_API_KEY=...
   GROQ_MODEL=llama-3.3-70b-versatile
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   SUPABASE_TABLE=creator_app_state
   SUPABASE_STATE_ID=creator-sat-set
   ```
5. Deploy.
6. Buka URL Render dari tablet.

Jika Supabase env belum diisi, aplikasi tetap jalan tapi data tersimpan lokal di server Render. Untuk data permanen, Supabase env wajib diisi.
