# Catatan Vercel

Arsitektur saat ini dibuat sebagai Docker based app dengan Prisma + PostgreSQL.

Vercel masih bisa menjalankan build frontend dan serverless API, tetapi wajib menyediakan `DATABASE_URL` PostgreSQL eksternal dan menjalankan migrasi Prisma sebelum traffic produksi. Untuk deployment paling sederhana, gunakan `docker-compose.yml` atau platform yang mendukung Docker container + PostgreSQL.

Perintah migrasi:

```bash
npm run db:migrate
```
