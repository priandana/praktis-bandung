# Pergudangan Link Hub — Pro (Next.js + Supabase)

Portal database link spreadsheet untuk tim pergudangan. Siap deploy di **Vercel**.

## 🚀 1-Click Deploy (Langkah Cepat)
1. **Buat project Supabase**, ambil `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. **Jalankan SQL Schema** di Supabase SQL Editor (bagian bawah).
3. **Set ENV** di Vercel (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. `npm i` → `npm run dev` (lokal) atau langsung Deploy via Vercel.

---

## 🧱 Tech Stack
- Next.js (App Router)
- Tailwind CSS
- Supabase (Auth + Postgres + RLS)
- framer-motion, lucide-react, qrcode.react

## 🔐 Environment
Buat file `.env.local` (opsional saat lokal; di Vercel gunakan Project Env):
```
NEXT_PUBLIC_SUPABASE_URL=...your supabase url...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...your anon key...
```

## 🗄️ Supabase SQL Schema
Jalankan ini di Supabase SQL editor:

```sql
-- Extension untuk UUID (jika perlu)
-- create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text check (role in ('admin','staff')) default 'staff',
  created_at timestamptz default now()
);

create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  description text,
  category text,
  location text,
  tags text[],
  favorite boolean default false,
  clicks int default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_links on links;
create trigger trg_touch_links before update on links
for each row execute procedure touch_updated_at();

create table if not exists audit_logs (
  id bigserial primary key,
  action text not null, -- create/update/delete/clicked
  link_id uuid references links(id) on delete cascade,
  by text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table links enable row level security;
alter table audit_logs enable row level security;

create policy "profiles self read" on profiles
for select using (auth.uid() = id);

create policy "links read for all authenticated" on links
for select using (auth.role() = 'authenticated');

create policy "links insert for authenticated" on links
for insert with check (auth.role() = 'authenticated');

create policy "links update owner or admin" on links
for update using (
  created_by = auth.uid() or exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "links delete admin only" on links
for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "audit read for authenticated" on audit_logs
for select using (auth.role() = 'authenticated');

create policy "audit insert for authenticated" on audit_logs
for insert with check (auth.role() = 'authenticated');
```

> Jadikan satu akun admin:
```sql
update profiles set role = 'admin' where email = 'emailkamu@perusahaan.com';
```

## ▶️ Scripts
- `npm run dev` — jalankan lokal
- `npm run build` — build produksi
- `npm start` — start produksi
- `npm run lint` — linting
- `npm run format` — prettier format

## 🧩 Fitur
- Login email magic link (Supabase Auth)
- Role admin/staff
- CRUD link spreadsheet + favorit
- Pencarian & filter (kategori/lokasi/tag)
- Tampilan Kartu & Tabel
- Impor CSV, ekspor CSV/JSON
- QR Code per link + copy URL
- Audit log klik & perubahan
- Animasi halus, UI bertema pergudangan

## 🔧 Catatan
- Pastikan **SMTP** Supabase berfungsi (default tersedia).
- Untuk SSO/SAML, gunakan Supabase Enterprise/WorkOS (opsional).
- Tambahkan branding perusahaan di TopNav/hero sesuai kebutuhan.