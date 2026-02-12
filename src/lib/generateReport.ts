import jsPDF from "jspdf";
import type { ScanAnalysis } from "@/types/scan";

export function generateReport(result: ScanAnalysis, imageDataUrl?: string) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentW = pw - margin * 2;

  // Header bar
  doc.setFillColor(23, 92, 211);
  doc.rect(0, 0, pw, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("BoneScan AI — Diagnostic Report", margin, 16);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Report ID: ${crypto.randomUUID().slice(0, 8).toUpperCase()}  |  Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, margin, 28);

  let y = 48;

  // Scan image
  if (imageDataUrl) {
    try {
      doc.addImage(imageDataUrl, "JPEG", margin, y, 55, 55);
    } catch { /* skip */ }

    // Diagnosis summary next to image
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(result.condition, margin + 62, y + 8);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Severity: ${result.severity}`, margin + 62, y + 18);
    doc.text(`Urgency: ${result.urgency}`, margin + 62, y + 26);
    doc.text(`Region: ${result.affectedRegion}`, margin + 62, y + 34);

    y += 65;
  } else {
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(result.condition, margin, y);
    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Severity: ${result.severity}  |  Urgency: ${result.urgency}  |  Region: ${result.affectedRegion}`, margin, y);
    y += 14;
  }

  // Separator
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pw - margin, y);
  y += 10;

  const sections = [
    { title: "Clinical Findings", body: result.findings },
    { title: "Suggested Medication", body: result.medication },
    { title: "Recommended Specialist", body: result.doctorType },
    { title: "Additional Notes", body: result.additionalNotes },
  ];

  for (const s of sections) {
    if (!s.body) continue;

    if (y > 260) { doc.addPage(); y = 20; }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(23, 92, 211);
    doc.text(s.title.toUpperCase(), margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(s.body, contentW);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 8;
  }

  // Disclaimer footer
  y = Math.max(y + 8, 250);
  if (y > 270) { doc.addPage(); y = 20; }
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pw - margin, y);
  y += 6;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  const disc = "DISCLAIMER: This report is AI-generated and for informational purposes only. It does not constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical decisions.";
  doc.text(doc.splitTextToSize(disc, contentW), margin, y);

  doc.save("BoneScan-AI-Report.pdf");
}
