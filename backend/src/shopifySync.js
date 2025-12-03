// src/shopifySync.js
const axios = require("axios");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-04";

async function fetchFromShopify(path, tenant) {
  const baseUrl = `https://${tenant.shopDomain}/admin/api/${SHOPIFY_API_VERSION}`;
  const headers = {
    "X-Shopify-Access-Token": tenant.shopAccessToken,
    "Content-Type": "application/json",
  };
  const url = `${baseUrl}${path}`;
  const res = await axios.get(url, { headers });
  return res.data;
}

function safeFloat(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function syncShopifyForTenant(tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    console.warn("Tenant not found:", tenantId);
    return;
  }

  console.log(`Syncing Shopify for tenant ${tenant.name} (${tenant.shopDomain})`);

  // ============= ORDERS + CUSTOMERS (main source of truth) =============
  try {
    const data = await fetchFromShopify(
      "/orders.json?status=any&financial_status=any&limit=250",
      tenant
    );

    const shopifyOrders = data.orders || [];
    const shopifyOrderIds = new Set(shopifyOrders.map((o) => String(o.id)));

    console.log(`Shopify has ${shopifyOrderIds.size} orders`);

    // Delete orders that no longer exist
    const existingOrders = await prisma.order.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, shopOrderId: true },
    });

    const ordersToDelete = existingOrders.filter(
      (o) => !shopifyOrderIds.has(o.shopOrderId)
    );

    if (ordersToDelete.length > 0) {
      const ids = ordersToDelete.map((o) => o.id);
      await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.order.deleteMany({ where: { id: { in: ids } } });
      console.log(`✓ Deleted ${ids.length} obsolete orders`);
    } else {
      console.log("No orders to delete – DB in sync");
    }

    // ---- Upsert customers & orders ----
    for (const o of shopifyOrders) {
      // ---------- 1. Customer (from order object) ----------
      let customerId = null;
      if (o.customer && o.customer.id) {
        // Try to extract best possible name from order + addresses
        let firstName =
          (o.customer.first_name && o.customer.first_name.trim()) ||
          (o.customer.firstName && o.customer.firstName.trim()) ||
          (o.billing_address?.first_name &&
            o.billing_address.first_name.trim()) ||
          (o.billing_address?.firstName &&
            o.billing_address.firstName.trim()) ||
          (o.shipping_address?.first_name &&
            o.shipping_address.first_name.trim()) ||
          (o.shipping_address?.firstName &&
            o.shipping_address.firstName.trim()) ||
          null;

        let lastName =
          (o.customer.last_name && o.customer.last_name.trim()) ||
          (o.customer.lastName && o.customer.lastName.trim()) ||
          (o.billing_address?.last_name &&
            o.billing_address.last_name.trim()) ||
          (o.billing_address?.lastName &&
            o.billing_address.lastName.trim()) ||
          (o.shipping_address?.last_name &&
            o.shipping_address.last_name.trim()) ||
          (o.shipping_address?.lastName &&
            o.shipping_address.lastName.trim()) ||
          null;

        // Fallback: parse from full name
        if (!firstName && !lastName) {
          const fullName =
            (o.customer.name && o.customer.name.trim()) ||
            (o.billing_address?.name && o.billing_address.name.trim()) ||
            (o.shipping_address?.name && o.shipping_address.name.trim()) ||
            null;
          if (fullName) {
            const parts = fullName.split(/\s+/);
            firstName = parts[0];
            lastName = parts.slice(1).join(" ") || null;
          }
        }

        const email =
          (o.customer.email && o.customer.email.trim()) || null;

        const updateData = {};
        if (firstName !== null) updateData.firstName = firstName;
        if (lastName !== null) updateData.lastName = lastName;
        if (email !== null) updateData.email = email;

        const customerRecord = await prisma.customer.upsert({
          where: {
            tenantId_shopCustomerId: {
              tenantId: tenant.id,
              shopCustomerId: String(o.customer.id),
            },
          },
          // Prisma ko empty object bhi chalta hai, undefined nahi
          update: updateData,
          create: {
            tenantId: tenant.id,
            shopCustomerId: String(o.customer.id),
            firstName: firstName || null,
            lastName: lastName || null,
            email: email || null,
            totalSpent: 0,
          },
        });

        customerId = customerRecord.id;
      }

      // ---------- 2. Order finance fields (Shopify Total sales formula) ----------
      const grossSales =
        safeFloat(o.total_line_items_price) || safeFloat(o.subtotal_price);
      const discounts = safeFloat(o.total_discounts);
      const taxes = safeFloat(o.total_tax);

      const shipping = (o.shipping_lines || []).reduce(
        (sum, s) => sum + safeFloat(s.price),
        0
      );

      // Refunds / returns (treat successful refund transactions as returns)
      const returns = (o.refunds || []).reduce((sum, r) => {
        const txs = r.transactions || [];
        const refundsSum = txs
          .filter(
            (t) =>
              t.kind === "refund" &&
              (!t.status || t.status === "success")
          )
          .reduce((txSum, t) => txSum + safeFloat(t.amount), 0);
        return sum + refundsSum;
      }, 0);

      // Shopify finance report: gross - discounts - returns + taxes + shipping
      const totalSales = grossSales - discounts - returns + taxes + shipping;

      // last safety: if somehow NaN aa gaya toh 0
      const cleanTotalSales = Number.isFinite(totalSales) ? totalSales : 0;

      // ---------- 3. Store order ----------
      const orderRecord = await prisma.order.upsert({
        where: {
          tenantId_shopOrderId: {
            tenantId: tenant.id,
            shopOrderId: String(o.id),
          },
        },
        update: {
          grossSales,
          discounts,
          returns,
          taxes,
          shipping,
          totalSales: cleanTotalSales,
          totalPrice: cleanTotalSales, // UI ke liye
          currency: o.currency || "INR",
          orderDate: new Date(o.created_at),
          customerId,
        },
        create: {
          tenantId: tenant.id,
          shopOrderId: String(o.id),

          grossSales,
          discounts,
          returns,
          taxes,
          shipping,
          totalSales: cleanTotalSales,
          totalPrice: cleanTotalSales,

          currency: o.currency || "INR",
          orderDate: new Date(o.created_at),
          customerId,
        },
      });

      // ---------- 4. Order items ----------
      await prisma.orderItem.deleteMany({ where: { orderId: orderRecord.id } });

      for (const li of o.line_items || []) {
        let productId = null;
        if (li.product_id) {
          const prod = await prisma.product.findUnique({
            where: {
              tenantId_shopProductId: {
                tenantId: tenant.id,
                shopProductId: String(li.product_id),
              },
            },
          });
          if (prod) productId = prod.id;
        }

        await prisma.orderItem.create({
          data: {
            orderId: orderRecord.id,
            productId,
            quantity: li.quantity || 0,
            price: safeFloat(li.price),
          },
        });
      }
    }

    console.log(`✓ Synced ${shopifyOrders.length} orders`);

    // ---------- Recalculate customer totalSpent based on totalSales ----------
    const allCustomers = await prisma.customer.findMany({
      where: { tenantId: tenant.id },
      select: { id: true },
    });

    for (const c of allCustomers) {
      const orders = await prisma.order.findMany({
        where: { tenantId: tenant.id, customerId: c.id },
        select: { totalSales: true },
      });
      const total = orders.reduce(
        (s, o) => s + (o.totalSales || 0),
        0
      );
      await prisma.customer.update({
        where: { id: c.id },
        data: { totalSpent: total },
      });
    }
  } catch (err) {
    console.error("Order/customer sync error:", err?.response?.data || err);
  }

  // ============= EXTRA CUSTOMERS SYNC (names from /customers.json) =============
  try {
    const data = await fetchFromShopify("/customers.json?limit=250", tenant);
    const shopifyCustomers = data.customers || [];
    const shopifyCustomerIds = new Set(
      shopifyCustomers.map((c) => String(c.id))
    );

    // Delete customers that no longer exist in Shopify (only if they have no orders)
    const customersToDelete = await prisma.customer.findMany({
      where: {
        tenantId: tenant.id,
        shopCustomerId: { notIn: Array.from(shopifyCustomerIds) },
        orders: { none: {} },
      },
      select: { id: true },
    });

    if (customersToDelete.length > 0) {
      await prisma.customer.deleteMany({
        where: { id: { in: customersToDelete.map((c) => c.id) } },
      });
      console.log(
        `Deleted ${customersToDelete.length} customers that no longer exist in Shopify`
      );
    }

    let loggedFirst = false;

    for (const c of shopifyCustomers) {
      const defaultAddr =
        c.default_address ||
        (Array.isArray(c.addresses) && c.addresses.length > 0
          ? c.addresses[0]
          : null);

      let firstName =
        (c.first_name && String(c.first_name).trim()) ||
        (c.firstName && String(c.firstName).trim()) ||
        (defaultAddr?.first_name &&
          String(defaultAddr.first_name).trim()) ||
        (defaultAddr?.firstName &&
          String(defaultAddr.firstName).trim()) ||
        null;

      let lastName =
        (c.last_name && String(c.last_name).trim()) ||
        (c.lastName && String(c.lastName).trim()) ||
        (defaultAddr?.last_name &&
          String(defaultAddr.last_name).trim()) ||
        (defaultAddr?.lastName &&
          String(defaultAddr.lastName).trim()) ||
        null;

      // Fallback: default_address.name se parse
      if (!firstName && !lastName && defaultAddr?.name) {
        const parts = String(defaultAddr.name).trim().split(/\s+/);
        if (parts.length > 0) {
          firstName = parts[0];
          lastName = parts.slice(1).join(" ") || null;
        }
      }

      const email =
        (c.email && String(c.email).trim()) ||
        (defaultAddr?.email && String(defaultAddr.email).trim()) ||
        null;

      if (!loggedFirst) {
        loggedFirst = true;
        console.log("\nFirst customer from /customers.json:");
        console.log("  ID:", c.id);
        console.log("  Raw keys:", Object.keys(c));
        console.log(
          "  default_address keys:",
          defaultAddr ? Object.keys(defaultAddr) : []
        );
        console.log("  Parsed firstName:", firstName);
        console.log("  Parsed lastName:", lastName);
        console.log("  Parsed email:", email);
      }

      const updateData = {};
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (email) updateData.email = email;

      await prisma.customer.upsert({
        where: {
          tenantId_shopCustomerId: {
            tenantId: tenant.id,
            shopCustomerId: String(c.id),
          },
        },
        update: updateData, // totalSpent ko touch nahi kar rahe
        create: {
          tenantId: tenant.id,
          shopCustomerId: String(c.id),
          firstName: firstName || null,
          lastName: lastName || null,
          email: email || null,
          totalSpent: 0, // orders sync baad me recalc karega
        },
      });
    }

    console.log(`✓ Synced ${shopifyCustomers.length} customers from /customers.json`);
  } catch (err) {
    console.error("Extra customer sync error:", err?.response?.data || err);
  }

  // ============= PRODUCTS =============
  try {
    const data = await fetchFromShopify("/products.json?limit=250", tenant);
    const shopifyProducts = data.products || [];
    const shopifyProductIds = new Set(shopifyProducts.map((p) => String(p.id)));

    const productsToDelete = await prisma.product.findMany({
      where: {
        tenantId: tenant.id,
        shopProductId: { notIn: Array.from(shopifyProductIds) },
        items: { none: {} },
      },
    });

    if (productsToDelete.length > 0) {
      await prisma.product.deleteMany({
        where: { id: { in: productsToDelete.map((p) => p.id) } },
      });
      console.log(`Deleted ${productsToDelete.length} obsolete products`);
    }

    for (const p of shopifyProducts) {
      const variant = (p.variants && p.variants[0]) || {};
      await prisma.product.upsert({
        where: {
          tenantId_shopProductId: {
            tenantId: tenant.id,
            shopProductId: String(p.id),
          },
        },
        update: {
          title: p.title,
          sku: variant.sku || null,
          price: variant.price ? safeFloat(variant.price) : null,
        },
        create: {
          tenantId: tenant.id,
          shopProductId: String(p.id),
          title: p.title,
          sku: variant.sku || null,
          price: variant.price ? safeFloat(variant.price) : null,
        },
      });
    }

    console.log(`✓ Synced ${shopifyProducts.length} products`);
  } catch (err) {
    console.error("Product sync error:", err?.response?.data || err);
  }

  // ============= FINAL SUMMARY (DB side) =============
  const finalOrderCount = await prisma.order.count({
    where: { tenantId: tenant.id },
  });
  const finalCustomerCount = await prisma.customer.count({
    where: { tenantId: tenant.id },
  });
  const finalProductCount = await prisma.product.count({
    where: { tenantId: tenant.id },
  });
  const finalRevenue = await prisma.order.aggregate({
    where: { tenantId: tenant.id },
    _sum: { totalSales: true },
  });

  console.log("\n=== SYNC SUMMARY ===");
  console.log(`Orders in database:   ${finalOrderCount}`);
  console.log(`Customers in database:${finalCustomerCount}`);
  console.log(`Products in database: ${finalProductCount}`);
  console.log(
    `Total revenue (DB):   ₹${(finalRevenue._sum.totalSales || 0).toFixed(2)}`
  );
  console.log("===================\n");
}

module.exports = { syncShopifyForTenant };
