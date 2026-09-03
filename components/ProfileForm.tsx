"use client";

import { useState, useEffect } from "react";
import { fieldBase, btnPrimary } from "@/components/application-detail/shared";
import { CountryCitySelect } from "@/components/CountryCitySelect";
import { DIAL_CODES } from "@/lib/data/dialCodes";

type Profile = {
  firstName: string | null;
  lastName: string | null;
  contactEmail: string | null;
  age: number | null;
  phone: string | null;
  location: string | null;
};

// Split a stored "City, Country" location back into parts for the pickers.
function splitLocation(loc: string): { city: string; country: string } {
  const i = loc.lastIndexOf(", ");
  if (i > -1) return { city: loc.slice(0, i), country: loc.slice(i + 2) };
  return { city: loc, country: "" };
}
// Split a stored "+49 1766…" phone into code + number.
function splitPhone(phone: string): { code: string; number: string } {
  const match = DIAL_CODES.map((d) => d.code).sort((a, b) => b.length - a.length).find((c) => phone.startsWith(c));
  if (match) return { code: match, number: phone.slice(match.length).trim() };
  return { code: "+49", number: phone };
}

export function ProfileForm() {
  const [loginEmail, setLoginEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [age, setAge] = useState("");
  const [phoneCode, setPhoneCode] = useState("+49");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

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
          if (p.phone) { const s = splitPhone(p.phone); setPhoneCode(s.code); setPhoneNumber(s.number); }
          if (p.location) { const s = splitLocation(p.location); setCountry(s.country); setCity(s.city); }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "First name is required";
    if (!lastName.trim()) e.lastName = "Last name is required";
    // Location required: at least a country or city must be provided.
    if (!country.trim() && !city.trim()) e.location = "Current location is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    setSaved(false);
    // Combine the parts back into the fields the API stores.
    const location = [city.trim(), country.trim()].filter(Boolean).join(", ");
    const phone = phoneNumber.trim() ? `${phoneCode} ${phoneNumber.trim()}` : "";
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, contactEmail, age, phone, location }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const errClass = (k: string) => (errors[k] ? " border-danger focus:border-danger focus:ring-danger/15" : "");

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-base font-semibold text-foreground">Personal details</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        This is your honest profile — the real you. Keep it accurate; other sections will build on it.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-foreground/80">First name <span className="text-danger">*</span></span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={`${fieldBase}${errClass("firstName")}`} placeholder="Jane" />
          {errors.firstName && <span className="text-[11px] text-danger">{errors.firstName}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-foreground/80">Last name <span className="text-danger">*</span></span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={`${fieldBase}${errClass("lastName")}`} placeholder="Doe" />
          {errors.lastName && <span className="text-[11px] text-danger">{errors.lastName}</span>}
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

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-foreground/80">Phone <span className="font-normal text-muted-foreground">(optional)</span></span>
          <div className="flex gap-2">
            <select value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} className={`${fieldBase} shrink-0`}>
              {DIAL_CODES.map((d) => <option key={d.country} value={d.code}>{d.flag} {d.code}</option>)}
            </select>
            <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d ]/g, ""))} className={`${fieldBase} flex-1`} placeholder="17662842394" />
          </div>
          <span className="text-[11px] text-muted-foreground">Just the number — no leading 0 or country code.</span>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[13px] font-medium text-foreground/80">Current location <span className="text-danger">*</span></span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CountryCitySelect country={country} city={city} onCountry={setCountry} onCity={setCity} />
          </div>
          {errors.location && <span className="text-[11px] text-danger">{errors.location}</span>}
        </div>
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
