Xeno Insights – Shopify Analytics Dashboard (FDE Assignment)

A full-stack Shopify analytics dashboard built for the Xeno FDE Internship Assignment.

It connects to a Shopify store via the Admin API, syncs customers & orders into a multi-tenant PostgreSQL warehouse, and exposes a modern dashboard that shows:

Customers, orders & revenue over time

Orders by date, top customers, AOV

A checkout funnel powered by custom events (CHECKOUT_STARTED, CHECKOUT_COMPLETED, CART_ABANDONED)

A “Recent funnel events” timeline for debugging the pixel / funnel

🔗 Live URLs

Frontend (Next.js) – https://xeno-shopify-4bzq.onrender.com

Backend API (Node/Express) – https://xeno-fde-shopify-backend.onrender.com

✨ Key Features

Email/password tenant login & registration

Multi-tenant data model (one Shopify store per tenant, scoped by tenantId)

Manual + scheduled sync from Shopify Admin API into Postgres

KPI cards:

  Total Customers

  Total Orders

  Total Revenue (₹)

  Average Order Value (AOV)

  Repeat Customer Rate (%)

  Revenue & Orders Trend chart (Chart.js)

Checkout Funnel:

  Checkouts Started

  Cart Abandoned

  Checkouts Completed

  Checkout → Order Conversion (%)

  Orders by Date table

Top 5 Customers by Spend table with smart naming

Recent funnel events card (last 10 custom events)

Dark glassmorphism UI with neon accents and responsive layout

🧩 Tech Stack

Frontend

Next.js (App Router) + React

TypeScript

Chart.js + react-chartjs-2

Custom CSS in globals.css

Backend

Node.js + Express

Prisma ORM

PostgreSQL (multi-tenant)

JSON Web Tokens (JWT) for auth

node-cron for scheduled Shopify syncs

Shopify

Admin REST API (customers, orders)

Shopify Custom Pixel for checkout / cart events

🏗 Architecture Overview

High-level flow:

Shopify Store
  ├─ Admin API (orders, customers)
  └─ Custom Pixel (checkout events)
        ↓
Node/Express Backend
  ├─ /api/auth/*          (JWT auth)
  ├─ /api/sync/shopify    (Admin API → DB sync)
  ├─ /api/metrics/summary (aggregated KPIs)
  └─ /api/public/events/* (checkout funnel ingest)
        ↓
PostgreSQL (multi-tenant: Tenant, User, Customer, Order, CustomEvent)
        ↓
Next.js Frontend (Xeno Insights Dashboard)


Multi-tenancy

Tenant – one row per Shopify store (shopDomain, Admin token, etc.)

User – belongs to a tenantId

Customer, Order, CustomEvent – all include tenantId

Every authed API call reads tenantId from the JWT and scopes queries accordingly.

🗂 Folder Structure
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # DB schema (Tenant, User, Customer, Order, CustomEvent)
│   │   └── migrations/          # Prisma migrations
│   ├── src/
│   │   ├── server.js            # Express server, routes, CORS, cron
│   │   ├── auth.js              # Register / login / JWT middleware
│   │   ├── shopifySync.js       # Shopify Admin sync logic
│   │   └── ...                  # Event handlers & helpers
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Auth screen (login/register)
│   │   └── dashboard/
│   │       └── page.tsx         # Xeno Insights dashboard UI
│   ├── components/
│   │   └── RecentEventsCard.tsx # "Recent funnel events" widget
│   ├── styles/
│   │   └── globals.css          # Full UI styling (glassmorphism + dark mode)
│   └── package.json
│
└── README.md

🧬 Data Model & DB Schema (Simplified)

Actual schema is in backend/prisma/schema.prisma.
Simplified view of the core models:

model Tenant {
  id                Int       @id @default(autoincrement())
  shopDomain        String    @unique
  shopifyAccessToken String
  users             User[]
  customers         Customer[]
  orders            Order[]
  customEvents      CustomEvent[]
  createdAt         DateTime  @default(now())
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String   // bcrypt hash
  tenantId  Int
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  createdAt DateTime @default(now())
}

model Customer {
  id            Int      @id @default(autoincrement())
  tenantId      Int
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  shopCustomerId String  @unique
  firstName     String?
  lastName      String?
  email         String?
  totalSpent    Float    @default(0)
  orders        Order[]
  createdAt     DateTime @default(now())
}

model Order {
  id          Int      @id @default(autoincrement())
  tenantId    Int
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  customerId  Int?
  customer    Customer? @relation(fields: [customerId], references: [id])
  shopOrderId String   @unique
  orderDate   DateTime
  totalPrice  Float    @default(0)  // fallback
  totalSales  Float?              // Shopify's totalSales if present
  createdAt   DateTime @default(now())
}

model CustomEvent {
  id            Int      @id @default(autoincrement())
  tenantId      Int
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  eventType     String   // CHECKOUT_STARTED | CHECKOUT_COMPLETED | CART_ABANDONED
  shopCustomerId String?
  payload       Json?    // cartValue, currency, items, checkoutId, orderId, ...
  createdAt     DateTime @default(now())
}

🌐 API Endpoints
Auth & Tenant Onboarding

POST /api/auth/register

Body:

email (string)

password (string)

shopDomain (string, e.g. my-store.myshopify.com)

shopifyAccessToken (string – Admin API token)

Creates:

a Tenant row,

a User row, and

returns a JWT.

POST /api/auth/login

Body:

email, password

Returns:

token (JWT), which encodes userId & tenantId.

Shopify Sync

POST /api/sync/shopify

Auth: Authorization: Bearer <JWT>

Uses tenant’s shopDomain & shopifyAccessToken to:

Fetch customers & orders from Shopify Admin API

Upsert Customer & Order rows in Postgres

Also scheduled by node-cron for background syncs.

Metrics & Dashboard

GET /api/metrics/summary

Auth: Authorization: Bearer <JWT>

Query params:

startDate (optional, YYYY-MM-DD)

endDate (optional, YYYY-MM-DD; inclusive)

Returns:

{
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  repeatCustomerRate: number;
  ordersByDate: {
    date: string;      // YYYY-MM-DD
    orders: number;
    revenue: number;
  }[];
  topCustomers: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    totalSpent: number;
  }[];
  checkoutStartedCount: number;
  cartAbandonedCount: number;
  checkoutCompletedCount: number;
  checkoutToOrderConversion: number;
}


GET /api/events/recent

Auth: Authorization: Bearer <JWT>

Returns last 10 funnel events for the tenant:

{
  events: {
    id: number;
    eventType: string;       // CHECKOUT_STARTED | ...
    createdAt: string;
    shopCustomerId: string | null;
    cartValue: number | null;
    itemsCount: number;
  }[];
}

Internal Custom Event APIs (Authed, optional)

These are generic custom event endpoints (for internal use):

POST /api/events/custom

POST /api/events/cart-abandoned

POST /api/events/checkout-started

In this project, the public pixel endpoints below are the ones used by Shopify.

Public Checkout Funnel Ingest (Shopify Custom Pixel)

These do not require JWT; they identify the tenant by shopDomain.

POST /api/public/events/checkout-started

Body example:

{
  "shopDomain": "xenofde-aryan.myshopify.com",
  "checkoutId": "123",
  "cartValue": 3399.95,
  "currency": "USD",
  "items": [
    { "sku": "snowboard-1", "title": "The Collection Snowboard: Hydrogen", "quantity": 1 }
  ]
}


Creates CustomEvent with eventType = "CHECKOUT_STARTED".

POST /api/public/events/checkout-completed

Body example:

{
  "shopDomain": "xenofde-aryan.myshopify.com",
  "checkoutId": "123",
  "orderId": "987",
  "orderValue": 3399.95,
  "currency": "USD",
  "items": [ ... ]
}


Creates CustomEvent with eventType = "CHECKOUT_COMPLETED".

POST /api/public/events/cart-abandoned

Optional future use; same pattern, creates CART_ABANDONED events.

Health

GET /health

Returns { status: "ok" } – used by Render / uptime checks.

🖥 Frontend – Xeno Insights Dashboard
Auth Screen

Email/password login & registration

On register, user also submits:

shopDomain

Admin API token

On success, JWT is stored in localStorage and reused for all API calls.

Dashboard Sections

Performance Overview

KPI cards: customers, orders, revenue, AOV, repeat customer rate

Date range selector (From / To) → drives /api/metrics/summary

Revenue & Orders Trend

Line chart using Chart.js

Two datasets: revenue & orders

X-axis = date; Y-axis = metric

Uses ordersByDate array from backend

Checkout Funnel (Custom Events)

Cards for:

Checkouts Started

Cart Abandoned

Checkouts Completed

Checkout → Order Conversion (%)

Counts computed in backend using aggregated CustomEvents.

Orders by Date

Table: date | orders | revenue

Top 5 Customers by Spend

Uses totalSpent from Customer table

Smart label:

use firstName + lastName if present

else email

else Customer #<id>

Recent funnel events (Bonus)

Separate card (RecentEventsCard.tsx) calling /api/events/recent

Shows last 10 events with:

time, event type, customer/cart info, items count

UI Styling

Dark glassmorphism shell with neon green/blue accents

Left sidebar:

Logo badge (X)

App title and subtitle

Navigation section (Dashboard)

Actions: Sync from Shopify, Refresh Metrics, Logout

Right main panel:

Cards, charts, tables with consistent spacing & typography

Responsive layout with flexbox and graceful wrapping on smaller widths

Clear loading and error states; friendly “No data yet” messages.

🛠 Setup Instructions
1. Prerequisites

Node.js (>= 18)

Yarn or npm

A PostgreSQL database (local or cloud)

A Shopify development store with:

Admin API access token

Ability to add a Custom Pixel

2. Clone the Repo
git clone <your-repo-url>.git
cd <repo-root>

3. Backend Setup (/backend)
cd backend
npm install


Create a .env file in backend:

# Port for the backend
PORT=4000

# Postgres connection string
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=public"

# JWT secret for signing tokens
JWT_SECRET="super-secret-jwt-key"

# Optional: cron schedule for background syncs (every 30 mins by default)
SYNC_CRON_SCHEDULE="*/30 * * * *"


Run Prisma migrations:

npx prisma migrate dev --name init


Start the backend locally:

npm start
# or: node src/server.js


Backend should be available at http://localhost:4000.

4. Frontend Setup (/frontend)

In a new terminal:

cd frontend
npm install


Create a .env.local in frontend:

NEXT_PUBLIC_API_BASE_URL="http://localhost:4000"


Start the Next.js dev server:

npm run dev


Frontend will be at http://localhost:3000.

5. Shopify Configuration

Admin API Token

In Shopify admin, create a custom app / private app with read access to Customers and Orders.

Copy the Admin API access token.

Custom Pixel

In Customer events / Pixels, create a custom pixel and include the project’s pixel script.

The script should:

read window.location.hostname as shopDomain

listen to checkout_started and checkout_completed

fetch() the backend’s public endpoints:

POST https://<your-backend>/api/public/events/checkout-started

POST https://<your-backend>/api/public/events/checkout-completed

Register Tenant

Open the frontend.

Use Register form with:

Email, password

shopDomain (e.g. xenofde-aryan.myshopify.com)

Admin API token.

Sync Data

Log in → Dashboard.

Click Sync from Shopify to pull initial customers & orders.

Trigger a test checkout on the storefront to create funnel events.

Click Refresh Metrics to see updated KPIs & events.

⚙️ Known Limitations & Assumptions

One store per tenant – each tenant corresponds to a single Shopify shop.

Token storage – the Admin API token is stored in Postgres; in production this should be moved to a secure secrets manager.

Basic error handling – minimal retries/backoff for Shopify API rate limits; more robust retry logic would be needed in production.

No multi-role RBAC – only one user role (tenant user). No separate admin/analyst roles yet.

Limited segmentation – metrics are aggregated at store level; there’s no breakdown by product, campaign, or channel.

Time zones – currently treats dates in server time / UTC; time-zone–aware reporting could be improved.

Pixel coverage – only checkout started/completed (and optional cart abandoned). Does not yet capture view, add-to-cart or marketing attribution events.

🚀 Next Steps / Productionization Ideas

If this were taken to production, next iterations would include:

Proper Shopify OAuth installation flow instead of manually pasting Admin tokens.

Moving secrets to a secrets manager and adding stricter rate limiting and request logging.

Replacing node-cron with a dedicated job queue (e.g. BullMQ + Redis) for reliable sync and retries.

Adding segmentation & advanced analytics:

cohorts, RFM, campaign/source breakdowns, product-level funnels.

Improving observability: 

structured logs, metrics on sync latency, pixel error monitoring.

Hardening the frontend with tests, better accessibility, and more export/share options.
