"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // check if we already have a token cookie
  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => {
        setConnected(d.connected);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function connectGmail() {
    const res = await fetch("/api/auth/url");
    const { url } = await res.json();
    window.location.href = url;
  }

  if (loading) {
    return (
      <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "60px auto", padding: 20 }}>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "60px auto", padding: 20 }}>
      <h1>Apply Tracker</h1>
      {connected ? (
        <p>Connected ✓ — next we build the scan and dashboard here.</p>
      ) : (
        <>
          <p>Connect your Gmail to scan your job applications.</p>
          <button
            onClick={connectGmail}
            style={{
              padding: "12px 20px",
              background: "#1a73e8",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            Connect Gmail
          </button>
        </>
      )}
    </main>
  );
}