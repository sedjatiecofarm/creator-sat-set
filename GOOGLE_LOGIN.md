# Google Login untuk Creator Sat Set

## 1. Ambil Supabase Publishable Key

Di Supabase:

1. Buka Project Settings.
2. Masuk ke API Keys.
3. Copy key bagian Publishable key.
4. Tambahkan ke Vercel Environment Variables:

```text
SUPABASE_PUBLISHABLE_KEY=isi_publishable_key_supabase
```

Service role key tetap dipakai server. Publishable key dipakai browser untuk login.

## 2. Aktifkan Google Provider

Di Supabase:

1. Buka Authentication.
2. Buka Sign In / Providers.
3. Pilih Google.
4. Enable Google provider.
5. Masukkan Google Client ID dan Google Client Secret.

## 3. Redirect URL

Di Supabase Authentication URL Configuration:

```text
Site URL:
https://creator-sat-set.vercel.app

Redirect URLs:
https://creator-sat-set.vercel.app/**
http://localhost:8787/**
```

## 4. Upload File dan Redeploy

Upload file yang berubah ke GitHub, lalu Vercel akan redeploy otomatis.

Setelah selesai, tombol Login Google akan aktif di sidebar.
