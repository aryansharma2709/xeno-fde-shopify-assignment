"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

type RecentEvent = {
  id: number;
  eventType: "CHECKOUT_STARTED" | "CART_ABANDONED" | "CHECKOUT_COMPLETED" | string;
  createdAt: string;
  shopCustomerId: string | null;
  cartValue: number | null;
  itemsCount: number;
};

export default function RecentEventsCard() {
  const router = useRouter();
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function getToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }

  async function load() {
    const token = getToken();
    if (!token) {
      router.push("/");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/events/recent`, {
        // ❌ NO credentials: "include" here
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        // Not logged in / token expired
        router.push("/");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to fetch events");
        setEvents([]);
        return;
      }

      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err) {
      console.error("Recent events error", err);
      setError("Failed to fetch");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card mt-4">
      <div className="flex" style={{ justifyContent: "space-between" }}>
        <div>
          <h3>Recent funnel events</h3>
          <p className="small">Last 10 custom funnel events from your store.</p>
        </div>
        <span className="badge">Last 10</span>
      </div>

      {loading ? (
        <p className="small mt-2">Loading…</p>
      ) : error ? (
        <p className="small mt-2">{error}</p>
      ) : events.length === 0 ? (
        <p className="small mt-2">No events yet. Trigger some checkout/cart activity.</p>
      ) : (
        <table className="table mt-3">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Customer</th>
              <th>Cart value</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  {new Date(e.createdAt).toLocaleString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "short"
                  })}
                </td>
                <td>{e.eventType.replace("_", " ")}</td>
                <td>{e.shopCustomerId || "—"}</td>
                <td>
                  {e.cartValue != null ? `₹${e.cartValue.toFixed(2)}` : "—"}
                </td>
                <td>{e.itemsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
