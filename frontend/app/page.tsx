"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [tenantName, setTenantName] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [shopAccessToken, setShopAccessToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) setError(data.error || "Login failed");
        else {
          localStorage.setItem("token", data.token);
          router.push("/dashboard");
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            tenantName,
            shopDomain,
            shopAccessToken
          })
        });
        const data = await res.json();
        if (!res.ok) setError(data.error || "Registration failed");
        else {
          localStorage.setItem("token", data.token);
          router.push("/dashboard");
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="auth-wrapper card">
        <div className="flex" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1>Xeno Shopify Insights</h1>
            <p className="small">
              Multi-tenant ingestion & analytics service for Shopify brands.
            </p>
          </div>
          <div className="logo-badge">X</div>
        </div>

        <div className="flex mt-4" style={{ gap: 10 }}>
          <button
            type="button"
            className="btn-ghost"
            style={{
              flex: 1,
              borderColor: mode === "login" ? "#22c55e" : "#1e293b"
            }}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{
              flex: 1,
              borderColor: mode === "register" ? "#22c55e" : "#1e293b"
            }}
            onClick={() => setMode("register")}
          >
            Register Store
          </button>
        </div>

        <form className="mt-4 flex-col" onSubmit={handleSubmit}>
          <div className="flex-col">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@brand.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex-col mt-2">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {mode === "register" && (
            <>
              <div className="flex-col mt-2">
                <label>Tenant / Brand Name</label>
                <input
                  type="text"
                  placeholder="Acme Retail"
                  value={tenantName}
                  onChange={e => setTenantName(e.target.value)}
                  required
                />
              </div>

              <div className="flex-col mt-2">
                <label>Shopify Shop Domain</label>
                <input
                  type="text"
                  placeholder="your-store.myshopify.com"
                  value={shopDomain}
                  onChange={e => setShopDomain(e.target.value)}
                  required
                />
              </div>

              <div className="flex-col mt-2">
                <label>Shopify Admin API Access Token</label>
                <input
                  type="password"
                  placeholder="shpat_..."
                  value={shopAccessToken}
                  onChange={e => setShopAccessToken(e.target.value)}
                  required
                />
                <p className="small">
                  From Shopify &gt; Apps &gt; Develop apps &gt; API credentials.
                </p>
              </div>
            </>
          )}

          {error && <div className="error mt-2">{error}</div>}

          <button
            type="submit"
            className="btn-primary mt-4"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login"
              : "Register & Connect Store"}
          </button>
        </form>

        <p className="small mt-3">
          Once logged in, open the Dashboard, hit <b>Sync from Shopify</b> to
          ingest your customers, products & orders.
        </p>
      </div>
    </main>
  );
}
