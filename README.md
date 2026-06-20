# Expense Tracker

Aplikasi pencatat pengeluaran — **HTML/CSS/JS (frontend)** + **Node.js/Express
(backend API)** + **MySQL (database)**.

Arsitektur backend mengikuti pola layered yang sama dengan project
`bookmark-manager-ukpl` (model → repository → service → handler → routes),
hanya bahasanya JavaScript dan storage-nya MySQL (bukan in-memory).

```
expense-tracker/
├── schema.sql                  # skema database MySQL
├── server.js                   # entry point (pakai MySQL asli)
├── src/
│   ├── config/db.js             # koneksi pool MySQL
│   ├── models/expense.model.js  # konstanta & batasan validasi
│   ├── errors/index.js          # ValidationError, NotFoundError
│   ├── repository/
│   │   ├── expense.repository.js         # repo asli (MySQL)
│   │   └── expense.repository.memory.js  # repo tiruan (in-memory, buat testing)
│   ├── service/expense.service.js  # validasi & business logic
│   ├── handler/expense.handler.js  # request handler (Express)
│   ├── routes/expense.routes.js
│   └── app.js                  # factory: createApp(repo)
├── public/                     # frontend statis
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
└── tests/
    ├── whitebox/     # unit test logic validasi di service layer
    ├── blackbox/     # test API lewat HTTP (status code & response)
    ├── integration/  # full CRUD flow lawan MySQL ASLI
    ├── load/         # banyak request sekuensial & konkuren
    └── security/     # XSS, SQL injection, payload aneh, dll
```

## 1. Setup

```bash
npm install
cp .env.example .env
```

Buat database & tabel:

```bash
mysql -u root -p < schema.sql
```

Edit `.env` sesuai kredensial MySQL kamu (host, user, password, nama db).

## 2. Jalankan aplikasi

```bash
npm start
```

Buka **http://localhost:3000** di browser. Frontend langsung disajikan oleh
Express dari folder `public/`, dan memanggil API di `/api/expenses`.

Endpoint API:

| Method | Path                        | Keterangan                  |
|--------|------------------------------|------------------------------|
| GET    | /api/expenses                | List semua pengeluaran       |
| GET    | /api/expenses?category=xxx   | Filter by kategori           |
| GET    | /api/expenses?tag=xxx        | Filter by tag                |
| GET    | /api/expenses/summary        | Total & breakdown per kategori |
| POST   | /api/expenses                | Tambah pengeluaran           |
| GET    | /api/expenses/:id             | Detail satu pengeluaran      |
| PUT    | /api/expenses/:id             | Update pengeluaran           |
| DELETE | /api/expenses/:id             | Hapus pengeluaran            |
| GET    | /health                      | Health check                 |

## 3. Menjalankan test

```bash
npm test                 # semua suite
npm run test:whitebox    # unit test service layer
npm run test:blackbox    # test API (in-memory repo)
npm run test:load        # load & stress test (in-memory repo)
npm run test:security    # XSS, SQLi, payload, dll
npm run test:integration # full CRUD lawan MySQL ASLI
```

**Penting soal `test:integration`:** suite ini satu-satunya yang menyentuh
MySQL sungguhan (bukan tiruan in-memory), supaya benar-benar membuktikan
service + repository + driver MySQL nyambung dengan baik. Whitebox,
blackbox, load, dan security sengaja memakai
`InMemoryExpenseRepository` (lihat `src/repository/expense.repository.memory.js`)
yang punya interface identik dengan repo MySQL asli — jadi 4 suite itu jalan
cepat dan deterministik tanpa butuh server database menyala.

Untuk menjalankan `test:integration` dengan sungguhan:
1. Siapkan database test terpisah, misalnya `expense_tracker_test`
   (supaya tidak menimpa data asli).
2. Isi `TEST_DB_*` di `.env` (lihat `.env.example`).
3. Jalankan `npm run test:integration`.

Kalau MySQL tidak terdeteksi, suite ini akan mencetak peringatan dan setiap
test-nya akan dilewati dengan rapi (tidak bikin `npm test` gagal total) —
ini cuma fallback supaya repo tetap bisa di-clone & dites tanpa setup
database dulu.

## 4. Validasi yang diterapkan (service layer)

- **title**: wajib, maks 200 karakter
- **amount**: wajib, harus angka > 0
- **category**: wajib, harus salah satu dari: Makanan, Transportasi, Belanja,
  Hiburan, Kesehatan, Pendidikan, Tagihan, Lainnya
- **payment_method**: opsional (default `Cash`), harus salah satu dari:
  Cash, Debit, Credit, E-Wallet
- **expense_date**: wajib, format `YYYY-MM-DD`
- **description**: opsional, maks 1000 karakter
- **tags**: opsional, maksimal 10 tag, masing-masing maks 50 karakter

Catatan: semua query MySQL di `expense.repository.js` memakai parameterized
placeholder (`?`), bukan string concatenation — ini yang membuat aplikasi
tahan terhadap SQL injection (lihat `tests/security`).
