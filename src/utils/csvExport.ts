/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuditSummary, StationReport, CurrencyBlock } from "../types";
import { FilterState } from "../components/InteractiveFilters";

/**
 * Helper to escape CSV cell values and wrap in quotes if necessary
 */
const escapeCSV = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  // If value contains quotes, commas, or newlines, escape it
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Downloads a string content as a CSV file in the browser
 */
const downloadCSVFile = (csvContent: string, fileName: string) => {
  // Use BOM (Byte Order Mark) to force Excel to open it correctly as UTF-8
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Exports the Currencies Aggregated Financial Summary to CSV
 */
export const exportSummaryToCSV = (summary: AuditSummary, filters: FilterState) => {
  const headers = [
    "Devise (Currency)",
    "Montant à Verser (To Be Remitted / Accounting Total)",
    "Montant HT (Net Fare HT)",
    "Commission Agence (Commission)",
    "Remboursements (Refunds)"
  ];

  const rows = Object.entries(summary.totalSalesByCurrency).map(([currency, stats]) => [
    currency,
    stats.accountingTotal,
    stats.netFareHT,
    stats.commission,
    stats.refund
  ]);

  const csvRows = [
    ["# RAPPORT DES VENTES SYNTHÉTIQUE PAR DEVISE"],
    [`# Généré le: ${new Date().toLocaleString("fr-FR")}`],
    [`# Filtres appliqués: Date: ${filters.dateStr || "Toutes"}, Station: ${filters.stationNumber || "Toutes"}, Ville: ${filters.cityName || "Toutes"}, Devise: ${filters.currency || "Toutes"}`],
    [],
    headers
  ];

  rows.forEach(row => {
    csvRows.push(row.map(cell => escapeCSV(cell)) as any);
  });

  const csvContent = csvRows.map(r => r.join(",")).join("\n");
  const today = new Date().toISOString().split("T")[0];
  downloadCSVFile(csvContent, `Audit_Synthese_Devises_${today}.csv`);
};

/**
 * Exports detailed Station Reports with financial calculations to CSV
 */
export const exportDetailedReportsToCSV = (reports: StationReport[], filters: FilterState) => {
  const headers = [
    "Nom Station (Station Name)",
    "Code Ville (City Code)",
    "Ville (City Name)",
    "Numéro Station (Station Number)",
    "Type",
    "Date",
    "Statut Clôture (Status)",
    "Heure Clôture (Closure Time)",
    "Opérateur (Operator)",
    "Type Fermeture (Auto-Closed)",
    "Devise (Currency)",
    "Volume Brut (Gross Volume)",
    "Tickets Électroniques (ET)",
    "Montant à Verser (To Be Remitted)",
    "Montant HT (Net Fare HT)",
    "Taxes Totales (Total Taxes)",
    "Commission (Commission)",
    "Remboursement (Refund)",
    "Anomalies Détectées (Has Errors)",
    "Détails Anomalies (Error Messages)"
  ];

  const csvRows = [
    ["# RAPPORT D'AUDIT DÉTAILLÉ DES STATIONS"],
    [`# Généré le: ${new Date().toLocaleString("fr-FR")}`],
    [`# Filtres appliqués: Date: ${filters.dateStr || "Toutes"}, Station: ${filters.stationNumber || "Toutes"}, Ville: ${filters.cityName || "Toutes"}, Devise: ${filters.currency || "Toutes"}`],
    [],
    headers
  ];

  reports.forEach(report => {
    const commonFields = [
      report.stationName,
      report.cityCode,
      report.cityName,
      report.stationNumber,
      report.stationType,
      report.dateStr,
      report.status,
      report.closure?.time || "-",
      report.closure?.operator || "-",
      report.closure?.isAutoClosed ? "Auto" : "Manuel",
    ];

    if (report.isEmpty || report.currencyBlocks.length === 0) {
      // Add empty row for reports with no currencies
      const row = [
        ...commonFields,
        "-", // Currency
        0,   // Gross Volume
        0,   // ET
        0,   // To Be Remitted
        0,   // Net HT
        0,   // Taxes
        0,   // Commission
        0,   // Refund
        report.hasErrors ? "Oui" : "Non",
        report.errorMessages.join(" | ")
      ];
      csvRows.push(row.map(cell => escapeCSV(cell)) as any);
    } else {
      // Add a line for each currency block in the report to ensure clean data analysis
      report.currencyBlocks.forEach(block => {
        const etAmount = block.sales.filter(s => s.method === "ET").reduce((sum, s) => sum + s.totalAmount, 0);
        
        const row = [
          ...commonFields,
          block.currency,
          block.amountTotal,
          etAmount,
          block.accountingTotal,
          block.netFareHT,
          block.taxTotal,
          block.commission,
          block.refundTotal,
          report.hasErrors ? "Oui" : "Non",
          report.errorMessages.join(" | ")
        ];
        csvRows.push(row.map(cell => escapeCSV(cell)) as any);
      });
    }
  });

  const csvContent = csvRows.map(r => r.join(",")).join("\n");
  const today = new Date().toISOString().split("T")[0];
  downloadCSVFile(csvContent, `Audit_Rapports_Details_${today}.csv`);
};

/**
 * Exports granular daily transaction details (modes of payment) for deep analysis
 */
export const exportTransactionsToCSV = (reports: StationReport[], filters: FilterState) => {
  const headers = [
    "Date",
    "Nom Station (Station Name)",
    "Code Ville (City Code)",
    "Ville (City Name)",
    "Numéro Station (Station Number)",
    "Devise (Currency)",
    "Mode de Paiement (Payment Mode)",
    "Description Mode",
    "Remboursement (Refund)",
    "Montant Brut (Gross Amount)",
    "Montant à Verser (Net to Pay / Remitted)"
  ];

  const csvRows = [
    ["# RELEVÉ DÉTAILLÉ DES TRANSACTIONS PAR MODE DE PAIEMENT"],
    [`# Généré le: ${new Date().toLocaleString("fr-FR")}`],
    [`# Filtres appliqués: Date: ${filters.dateStr || "Toutes"}, Station: ${filters.stationNumber || "Toutes"}, Ville: ${filters.cityName || "Toutes"}, Devise: ${filters.currency || "Toutes"}`],
    [],
    headers
  ];

  const getMethodLabel = (method: string) => {
    switch (method) {
      case "CA": return "Espèces (Cash)";
      case "CK": return "Chèque (Cheque)";
      case "ET": return "Billet Électronique / Carte (ET)";
      case "IN": return "Facturation Directe (Direct Invoicing)";
      default: return `Autre (${method})`;
    }
  };

  reports.forEach(report => {
    if (report.isEmpty) return;

    report.currencyBlocks.forEach(block => {
      block.sales.forEach(row => {
        const isET = row.method === "ET";
        const netToPay = isET ? 0 : row.totalAmount;

        const csvRow = [
          report.dateStr,
          report.stationName,
          report.cityCode,
          report.cityName,
          report.stationNumber,
          block.currency,
          row.method,
          getMethodLabel(row.method),
          row.refund,
          row.totalAmount,
          netToPay
        ];
        csvRows.push(csvRow.map(cell => escapeCSV(cell)) as any);
      });
    });
  });

  const csvContent = csvRows.map(r => r.join(",")).join("\n");
  const today = new Date().toISOString().split("T")[0];
  downloadCSVFile(csvContent, `Audit_Transactions_Journalieres_${today}.csv`);
};
