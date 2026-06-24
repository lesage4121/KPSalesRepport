/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AuditSummary, StationReport } from "../types";
import { FilterState } from "../components/InteractiveFilters";

export const exportAuditToPDF = (summary: AuditSummary, reports: StationReport[], filters: FilterState) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(30, 41, 59); // slate-900
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("KP Sales Analyser", 15, 18);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("FINANCIAL AND ACCOUNTING AUDIT REPORT", 15, 26);
  
  // Date range info
  let dateRangeText = "Period: ";
  if (filters.startDate || filters.endDate) {
    dateRangeText += `${filters.startDate || "Start"} to ${filters.endDate || "End"}`;
  } else if (filters.dateStr !== "ALL") {
    dateRangeText += `${filters.dateStr} 2026`;
  } else {
    dateRangeText += "All dates";
  }
  doc.text(dateRangeText, 15, 32);
  doc.text(`Generated on: ${new Date().toLocaleString("en-US")}`, pageWidth - 15, 32, { align: "right" });

  // Summary Information
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Audit Summary", 15, 50);

  const summaryData = [
    ["Audited Reports", `${summary.totalSalesCount} active / ${summary.emptyReportsCount} empty`],
    ["Active Stations", summary.activeStationsCount.toString()],
    ["Detected Anomalies", summary.errorCount.toString()],
  ];

  autoTable(doc, {
    startY: 55,
    head: [["Indicator", "Value"]],
    body: summaryData,
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229] }, // indigo-600
    styles: { fontSize: 10 },
  });

  // Sales by Currency
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Sales by Currency", 15, (doc as any).lastAutoTable.finalY + 15);

  const currencyData = Object.entries(summary.totalSalesByCurrency).map(([cur, stats]: [string, any]) => [
    cur,
    stats.total.toLocaleString("en-US"),
    stats.refund.toLocaleString("en-US"),
    stats.netFare.toLocaleString("en-US"),
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [["Currency", "Total Sales", "Refunds", "Net Fare"]],
    body: currencyData,
    theme: "grid",
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 9 },
  });

  // Detailed Reports
  doc.addPage();
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Station Details and Anomalies", 15, 20);

  const reportData = reports.map(rep => {
    // Calculate total volume per station across all currencies
    const totalVolume = rep.currencyBlocks.reduce((acc, block) => acc + block.amountTotal, 0);
    // Get primary currency if available
    const primaryCurrency = rep.currencyBlocks.length > 0 ? rep.currencyBlocks[0].currency : "";

    return [
      rep.stationName,
      rep.dateStr,
      rep.cityName || "-",
      `${totalVolume.toLocaleString("en-US")} ${primaryCurrency}`,
      rep.isEmpty ? "Empty" : "Active",
      rep.hasErrors ? `${rep.errorMessages.length} Error(s)` : "OK"
    ];
  });

  autoTable(doc, {
    startY: 25,
    head: [["Station", "Date", "City", "Total Sales", "Status", "Audit"]],
    body: reportData,
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 8 },
    columnStyles: {
      5: { fontStyle: "bold" }
    },
    didParseCell: (data) => {
      if (data.column.index === 5 && data.cell.text[0].includes("Error")) {
        data.cell.styles.textColor = [220, 38, 38]; // rose-600
      }
    }
  });

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${totalPages} - KP Sales Analyser Confidential`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  doc.save(`Audit_Sales_${new Date().toISOString().split("T")[0]}.pdf`);
};
