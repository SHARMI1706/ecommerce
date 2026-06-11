\*\*DRAPE — Project Documentation

**Project Overview**

- **Purpose:** A small single-page storefront to browse products, add to cart, and place orders. Supports optional Supabase backend for authentication and order persistence; falls back to localStorage demo mode when Supabase is not configured.

**Tech Stack**

- **Frontend:** Plain HTML, CSS, vanilla JavaScript (no build tooling).
- **Styling:** CSS (file: `style.css`).
- **Data & Auth:** Supabase (Postgres + Auth) via CDN `@supabase/supabase-js`.
- **Local server for testing:** Python's `http.server` (or any static host).

**Repository / File Structure (key files)**

- `Index.html` — single-page HTML file containing templates for pages (home, shop, product, checkout, orders, account).
- `app.js` — main application logic: state, rendering, Supabase helpers, cart and checkout flows.
- `style.css` — styling for the UI.
- `DOCUMENTATION.md` — this file.
- `supabase_orders_table.sql` — SQL to create the `orders` table and recommended RLS policies.

**High-level Architecture & Flow**

- On load `init()`:
  - `updateCartBadge()` reads `drape_cart` from `localStorage`.
  - `getCurrentUser()` uses Supabase session if configured.
  - `showPage('home')` mounts the initial page.
- Product data (`allProducts`) is loaded via `fetchProducts()`:
  - If `SUPABASE_URL` is still the placeholder, the app returns `SAMPLE_PRODUCTS` (demo mode).
  - Otherwise, it queries Supabase `products` table.
- Cart flow:
  - `addToCart(product, size)` updates the `cart` array and saves it to `localStorage` as `drape_cart`.
  - `renderCartDrawer()` shows items and total; `saveCart()` persists cart state.
- Checkout & Orders:
  - `renderCheckout()` calculates subtotal/delivery/total and shows form fields.
  - `placeOrder()` validates fields (required + 6-digit pincode), builds `orderData` object, calls `insertOrder(orderData)`.
  - `insertOrder()` behavior:
    - If `supabaseClient` is configured, attempt to `insert` into `orders` table and return result.
    - If Supabase is not configured or insert fails (e.g., missing table), the app writes a demo order to `localStorage` key `drape_orders` and returns a `DEMO-...` id.
  - On success the cart clears and the app shows the success page.

**Authentication flow (brief)**

- `signUp(email, password)` and `signIn(email, password)` wrap Supabase auth calls (`auth.signUp`, `auth.signInWithPassword`).
- `renderAuthForm()` supports signup and signin UI.
- If Supabase is not connected, the UI shows a note and signup/signin are disabled.

**Supabase Integration — how it works in `app.js`**

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are constants at the top of `app.js`.
- `supabaseClient` is created only when `SUPABASE_URL` is configured; otherwise it is `null`.
- Functions that use Supabase guard against `supabaseClient` being null and fall back to demo/local behavior.
- Key functions:
  - `fetchProducts()` — `supabaseClient.from('products').select('*')` or demo products.
  - `insertOrder(orderData)` — inserts into `orders` or writes to `localStorage` on failure.
  - `fetchOrders()` — tries Supabase select for the current user, otherwise reads `drape_orders` from localStorage and filters by `user_email`.

**Database schema (orders) — SQL**

- Use the provided `supabase_orders_table.sql` file (also shown below) to create the `orders` table. This is the shape the frontend expects for `orderData`:
  - `user_email`, `customer_name`, `phone`, `address`, `items` (JSONB), `subtotal`, `delivery_fee`, `total`, `payment_method`, `status`, `created_at`.

```sql
-- supabase_orders_table.sql
create extension if not exists pgcrypto;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_email text,
  customer_name text,
  phone text,
  address text,
  items jsonb,
  subtotal numeric,
  delivery_fee numeric,
  total numeric,
  payment_method text,
  status text,
  created_at timestamptz default now()
);

create index on public.orders (user_email);
create index on public.orders (created_at desc);
```

**Recommended RLS (Row-Level Security) policies**

- To keep data secure and allow users to only read/insert their own orders, apply these policies in Supabase SQL editor:

```sql
alter table public.orders enable row level security;

create policy insert_own_order on public.orders
  for insert
  with check (user_email = auth.jwt() ->> 'email');

create policy select_own_orders on public.orders
  for select
  using (user_email = auth.jwt() ->> 'email');
```

- For quick testing only: you can disable RLS or create permissive policies, but remove this before production.

**How orders become "real time"**

- When `insertOrder` successfully inserts into Supabase, the returned `data` from the `insert` call is used to show the success page. The app then calls `fetchOrders()` which re-queries Supabase — so the stored row appears immediately in the Orders page.
- If the insert fails (e.g., table missing) the demo fallback stores orders locally; those appear on the Orders page by reading `drape_orders`.

**Local testing & running the app**

- Start simple static server from `c:\website`:

```bash
# Using Python
python -m http.server 8080
# Open http://127.0.0.1:8080/Index.html
```

- Steps to test the full Supabase flow:
  1. Create `orders` table and RLS policies in Supabase (SQL above).
  2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` at top of `app.js`.
  3. Reload the page (cache-bust) and try sign-up/sign-in (if using auth) and place order.

**Common errors & troubleshooting**

- `Invalid supabaseUrl`: caused by using placeholder `YOUR_SUPABASE_URL`; ensure `SUPABASE_URL` is a proper `https://...` URL.
- `Could not find the table 'public.orders'`: the orders table is missing in Postgres — run the SQL to create it.
- CSS not loading: case-sensitive filename mismatch between `Index.html` and `style.css`.
- Caching: use `?cachebust=` when testing to force reload of `app.js`.

**Interview talking points — suggested highlights**

- Explain the progressive enhancement approach: app works in demo mode without backend connectivity.
- Describe separation of concerns: UI templates in `Index.html`, behavior in `app.js`, styling in `style.css`.
- Discuss Supabase as backend-as-a-service (Auth + Postgres) and the benefits for rapid prototypes.
- Point out how RLS secures per-user data access and how frontend matches that with `user_email` in queries.
- Mention trade-offs of public anon keys in client apps and importance of RLS and server-side checks for sensitive operations.

**Next steps / Improvements**

- Implement payment gateway integrations (Razorpay/Stripe) and store payment metadata.
- Add server-side order verification/webhooks to prevent spoofed client inserts.
- Harden RLS policies and monitoring, add tests for end-to-end flows.

---

If you'd like, I can:

- add the SQL file `supabase_orders_table.sql` in the repo (I will),
- generate a short slide-style summary you can use in interviews,
- or create a script that runs basic end-to-end tests against Supabase (requires credentials).

Tell me which next item you prefer.
