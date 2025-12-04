# Xeno Insights – Shopify Analytics Dashboard (FDE Assignment)

A full-stack Shopify analytics dashboard built for the Xeno FDE Internship Assignment.

It connects to a Shopify store via the Admin API, syncs customers & orders into a multi-tenant Postgres data warehouse, and exposes a modern dashboard that shows:

- Customers, orders & revenue over time
- Orders by date, top customers, AOV
- A checkout funnel powered by custom events (Checkout Started / Completed / Cart Abandoned)
- A “Recent funnel events” timeline for debugging

---

## 🔗 Live URLs

> Replace with your final URLs if they change.

- **Frontend (Next.js):**  
  `https://xeno-shopify-4bzq.onrender.com`
- **Backend API (Node/Express):**  
  `https://xeno-fde-shopify-backend.onrender.com`

---

## 🧩 Architecture Overview

**Stack**

- **Frontend:** Next.js (App Router) + React + Chart.js (`react-chartjs-2`)
- **Backend:** Node.js, Express
- **ORM & DB:** Prisma + PostgreSQL
- **Auth:** JWT (email + password, tenant-scoped)
- **Background Jobs:** `node-cron` to periodically sync Shopify
- **Shopify:** Admin REST API + Custom Pixel (for checkout events)

**High-level flow**
```text
Shopify Store
  ├─ Admin API (orders, customers)
  └─ Custom Pixel (checkout events)
        ↓
Node/Express Backend
  ├─ Auth (JWT)
  ├─ Sync Shopify → Prisma
  └─ Custom Events Ingest
        ↓
PostgreSQL (multi-tenant)
        ↓
Next.js Frontend (Xeno Insights Dashboard)


Multi-tenancy is implemented using a tenantId column on core tables (Tenant, User, Customer, Order, CustomEvent).
All API calls are scoped to the tenant decoded from the JWT token.



## 🖥️ Frontend – Xeno Insights Dashboard
Key screens/components

Login / Register

Email/password based auth

On register: also captures shopDomain & Admin API token to create a Tenant

Dashboard

KPI cards:

Total Customers

Total Orders

Total Revenue (₹)

Average Order Value

Repeat Customer Rate (%)

Revenue & Orders Trend line chart (Chart.js)

Dual lines: Revenue (₹) + Orders

Clean dark theme with neon-style accents for visibility

Checkout Funnel (Custom Events)

Checkouts Started

Cart Abandoned

Checkouts Completed

Checkout → Order Conversion (%)

Orders by Date table

Top 5 Customers by Spend table

Smart naming: prefers firstName + lastName, fallback to email, then Customer #id

Recent funnel events card (Bonus)

Last 10 events with time, type, cart value, items count

UI notes

Dark “glassmorphism” layout:

Sidebar with brand, nav, actions (Sync, Refresh, Logout)

Main pane with cards, charts and tables

Responsive layout using flexbox

Explicit loading and error states

“No data yet” fallbacks for empty tables & charts

**🛠 Backend – Node, Express, Prisma, PostgreSQL**

The backend lives in the backend/ folder.

Important files

src/server.js – Express app, routes, CORS, cron

src/auth.js – Register / Login / JWT auth middleware

src/shopifySync.js – Shopify Admin API sync logic

prisma/schema.prisma – DB schema (Tenants, Users, Customers, Orders, CustomEvents)

Core Models (simplified)

Tenant – one row per Shopify store

User – linked to a tenantId

Customer – Shopify customers, scoped to tenant

Order – Shopify orders, scoped to tenant

CustomEvent – checkout funnel events

** 📂 Folder Structure **

.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── server.js          # Express server & routes
│   │   ├── auth.js            # Register / login / JWT
│   │   ├── shopifySync.js     # Shopify Admin sync logic
│   │   └── ...                # Event handlers, helpers
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Auth screen (login/register)
│   │   └── dashboard/
│   │       └── page.tsx       # Xeno Insights dashboard UI
│   ├── components/
│   │   └── RecentEventsCard.tsx
│   ├── styles/
│   │   └── globals.css        # Full UI styling
│   └── package.json
│
└── README.md



