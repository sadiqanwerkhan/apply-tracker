import { Row } from "@/lib/types";

export type ExportFormat = "pdf" | "excel" | "word";

const HEADERS = ["Company", "Role", "Status", "Applied", "Last Update", "Latest Subject"];

function toCells(r: Row): string[] {
  return [r.company, r.role || "", r.status, r.firstSeen, r.lastSeen, r.note || ""];
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportExcel(rows: Row[], filename: string) {
  const XLSX = await import("xlsx");
  const aoa = [HEADERS, ...rows.map(toCells)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 22 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 50 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Applications");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename + ".xlsx"
  );
}

async function exportPdf(rows: Row[], filename: string) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Job Applications", 14, 16);
  autoTable(doc, {
    head: [HEADERS],
    body: rows.map(toCells),
    startY: 22,
    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [79, 70, 229] },
    columnStyles: { 5: { cellWidth: 90 } },
  });
  doc.save(filename + ".pdf");
}

async function exportWord(rows: Row[], filename: string) {
  const docx = await import("docx");
  const { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType } = docx;

  const headerRow = new TableRow({
    children: HEADERS.map(
      (h) =>
        new TableCell({
          shading: { fill: "4F46E5" },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF" })] })],
        })
    ),
  });

  const bodyRows = rows.map(
    (r) =>
      new TableRow({
        children: toCells(r).map((c) => new TableCell({ children: [new Paragraph(c)] })),
      })
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun({ text: "Job Applications", bold: true, size: 28 })] }),
          new Paragraph(""),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  download(blob, filename + ".docx");
}

export async function runExport(format: ExportFormat, rows: Row[], filename: string) {
  if (format === "pdf") return exportPdf(rows, filename);
  if (format === "excel") return exportExcel(rows, filename);
  return exportWord(rows, filename);
}