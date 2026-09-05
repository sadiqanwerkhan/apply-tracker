// Client-side profile exporters — Markdown, Word (.docx), and PDF. Follows the
// same pattern as lib/exporters.ts: dynamically import the heavy libs in the
// browser, build a Blob, trigger a download. No server round-trip.

export type ProfileData = {
    personal: {
      firstName?: string | null; lastName?: string | null;
      email?: string | null; contactEmail?: string | null;
      age?: number | null; phone?: string | null; location?: string | null;
    };
    work: { title: string; company: string; workMode?: string; country?: string | null; city?: string | null; startDate?: string | null; endDate?: string | null; current?: boolean; description?: string | null }[];
    education: { degree: string; major?: string | null; institution: string; country?: string | null; city?: string | null; startDate?: string | null; endDate?: string | null; current?: boolean }[];
    languages: { name: string; level: string }[];
    certifications: { name: string; issuer?: string | null; year?: string | null }[];
  };
  
  function fullName(p: ProfileData["personal"]): string {
    return [p.firstName, p.lastName].filter(Boolean).join(" ") || "My Profile";
  }
  function place(country?: string | null, city?: string | null, mode?: string): string {
    const parts = [city, country].filter(Boolean);
    const loc = parts.join(", ");
    const m = mode === "remote" ? "Remote" : mode === "hybrid" ? "Hybrid" : "";
    return [loc, m].filter(Boolean).join(" · ");
  }
  function dates(start?: string | null, end?: string | null, current?: boolean): string {
    const e = current ? "Present" : end || "";
    return [start || "", e].filter(Boolean).join(" – ");
  }
  
  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  // ── Markdown ─────────────────────────────────────────────────────────────────
  export function buildMarkdown(d: ProfileData): string {
    const p = d.personal;
    const lines: string[] = [];
    lines.push(`# ${fullName(p)}`);
    const contact = [
      p.email, p.contactEmail && p.contactEmail !== p.email ? p.contactEmail : null,
      p.phone, p.location,
    ].filter(Boolean);
    if (contact.length) lines.push("", contact.join(" · "));
  
    if (d.work.length) {
      lines.push("", "## Work Experience");
      for (const w of d.work) {
        lines.push("", `### ${w.title} — ${w.company}`);
        const meta = [place(w.country, w.city, w.workMode), dates(w.startDate, w.endDate, w.current)].filter(Boolean).join(" | ");
        if (meta) lines.push(`*${meta}*`);
        if (w.description) lines.push("", w.description);
      }
    }
    if (d.education.length) {
      lines.push("", "## Education");
      for (const e of d.education) {
        const deg = [e.degree, e.major].filter(Boolean).join(" — ");
        lines.push("", `### ${deg}`);
        const meta = [e.institution, place(e.country, e.city), dates(e.startDate, e.endDate, e.current)].filter(Boolean).join(" | ");
        if (meta) lines.push(`*${meta}*`);
      }
    }
    if (d.languages.length) {
      lines.push("", "## Languages", "");
      lines.push(d.languages.map((l) => `${l.name} (${l.level})`).join(", "));
    }
    if (d.certifications.length) {
      lines.push("", "## Certifications");
      for (const c of d.certifications) {
        lines.push(`- ${[c.name, c.issuer, c.year].filter(Boolean).join(" · ")}`);
      }
    }
    return lines.join("\n");
  }
  
  export function exportMarkdown(d: ProfileData) {
    download(new Blob([buildMarkdown(d)], { type: "text/markdown" }), `${fullName(d.personal).replace(/\s+/g, "_")}_profile.md`);
  }
  
  // ── PDF ──────────────────────────────────────────────────────────────────────
  export async function exportPdf(d: ProfileData) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const M = 48;                 // margin
    const W = doc.internal.pageSize.getWidth();
    let y = M;
    const p = d.personal;
  
    const line = (text: string, size: number, bold: boolean, gap = 4, color = "#111111") => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(color);
      const wrapped = doc.splitTextToSize(text, W - M * 2) as string[];
      for (const ln of wrapped) {
        if (y > doc.internal.pageSize.getHeight() - M) { doc.addPage(); y = M; }
        doc.text(ln, M, y);
        y += size + gap;
      }
    };
    const heading = (t: string) => { y += 8; line(t, 13, true, 6, "#3b3b7a"); };
  
    line(fullName(p), 20, true, 6);
    const contact = [p.email, p.phone, p.location].filter(Boolean).join("  ·  ");
    if (contact) line(contact, 10, false, 10, "#555555");
  
    if (d.work.length) {
      heading("Work Experience");
      for (const w of d.work) {
        line(`${w.title} — ${w.company}`, 11, true, 2);
        const meta = [place(w.country, w.city, w.workMode), dates(w.startDate, w.endDate, w.current)].filter(Boolean).join("  |  ");
        if (meta) line(meta, 9, false, 3, "#666666");
        if (w.description) line(w.description, 10, false, 8, "#333333");
      }
    }
    if (d.education.length) {
      heading("Education");
      for (const e of d.education) {
        line([e.degree, e.major].filter(Boolean).join(" — "), 11, true, 2);
        const meta = [e.institution, place(e.country, e.city), dates(e.startDate, e.endDate, e.current)].filter(Boolean).join("  |  ");
        if (meta) line(meta, 9, false, 8, "#666666");
      }
    }
    if (d.languages.length) {
      heading("Languages");
      line(d.languages.map((l) => `${l.name} (${l.level})`).join(",  "), 10, false, 8, "#333333");
    }
    if (d.certifications.length) {
      heading("Certifications");
      for (const c of d.certifications) line(`• ${[c.name, c.issuer, c.year].filter(Boolean).join(" · ")}`, 10, false, 3, "#333333");
    }
  
    doc.save(`${fullName(p).replace(/\s+/g, "_")}_profile.pdf`);
  }
  
  // ── Word (.docx) ─────────────────────────────────────────────────────────────
  export async function exportDocx(d: ProfileData) {
    const docx = await import("docx");
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
    const p = d.personal;
    const kids: InstanceType<typeof Paragraph>[] = [];
  
    kids.push(new Paragraph({ children: [new TextRun({ text: fullName(p), bold: true, size: 40 })] }));
    const contact = [p.email, p.phone, p.location].filter(Boolean).join("  ·  ");
    if (contact) kids.push(new Paragraph({ children: [new TextRun({ text: contact, color: "555555", size: 20 })] }));
  
    const H = (t: string) => kids.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 }, children: [new TextRun({ text: t })] }));
    const meta = (t: string) => kids.push(new Paragraph({ children: [new TextRun({ text: t, italics: true, color: "666666", size: 18 })] }));
  
    if (d.work.length) {
      H("Work Experience");
      for (const w of d.work) {
        kids.push(new Paragraph({ children: [new TextRun({ text: `${w.title} — ${w.company}`, bold: true, size: 24 })] }));
        const m = [place(w.country, w.city, w.workMode), dates(w.startDate, w.endDate, w.current)].filter(Boolean).join("  |  ");
        if (m) meta(m);
        if (w.description) kids.push(new Paragraph({ children: [new TextRun({ text: w.description, size: 20 })] }));
      }
    }
    if (d.education.length) {
      H("Education");
      for (const e of d.education) {
        kids.push(new Paragraph({ children: [new TextRun({ text: [e.degree, e.major].filter(Boolean).join(" — "), bold: true, size: 24 })] }));
        const m = [e.institution, place(e.country, e.city), dates(e.startDate, e.endDate, e.current)].filter(Boolean).join("  |  ");
        if (m) meta(m);
      }
    }
    if (d.languages.length) {
      H("Languages");
      kids.push(new Paragraph({ children: [new TextRun({ text: d.languages.map((l) => `${l.name} (${l.level})`).join(",  "), size: 20 })] }));
    }
    if (d.certifications.length) {
      H("Certifications");
      for (const c of d.certifications) kids.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: [c.name, c.issuer, c.year].filter(Boolean).join(" · "), size: 20 })] }));
    }
  
    const doc = new Document({ sections: [{ children: kids }] });
    const blob = await Packer.toBlob(doc);
    download(blob, `${fullName(p).replace(/\s+/g, "_")}_profile.docx`);
  }