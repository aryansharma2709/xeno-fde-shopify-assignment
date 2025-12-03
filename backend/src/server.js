// src/server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const { authMiddleware, registerHandler, loginHandler } = require("./auth");
const { syncShopifyForTenant } = require("./shopifySync");

// ---------- CORS SETUP ----------
const allowedOrigins = [
  "http://localhost:3000",
  "https://xeno-shopify-4bzq.onrender.com" 
];

const corsOptions = {
  origin: (origin, callback) => {
    // Postman / server-to-server ke liye origin null hota hai
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  }
};

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://xeno-shopify-4bzq.onrender.com",      // your frontend on Render
  "https://xenofde-aryan.myshopify.com"          // your Shopify store domain
];

app.use(
  cors({
    origin(origin, callback) {
      // allow server-to-server / curl (no origin) and the origins above
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.use(express.json());

const PORT = process.env.PORT || 4000;
const cronSchedule = process.env.SYNC_CRON_SCHEDULE || "*/30 * * * *";

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * Auth / onboarding
 */
app.post("/api/auth/register", registerHandler);
app.post("/api/auth/login", loginHandler);

/**
 * Manual Shopify sync for logged-in tenant
 */
app.post("/api/sync/shopify", authMiddleware, async (req, res) => {
  try {
    console.log(`\n=== MANUAL SYNC TRIGGERED ===`);
    console.log(`Tenant ID: ${req.user.tenantId}`);
    console.log(`Starting sync...\n`);
    await syncShopifyForTenant(req.user.tenantId);

    console.log(`\n=== SYNC COMPLETED ===\n`);
    res.json({ status: "ok", message: "Sync completed successfully" });
  } catch (err) {
    console.error("\n=== SYNC ERROR ===");
    console.error("Manual sync error:", err);
    console.error("Error stack:", err.stack);
    console.error("==================\n");
    res
      .status(500)
      .json({ error: "Error syncing Shopify", details: err.message });
  }
});

/**
 * Generic custom event endpoint (authenticated)
 * Body: { eventType, shopCustomerId?, payload? }
 */
app.post("/api/events/custom", authMiddleware, async (req, res) => {
  try {
    const { eventType, shopCustomerId, payload } = req.body;
    if (!eventType) {
      return res.status(400).json({ error: "Missing eventType" });
    }

    const event = await prisma.customEvent.create({
      data: {
        tenantId: req.user.tenantId,
        eventType,
        shopCustomerId: shopCustomerId || null,
        payload: payload || null
      }
    });

    res.status(201).json({ event });
  } catch (err) {
    console.error("Custom event error:", err);
    res.status(500).json({ error: "Error saving custom event" });
  }
});

/**
 * Cart abandoned event (authenticated version)
 * Body: { shopCustomerId?, cartValue?, items? }
 */
app.post("/api/events/cart-abandoned", authMiddleware, async (req, res) => {
  try {
    const { shopCustomerId, cartValue, items } = req.body;

    const event = await prisma.customEvent.create({
      data: {
        tenantId: req.user.tenantId,
        eventType: "CART_ABANDONED",
        shopCustomerId: shopCustomerId || null,
        payload: {
          cartValue: cartValue || 0,
          items: items || []
        }
      }
    });

    res.status(201).json({ event });
  } catch (err) {
    console.error("Cart abandoned event error:", err);
    res.status(500).json({ error: "Error saving cart abandoned event" });
  }
});

/**
 * Checkout started event (authenticated version)
 * Body: { shopCustomerId?, cartValue?, items? }
 */
app.post("/api/events/checkout-started", authMiddleware, async (req, res) => {
  try {
    const { shopCustomerId, cartValue, items } = req.body;

    const event = await prisma.customEvent.create({
      data: {
        tenantId: req.user.tenantId,
        eventType: "CHECKOUT_STARTED",
        shopCustomerId: shopCustomerId || null,
        payload: {
          cartValue: cartValue || 0,
          items: items || []
        }
      }
    });

    res.status(201).json({ event });
  } catch (err) {
    console.error("Checkout started event error:", err);
    res.status(500).json({ error: "Error saving checkout started event" });
  }
});

/**
 * PUBLIC ingest endpoints for Shopify Custom Pixel (no JWT)
 */

app.post("/api/public/events/checkout-started", async (req, res) => {
  try {
    const { shopDomain, checkoutId, cartValue, currency, items } = req.body || {};

    if (!shopDomain) {
      return res.status(400).json({ error: "Missing shopDomain" });
    }

    const tenant = await prisma.tenant.findFirst({ where: { shopDomain } });

    if (!tenant) {
      return res.status(400).json({ error: "Unknown shopDomain", shopDomain });
    }

    const event = await prisma.customEvent.create({
      data: {
        tenantId: tenant.id,
        eventType: "CHECKOUT_STARTED",
        shopCustomerId: null,
        payload: {
          checkoutId: checkoutId || null,
          cartValue: cartValue || 0,
          currency: currency || "INR",
          items: items || []
        }
      }
    });

    res.status(201).json({ status: "ok", id: event.id });
  } catch (err) {
    console.error("Public checkout-started ingest error:", err);
    res
      .status(500)
      .json({ error: "Error saving public checkout-started event" });
  }
});

app.post("/api/public/events/checkout-completed", async (req, res) => {
  try {
    const {
      shopDomain,
      checkoutId,
      orderId,
      orderValue,
      currency,
      items
    } = req.body || {};

    if (!shopDomain) {
      return res.status(400).json({ error: "Missing shopDomain" });
    }

    const tenant = await prisma.tenant.findFirst({ where: { shopDomain } });

    if (!tenant) {
      return res.status(400).json({ error: "Unknown shopDomain", shopDomain });
    }

    const event = await prisma.customEvent.create({
      data: {
        tenantId: tenant.id,
        eventType: "CHECKOUT_COMPLETED",
        shopCustomerId: null,
        payload: {
          checkoutId: checkoutId || null,
          orderId: orderId || null,
          orderValue: orderValue || 0,
          currency: currency || "INR",
          items: items || []
        }
      }
    });

    res.status(201).json({ status: "ok", id: event.id });
  } catch (err) {
    console.error("Public checkout-completed ingest error:", err);
    res
      .status(500)
      .json({ error: "Error saving public checkout-completed event" });
  }
});

app.post("/api/public/events/cart-abandoned", async (req, res) => {
  try {
    const { shopDomain, cartToken, cartValue, currency, items } = req.body || {};

    if (!shopDomain) {
      return res.status(400).json({ error: "Missing shopDomain" });
    }

    const tenant = await prisma.tenant.findFirst({ where: { shopDomain } });

    if (!tenant) {
      return res.status(400).json({ error: "Unknown shopDomain", shopDomain });
    }

    const event = await prisma.customEvent.create({
      data: {
        tenantId: tenant.id,
        eventType: "CART_ABANDONED",
        shopCustomerId: null,
        payload: {
          cartToken: cartToken || null,
          cartValue: cartValue || 0,
          currency: currency || "INR",
          items: items || []
        }
      }
    });

    res.status(201).json({ status: "ok", id: event.id });
  } catch (err) {
    console.error("Public cart-abandoned ingest error:", err);
    res
      .status(500)
      .json({ error: "Error saving public cart-abandoned event" });
  }
});

/**
 * Recent funnel events (for bonus section)
 * GET /api/events/recent
 */
app.get("/api/events/recent", authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const events = await prisma.customEvent.findMany({
      where: {
        tenantId,
        eventType: {
          in: ["CHECKOUT_STARTED", "CART_ABANDONED", "CHECKOUT_COMPLETED"]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    const shaped = events.map(e => {
      const payload = e.payload || {};
      const items = Array.isArray(payload.items) ? payload.items : [];

      return {
        id: e.id,
        eventType: e.eventType,
        createdAt: e.createdAt,
        shopCustomerId: e.shopCustomerId,
        cartValue:
          typeof payload.cartValue === "number"
            ? payload.cartValue
            : typeof payload.orderValue === "number"
            ? payload.orderValue
            : null,
        itemsCount: items.length
      };
    });

    res.json({ events: shaped });
  } catch (err) {
    console.error("Recent events error:", err);
    res.status(500).json({ error: "Error fetching recent events" });
  }
});

/**
 * Metrics summary with date range + event funnel
 */
app.get("/api/metrics/summary", authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { startDate, endDate } = req.query;

    // Orders date filter
    const orderWhere = { tenantId };
    if (startDate || endDate) {
      orderWhere.orderDate = {};
      if (startDate) orderWhere.orderDate.gte = new Date(startDate);
      if (endDate) {
        const d = new Date(endDate);
        d.setDate(d.getDate() + 1);
        orderWhere.orderDate.lte = d;
      }
    }

    // Events date filter
    const eventWhereBase = { tenantId };
    const eventDateFilter = {};
    if (startDate || endDate) {
      eventDateFilter.createdAt = {};
      if (startDate) eventDateFilter.createdAt.gte = new Date(startDate);
      if (endDate) {
        const d = new Date(endDate);
        d.setDate(d.getDate() + 1);
        eventDateFilter.createdAt.lte = d;
      }
    }

    const totalCustomers = await prisma.customer.count({ where: { tenantId } });

    const orders = await prisma.order.findMany({
      where: orderWhere,
      orderBy: { orderDate: "asc" }
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (sum, o) => sum + (o.totalSales ?? o.totalPrice ?? 0),
      0
    );
    const averageOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    const ordersByDateMap = {};
    for (const o of orders) {
      const key = o.orderDate.toISOString().slice(0, 10);
      if (!ordersByDateMap[key]) {
        ordersByDateMap[key] = { date: key, orders: 0, revenue: 0 };
      }
      ordersByDateMap[key].orders += 1;
      ordersByDateMap[key].revenue += o.totalSales ?? o.totalPrice ?? 0;
    }
    const ordersByDate = Object.values(ordersByDateMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const topCustomers = await prisma.customer.findMany({
      where: { tenantId },
      orderBy: { totalSpent: "desc" },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        totalSpent: true
      }
    });

    const ordersWithCustomer = orders.filter(o => o.customerId !== null);
    const customerOrderCounts = new Map();
    for (const o of ordersWithCustomer) {
      customerOrderCounts.set(
        o.customerId,
        (customerOrderCounts.get(o.customerId) || 0) + 1
      );
    }
    const repeatCustomers = [...customerOrderCounts.values()].filter(
      c => c > 1
    ).length;
    const repeatCustomerRate = ordersWithCustomer.length
      ? (repeatCustomers / customerOrderCounts.size) * 100
      : 0;

    const checkoutStartedCount = await prisma.customEvent.count({
      where: {
        ...eventWhereBase,
        ...eventDateFilter,
        eventType: "CHECKOUT_STARTED"
      }
    });

    const checkoutCompletedCount = await prisma.customEvent.count({
      where: {
        ...eventWhereBase,
        ...eventDateFilter,
        eventType: "CHECKOUT_COMPLETED"
      }
    });

    const explicitCartAbandonedCount = await prisma.customEvent.count({
      where: {
        ...eventWhereBase,
        ...eventDateFilter,
        eventType: "CART_ABANDONED"
      }
    });

    const derivedCartAbandonedCount = Math.max(
      checkoutStartedCount - checkoutCompletedCount,
      0
    );

    const cartAbandonedCount =
      explicitCartAbandonedCount > 0
        ? explicitCartAbandonedCount
        : derivedCartAbandonedCount;

    const checkoutToOrderConversion =
      checkoutStartedCount > 0
        ? (checkoutCompletedCount / checkoutStartedCount) * 100
        : 0;

    res.json({
      totalCustomers,
      totalOrders,
      totalRevenue,
      averageOrderValue,
      repeatCustomerRate,
      ordersByDate,
      topCustomers,
      checkoutStartedCount,
      checkoutCompletedCount,
      cartAbandonedCount,
      checkoutToOrderConversion
    });
  } catch (err) {
    console.error("Metrics error:", err);
    res.status(500).json({ error: "Error fetching metrics" });
  }
});

/**
 * Scheduler – sync all tenants periodically
 */
cron.schedule(cronSchedule, async () => {
  console.log("Running scheduled sync for all tenants");
  try {
    const tenants = await prisma.tenant.findMany();
    for (const t of tenants) {
      await syncShopifyForTenant(t.id);
    }
  } catch (err) {
    console.error("Scheduled sync error:", err);
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
