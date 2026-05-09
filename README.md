# 🍃 LAXMI — Restaurant Management System

A complete, real-time restaurant management system built with pure HTML, Firebase Auth, and Supabase.

---

## 📁 File Structure

```
rms/
├── index.html          ← Customer order page (public)
├── kitchen.html        ← Kitchen dashboard (staff)
├── admin.html          ← Admin panel (admin/superadmin)
├── menu-manager.html   ← Menu management (manager+)
├── staff.html          ← Staff management (admin+)
├── reports.html        ← Reports & analytics (manager+)
└── assets/
    ├── style.css           ← Global stylesheet
    ├── auth.js             ← Firebase Auth + Supabase init
    └── supabase-client.js  ← (legacy, not used by staff pages)
```

---

## 🚀 Setup Guide

### Step 1 — Firebase Setup
1. Go to https://console.firebase.google.com
2. Create a project (or use existing)
3. Enable **Authentication** → Sign-in methods:
   - ✅ Email/Password
   - ✅ Google
4. Go to **Authentication → Settings → Authorized domains**
5. Add your GitHub Pages domain: `yourusername.github.io`
6. Go to **Project Settings** → copy your `firebaseConfig`

### Step 2 — Supabase Setup
1. Go to https://supabase.com/dashboard
2. Create a project
3. Go to **SQL Editor** → run the schema SQL (see below)
4. Go to **Project Settings → API** → copy URL and anon key

### Step 3 — Update Credentials
Open `assets/auth.js` and update:
```js
const FIREBASE_CONFIG = { ... your config ... };
const SUPABASE_URL    = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
const DEFAULT_BRANCH_ID = 'your-branch-uuid';
```

Also update the same credentials inside `index.html` (it has its own self-contained script).

### Step 4 — Add First Admin
1. Firebase Console → Authentication → Add User → enter email + password
2. Copy the User UID
3. Supabase → SQL Editor → run:
```sql
INSERT INTO staff (firebase_uid, email, name, role, branch_id, is_active)
VALUES ('YOUR_UID', 'your@email.com', 'Admin', 'superadmin', 'YOUR_BRANCH_ID', true);
```

### Step 5 — Deploy to GitHub Pages
1. Push all files to your GitHub repo
2. Go to repo **Settings → Pages**
3. Set source to `main` branch, root folder
4. Your site will be live at `https://yourusername.github.io/reponame/`

---

## 🗄️ Database Schema (Supabase SQL)

```sql
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text, gstin text, phone text, city text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text UNIQUE,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('superadmin','admin','manager','kitchen','waiter')),
  branch_id uuid REFERENCES branches(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE categories (
  id serial PRIMARY KEY,
  branch_id uuid REFERENCES branches(id),
  name text NOT NULL,
  emoji text DEFAULT '🍽️',
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true
);

CREATE TABLE menu_items (
  id serial PRIMARY KEY,
  branch_id uuid REFERENCES branches(id),
  category_id int REFERENCES categories(id),
  name text NOT NULL,
  description text,
  emoji text DEFAULT '🍽️',
  price numeric(10,2) NOT NULL,
  is_available boolean DEFAULT true,
  is_veg boolean DEFAULT true,
  image_url text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE restaurant_tables (
  id serial PRIMARY KEY,
  branch_id uuid REFERENCES branches(id),
  table_number text NOT NULL,
  seats int DEFAULT 4,
  is_occupied boolean DEFAULT false,
  qr_token text UNIQUE DEFAULT gen_random_uuid()::text
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text UNIQUE NOT NULL,
  branch_id uuid REFERENCES branches(id),
  table_number text,
  customer_phone text,
  customer_name text,
  firebase_uid text,
  items jsonb NOT NULL,
  subtotal numeric(10,2) NOT NULL,
  cgst numeric(10,2) DEFAULT 0,
  sgst numeric(10,2) DEFAULT 0,
  total numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','preparing','done','rejected','cancelled')),
  payment_status text DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid')),
  payment_method text DEFAULT 'counter',
  note text,
  invoice_no text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE settings (
  id serial PRIMARY KEY,
  branch_id uuid REFERENCES branches(id),
  key text NOT NULL,
  value text,
  UNIQUE(branch_id, key)
);

CREATE TABLE activity_log (
  id serial PRIMARY KEY,
  branch_id uuid REFERENCES branches(id),
  event_type text NOT NULL,
  description text,
  staff_name text,
  created_at timestamptz DEFAULT now()
);

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
```

---

## 👥 Staff Roles & Permissions

| Permission           | Superadmin | Admin | Manager | Kitchen | Waiter |
|----------------------|:---:|:---:|:---:|:---:|:---:|
| Kitchen Dashboard    | ✓ | ✓ | ✓ | ✓ | — |
| Update Order Status  | ✓ | ✓ | ✓ | ✓ | — |
| Admin Panel          | ✓ | ✓ | — | — | — |
| Manage Menu          | ✓ | ✓ | ✓ | — | — |
| View Reports         | ✓ | ✓ | ✓ | — | — |
| Manage Staff         | ✓ | ✓ | — | — | — |
| Open/Close Store     | ✓ | ✓ | ✓ | ✓ | — |
| Change Settings      | ✓ | ✓ | — | — | — |

---

## 📱 Pages Overview

| Page | URL | Access |
|------|-----|--------|
| Customer Order | `index.html` | Public |
| Kitchen | `kitchen.html` | Kitchen+ |
| Admin Panel | `admin.html` | Admin+ |
| Menu Manager | `menu-manager.html` | Manager+ |
| Staff | `staff.html` | Admin+ |
| Reports | `reports.html` | Manager+ |

---

## ⚡ Tech Stack

- **Frontend** — Pure HTML, CSS, Vanilla JS (no frameworks)
- **Auth** — Firebase Authentication (Email + Google)
- **Database** — Supabase (PostgreSQL)
- **Realtime** — Supabase Realtime subscriptions
- **Hosting** — GitHub Pages
- **QR Codes** — api.qrserver.com

---

## 🛠️ Common Issues

**Kitchen/Menu page is blank**
→ Make sure your Firebase UID is added to the `staff` table in Supabase

**Google Sign-In not working**
→ Add your GitHub Pages domain to Firebase → Authentication → Authorized Domains

**Orders not showing in realtime**
→ Check Supabase → Database → Replication → make sure `orders` table is enabled

**Can't place orders (store closed)**
→ Go to Kitchen Dashboard and toggle the store to Open

---

Built with ❤️ for LAXMI Restaurant
