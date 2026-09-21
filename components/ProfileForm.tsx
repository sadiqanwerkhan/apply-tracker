"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fieldBase, btnPrimary } from "@/components/application-detail/shared";
import { CountryCitySelect } from "@/components/CountryCitySelect";
import { DIAL_CODES } from "@/lib/data/dialCodes";

function computeAge(dobStr: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) return null;
  const d = new Date(dobStr + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a <= 120 ? a : null;
}

type Profile = {
  firstName: string | null;
  lastName: string | null;
  contactEmail: string | null;
  age: number | null;
  dateOfBirth: string | null;
  phone: string | null;
  location: string | null;
};

function splitLocation(loc: string): { city: string; country: string } {
  const i = loc.lastIndexOf(", ");
  if (i > -1) return { city: loc.slice(0, i), country: loc.slice(i + 2) };
  return { city: loc, country: "" };
}
function splitPhone(phone: string): { code: string; number: string } {
  const match = DIAL_CODES.map((d) => d.code).sort((a, b) => b.length - a.length).find((c) => phone.startsWith(c));
  if (match) return { code: match, number: phone.slice(match.length).trim() };
  return { code: "+49", number: phone };
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-2 last:border-b-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-right text-[13px] font-medium text-foreground">{value}</span>
    </div>
  );
}

export function ProfileForm() {
  const [loginEmail, setLoginEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(true);          // collapsible
  const [editing, setEditing] = useState(false);   // view vs edit
  const [hasProfile, setHasProfile] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [dob, setDob] = useState("");
  const [phoneCode, setPhoneCode] = useState("+49");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  const { data: profileData } = useQuery<{ loginEmail: string; profile: Profile | null }>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      return res.json();
    },
    staleTime: 60_000,
  });

  // Sync the cached profile into the editable form state once it arrives.
  useEffect(() => {
    if (!profileData) return;
    setLoginEmail(profileData.loginEmail || "");
    const p = profileData.profile;
    if (p && (p.firstName || p.lastName || p.location)) {
      setFirstName(p.firstName || "");
      setLastName(p.lastName || "");
      setContactEmail(p.contactEmail || "");
      setDob(p.dateOfBirth || "");
      if (p.phone) { const s = splitPhone(p.phone); setPhoneCode(s.code); setPhoneNumber(s.number); }
      if (p.location) { const s = splitLocation(p.location); setCountry(s.country); setCity(s.city); }
      setHasProfile(true);
      setEditing(false);
    } else {
      setEditing(true);
    }
    setLoading(false);
  }, [profileData]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "First name is required";
    if (!lastName.trim()) e.lastName = "Last name is required";
    if (!country.trim() && !city.trim()) e.location = "Current location is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    const location = [city.trim(), country.trim()].filter(Boolean).join(", ");
    const phone = phoneNumber.trim() ? `${phoneCode} ${phoneNumber.trim()}` : "";
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, contactEmail, dateOfBirth: dob, phone, location }),
      });
      if (res.ok) { setHasProfile(true); setEditing(false); }
    } finally {
      setSaving(false);
    }
  }

  const errClass = (k: string) => (errors[k] ? " border-danger focus:border-danger focus:ring-danger/15" : "");
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const locationText = [city, country].filter(Boolean).join(", ");
  const phoneText = phoneNumber ? `${phoneCode} ${phoneNumber}` : "";

  const Header = (
    <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 p-4 text-left sm:p-6">
      <span className="text-base font-semibold text-foreground">Personal details</span>
      <svg className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
    </button>
  );

  return (
    <div className="rounded-xl border border-border bg-card">
      {Header}
      {open && (
        <div className="px-4 pb-4 sm:px-6 sm:pb-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !editing && hasProfile ? (
            // ── SAVED VIEW (receipt-style) ──
            <div>
              <div className="rounded-lg border border-border/60 p-1">
                <div className="px-3">
                  <Row label="Name" value={fullName} />
                  <Row label="Login email" value={loginEmail} />
                  <Row label="Contact email" value={contactEmail} />
                  <Row label="Age" value={computeAge(dob) !== null ? String(computeAge(dob)) : ""} />
                  <Row label="Phone" value={phoneText} />
                  <Row label="Location" value={locationText} />
                </div>
              </div>
              <button onClick={() => setEditing(true)} className="mt-4 text-sm font-medium text-accent hover:underline">Edit</button>
            </div>
          ) : (
            // ── EDIT FORM ──
            <>
              <p className="-mt-1 mb-4 text-[13px] text-muted-foreground">This is your honest profile — the real you. Keep it accurate; other sections will build on it.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[13px] font-medium text-foreground/80">Alternate contact email <span className="font-normal text-muted-foreground">(optional)</span></span>
                  <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={fieldBase} placeholder="you@example.com" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-foreground/80">Date of birth <span className="font-normal text-muted-foreground">(optional)</span></span>
                  <input type="date" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.target.value)} className={fieldBase} />
                  {computeAge(dob) !== null && <span className="text-[11px] text-muted-foreground">Age: {computeAge(dob)}</span>}
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
                <button onClick={save} disabled={saving} className={btnPrimary}>{saving ? "Saving…" : "Save profile"}</button>
                {hasProfile && <button onClick={() => setEditing(false)} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
