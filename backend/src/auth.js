// src/auth.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function generateToken(user) {
  return jwt.sign(
    { userId: user.id, tenantId: user.tenantId, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ error: "Missing Authorization header" });

  const token = header.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Invalid Authorization header" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function registerHandler(req, res) {
  try {
    const { email, password, tenantName, shopDomain, shopAccessToken } = req.body;

    if (!email || !password || !tenantName || !shopDomain || !shopAccessToken) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const existingTenant = await prisma.tenant.findUnique({ where: { shopDomain } });
    if (existingTenant)
      return res.status(400).json({ error: "Tenant with this shop domain already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        shopDomain,
        shopAccessToken
      }
    });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        tenantId: tenant.id
      }
    });

    const token = generateToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email },
      tenant: { id: tenant.id, name: tenant.name, shopDomain: tenant.shopDomain }
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function loginHandler(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Missing email or password" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email }, tenantId: user.tenantId });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  authMiddleware,
  registerHandler,
  loginHandler
};
