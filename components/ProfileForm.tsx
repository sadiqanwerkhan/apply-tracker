"use client";

import { useState, useEffect } from "react";
import { fieldBase, btnPrimary } from "@/components/application-detail/shared";

type Profile = {
  firstName: string | null;
  lastName: string | null;
  contactEmail: string | null;
  age: number | null;
  phone: string | null;
  location: string | null;
};

// Piece 1 of the profile: personal info. The login email is auto-filled and
// read-only; the user can optionally add an alternate contact email. This is the
// honest "root" record — later sections (work, education, skills) build on it.
export function ProfileForm() {
  const [loginEmail, setLoginEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        setLoginEmail(d.loginEmail || "");
        const p: Profile | null = d.profile;
        if (p) {
          setFirstName(p.firstName || "");
          setLastName(p.lastName || "");
          setContactEmail(p.contactEmail || "");
          setAge(p.age != null ? String(p.age) : "");
          setPhone(p.phone || "");
          setLocation(p.location || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, contactEmail, age, phone, location }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-base font-semibold text-foreground">Personal details</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        This is your honest profile — the real you. Keep it accurate; other sections will build on it.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-foreground/80">First name</span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={fieldBase} placeholder="Jane" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-foreground/80">Last name</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={fieldBase} placeholder="Doe" />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[13px] font-medium text-foreground/80">Login email</span>
          <input value={loginEmail} readOnly disabled className={`${fieldBase} cursor-not-allowed opacity-70`} />
          <span className="text-[11px] text-muted-foreground">The email you signed in with.</span>
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[13px] font-medium text-foreground/80">Alternate contact email <span className="font-normal text-muted-foreground">(optional)</span></span>
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={fieldBase} placeholder="you@example.com" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-foreground/80">Age <span className="font-normal text-muted-foreground">(optional)</span></span>
          <input type="number" min={14} max={100} value={age} onChange={(e) => setAge(e.target.value)} className={fieldBase} placeholder="28" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-foreground/80">Phone <span className="font-normal text-muted-foreground">(optional)</span></span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldBase} placeholder="+49 …" />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[13px] font-medium text-foreground/80">Current location</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={fieldBase} placeholder="Berlin, Germany" />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={save} disabled={saving} className={btnPrimary}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        {saved && <span className="text-[13px] text-success">Saved ✓</span>}
      </div>
    </div>
  );
}
