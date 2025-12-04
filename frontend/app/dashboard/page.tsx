// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import RecentEventsCard from "./RecentEventsCard";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

type OrdersByDate = {
  date: string;
  orders: number;
  revenue: number;
};

type TopCustomer = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  totalSpent: number;
};

type MetricsResponse = {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  repeatCustomerRate: number;
  ordersByDate: OrdersByDate[];
  topCustomers: TopCustomer[];
  checkoutStartedCount: number;
  cartAbandonedCount: number;
  checkoutCompletedCount: number;
  checkoutToOrderConversion: number;
};

export default function Dashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  function getToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }

  async function fetchMetrics() {
    const token = getToken();
    if (!token) {
      router.push("/");
      return;
    }

    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/metrics/summary?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      if (!res.ok) setError(data.error || "Failed to load metrics");
      else setMetrics(data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    const token = getToken();
    if (!token) {
      router.push("/");
      return;
    }

    setSyncing(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/sync/shopify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Failed to sync");
      else await fetchMetrics();
    } catch {
      setError("Network error");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
    router.push("/");
  }

  const chartData = metrics
    ? {
        labels: metrics.ordersByDate.map((o) => o.date),
        datasets: [
          {
            label: "Revenue",
            data: metrics.ordersByDate.map((o) => o.revenue),
            borderColor: "#22c55e",
            backgroundColor: "rgba(34, 197, 94, 0.18)",
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "#22c55e",
            pointBorderColor: "#22c55e",
            tension: 0.35,
            fill: true,
          },
          {
            label: "Orders",
            data: metrics.ordersByDate.map((o) => o.orders),
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.18)",
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "#38bdf8",
            pointBorderColor: "#38bdf8",
            tension: 0.35,
            yAxisID: "y2",
          },
        ],
      }
    : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "#e5e7eb",
          boxWidth: 10,
          font: { size: 11 },
        },
      },
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.97)",
        borderColor: "rgba(148,163,184,0.7)",
        borderWidth: 1,
        titleColor: "#f9fafb",
        bodyColor: "#e5e7eb",
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#9ca3af",
        },
        grid: {
          color: "rgba(148,163,184,0.18)",
          drawBorder: false,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#9ca3af",
        },
        grid: {
          color: "rgba(148,163,184,0.18)",
          drawBorder: false,
        },
      },
      y2: {
        position: "right" as const,
        beginAtZero: true,
        ticks: {
          color: "#9ca3af",
        },
        grid: {
          drawOnChartArea: false,
          drawBorder: false,
        },
      },
    },
  };

  return (
    <main>
      <div className="app-shell">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-badge">X</div>
            <div>
              <div className="sidebar-title">Xeno Insights</div>
              <div className="sidebar-subtitle">Shopify FDE Assignment</div>
            </div>
          </div>

          <div>
            <div className="sidebar-section-title">Navigation</div>
            <div className="nav-list">
              <div className="nav-item active">
                <span className="nav-dot" />
                <span>Dashboard</span>
              </div>
            </div>
          </div>

          <div>
            <div className="sidebar-section-title">Actions</div>
            <div className="nav-list">
              <button
                className="nav-item"
                style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={handleSync}
                disabled={syncing}
              >
                <span className="nav-dot" />
                <span>{syncing ? "Syncing..." : "Sync from Shopify"}</span>
              </button>
              <button
                className="nav-item"
                style={{
                  width: "100%",
                  justifyContent: "flex-start",
                  border: "1px solid #1e293b",
                }}
                onClick={fetchMetrics}
              >
                <span className="nav-dot" />
                <span>Refresh Metrics</span>
              </button>
            </div>
          </div>

          <div className="sidebar-footer">
            <button
              className="btn-ghost"
              style={{ width: "100%" }}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <section className="app-main">
          {/* Header */}
          <div
            className="flex"
            style={{ justifyContent: "space-between", gap: 12 }}
          >
            <div>
              <h2>Performance Overview</h2>
              <p className="small">
                Customers, orders, revenue & funnel for your connected Shopify
                store.
              </p>
            </div>
            <div className="card-ghost">
              <div className="small">Date range</div>
              <div className="flex mt-2">
                <div className="flex-col">
                  <label>From</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-col">
                  <label>To</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <button className="btn-primary" onClick={fetchMetrics}>
                  Apply
                </button>
              </div>
            </div>
          </div>

          {error && <div className="error mt-3">{error}</div>}

          {loading ? (
            <p className="small mt-4">Loading metrics…</p>
          ) : metrics ? (
            <>
              {/* KPI cards */}
              <div
                className="flex mt-4"
                style={{ gap: 12, flexWrap: "wrap" }}
              >
                <div className="card" style={{ flex: "1 1 160px" }}>
                  <div className="small">Total Customers</div>
                  <h2>{metrics.totalCustomers}</h2>
                </div>
                <div className="card" style={{ flex: "1 1 160px" }}>
                  <div className="small">Total Orders</div>
                  <h2>{metrics.totalOrders}</h2>
                </div>
                <div className="card" style={{ flex: "1 1 160px" }}>
                  <div className="small">Total Revenue</div>
                  <h2>₹{metrics.totalRevenue.toFixed(2)}</h2>
                </div>
                <div className="card" style={{ flex: "1 1 160px" }}>
                  <div className="small">Average Order Value</div>
                  <h2>₹{metrics.averageOrderValue.toFixed(2)}</h2>
                </div>
                <div className="card" style={{ flex: "1 1 160px" }}>
                  <div className="small">Repeat Customer Rate</div>
                  <h2>{metrics.repeatCustomerRate.toFixed(1)}%</h2>
                </div>
              </div>

              {/* Revenue & orders chart */}
              <div className="card mt-4">
                <div
                  className="flex"
                  style={{ justifyContent: "space-between" }}
                >
                  <div>
                    <h3>Revenue & Orders Trend</h3>
                    <p className="small">
                      Based on the selected date range. Helps you spot spikes &
                      dips.
                    </p>
                  </div>
                  <span className="badge">
                    {metrics.ordersByDate.length} data points
                  </span>
                </div>

                {chartData && chartData.labels.length > 0 ? (
                  <div style={{ marginTop: 12, height: 260 }}>
                    <Line data={chartData} options={chartOptions} />
                  </div>
                ) : (
                  <p className="small mt-2">
                    No order data to display. Add orders in Shopify and sync.
                  </p>
                )}
              </div>

              {/* Event funnel metrics */}
              <div className="card mt-4">
                <div
                  className="flex"
                  style={{ justifyContent: "space-between" }}
                >
                  <div>
                    <h3>Checkout Funnel (Custom Events)</h3>
                    <p className="small">
                      Events captured from your store&apos;s checkout flow.
                    </p>
                  </div>
                </div>

                <div
                  className="flex mt-3"
                  style={{ gap: 12, flexWrap: "wrap" }}
                >
                  <div className="card-ghost" style={{ flex: "1 1 180px" }}>
                    <div className="small">Checkouts Started</div>
                    <h2>{metrics.checkoutStartedCount}</h2>
                  </div>
                  <div className="card-ghost" style={{ flex: "1 1 180px" }}>
                    <div className="small">Cart Abandoned</div>
                    <h2>{metrics.cartAbandonedCount}</h2>
                  </div>
                  <div className="card-ghost" style={{ flex: "1 1 180px" }}>
                    <div className="small">Checkouts Completed</div>
                    <h2>{metrics.checkoutCompletedCount}</h2>
                  </div>
                  <div className="card-ghost" style={{ flex: "1 1 180px" }}>
                    <div className="small">Checkout → Order Conversion</div>
                    <h2>{metrics.checkoutToOrderConversion.toFixed(1)}%</h2>
                  </div>
                </div>
              </div>

              {/* Orders by date table */}
              <div className="card mt-4">
                <h3>Orders by Date</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.ordersByDate.map((row) => (
                      <tr key={row.date}>
                        <td>{row.date}</td>
                        <td>{row.orders}</td>
                        <td>₹{row.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                    {metrics.ordersByDate.length === 0 && (
                      <tr>
                        <td colSpan={3} className="small">
                          No orders for this range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Top customers + recent events row */}
              <div
                className="flex mt-4"
                style={{ gap: 12, flexWrap: "wrap" }}
              >
                {/* Top customers */}
                <div className="card" style={{ flex: "2 1 320px" }}>
                  <h3>Top 5 Customers by Spend</h3>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Total Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.topCustomers.map((c) => {
                        const firstName = c.firstName?.trim() || "";
                        const lastName = c.lastName?.trim() || "";
                        const email = c.email?.trim() || "";

                        let displayName = "";
                        if (firstName || lastName) {
                          displayName = `${firstName} ${lastName}`.trim();
                        } else if (email) {
                          displayName = email;
                        } else {
                          displayName = `Customer #${c.id}`;
                        }

                        return (
                          <tr key={c.id}>
                            <td>{displayName}</td>
                            <td>₹{c.totalSpent.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                      {metrics.topCustomers.length === 0 && (
                        <tr>
                          <td colSpan={2} className="small">
                            No customer spend data yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Recent funnel events card */}
                <div style={{ flex: "1 1 260px", minWidth: 260 }}>
                  <RecentEventsCard />
                </div>
              </div>
            </>
          ) : (
            <p className="small mt-4">No metrics available.</p>
          )}
        </section>
      </div>
    </main>
  );
}
