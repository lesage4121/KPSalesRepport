
import * as XLSX from "xlsx";
import { AuditSummary, StationReport } from "../types";
import { FilterState } from "../components/InteractiveFilters";

/**
 * Common helper to download an Excel workbook
 */
const downloadWorkbook = (wb: XLSX.WorkBook, fileName: string) => {
  XLSX.writeFile(wb, fileName);
};

/**
 * Builds metadata rows for the top of sheets
 */
const buildMetadataRows = (title: string, filters: FilterState) => {
  return [
    [title],
    [`Généré le: ${new Date().toLocaleString("fr-FR")}`],
    [`Filtres appliqués: Date: ${filters.dateStr || "Toutes"}, Station: ${filters.stationNumber || "Toutes"}, Ville: ${filters.cityName || "Toutes"}, Devise: ${filters.currency || "Toutes"}`],
    [] // Empty spacer row
  ];
};

/**
 * Generates the data array for the Currency Summary sheet
 */
export const getSummarySheetData = (summary: AuditSummary) => {
  const headers = [
    "Devise",
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

  return [headers, ...rows];
};

/**
 * Generates the data array for the Detailed Station Reports sheet
 */
export const getDetailedReportsSheetData = (reports: StationReport[]) => {
  const headers = [
    "Nom Station",
    "Code Ville",
    "Ville",
    "Numéro Station",
    "Type",
    "Date",
    "Statut Clôture",
    "Heure Clôture",
    "Opérateur",
    "Type Fermeture",
    "Devise",
    "Volume Brut",
    "Tickets Électroniques (ET)",
    "Montant à Verser",
    "Montant HT",
    "Taxes Totales",
    "Commission",
    "Remboursement",
    "Anomalies Détectées",
    "Détails Anomalies"
  ];

  const rows: any[] = [];

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
      rows.push([
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
      ]);
    } else {
      report.currencyBlocks.forEach(block => {
        const etAmount = block.sales.filter(s => s.method === "ET").reduce((sum, s) => sum + s.totalAmount, 0);
        
        rows.push([
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
        ]);
      });
    }
  });

  return [headers, ...rows];
};

/**
 * Generates the data array for the Granular Transactions sheet
 */
export const getTransactionsSheetData = (reports: StationReport[]) => {
  const headers = [
    "Date",
    "Nom Station",
    "Code Ville",
    "Ville",
    "Numéro Station",
    "Devise",
    "Mode de Paiement",
    "Description Mode",
    "Remboursement",
    "Montant Brut",
    "Montant à Verser"
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

  const rows: any[] = [];

  reports.forEach(report => {
    if (report.isEmpty) return;

    report.currencyBlocks.forEach(block => {
      block.sales.forEach(row => {
        const isET = row.method === "ET";
        const netToPay = isET ? 0 : row.totalAmount;

        rows.push([
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
        ]);
      });
    });
  });

  return [headers, ...rows];
};

/**
 * Exports a single unified multi-sheet Excel file (.xlsx) containing all aspects of the audit
 */
export const exportAllToMultiSheetExcel = (summary: AuditSummary, reports: StationReport[], filters: FilterState) => {
  const wb = XLSX.utils.book_new();

  // 1. Sheet 1: Synthèse par Devise
  const summaryMeta = buildMetadataRows("SYNTHÈSE FINANCIÈRE PAR DEVISE", filters);
  const summaryData = getSummarySheetData(summary);
  const wsSummary = XLSX.utils.aoa_to_sheet([...summaryMeta, ...summaryData]);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Synthèse Devises");

  // 2. Sheet 2: Rapports des Stations
  const reportsMeta = buildMetadataRows("RAPPORT D'AUDIT DÉTAILLÉ DES STATIONS", filters);
  const reportsData = getDetailedReportsSheetData(reports);
  const wsReports = XLSX.utils.aoa_to_sheet([...reportsMeta, ...reportsData]);
  XLSX.utils.book_append_sheet(wb, wsReports, "Rapports Stations");

  // 3. Sheet 3: Journal des Transactions
  const transMeta = buildMetadataRows("JOURNAL DÉTAILLÉ DES TRANSACTIONS PAR MODE DE PAIEMENT", filters);
  const transData = getTransactionsSheetData(reports);
  const wsTransactions = XLSX.utils.aoa_to_sheet([...transMeta, ...transData]);
  XLSX.utils.book_append_sheet(wb, wsTransactions, "Transactions Journalières");

  // Auto-fit column widths for better Excel legibility
  [wsSummary, wsReports, wsTransactions].forEach(ws => {
    if (!ws["!ref"]) return;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const colWidths = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxLen = 10;
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell && cell.v) {
          const valStr = String(cell.v);
          if (valStr.length > maxLen) {
            maxLen = valStr.length;
          }
        }
      }
      colWidths.push({ wch: Math.min(maxLen + 2, 40) }); // cap at 40 chars
    }
    ws["!cols"] = colWidths;
  });

  const today = new Date().toISOString().split("T")[0];
  downloadWorkbook(wb, `Audit_Rapport_Complet_${today}.xlsx`);
};

/**
 * Export only the currency summary sheet to Excel
 */
export const exportSummaryToExcel = (summary: AuditSummary, filters: FilterState) => {
  const wb = XLSX.utils.book_new();
  const meta = buildMetadataRows("SYNTHÈSE FINANCIÈRE PAR DEVISE", filters);
  const data = getSummarySheetData(summary);
  const ws = XLSX.utils.aoa_to_sheet([...meta, ...data]);
  
  XLSX.utils.book_append_sheet(wb, ws, "Synthèse");
  const today = new Date().toISOString().split("T")[0];
  downloadWorkbook(wb, `Audit_Synthèse_Devises_${today}.xlsx`);
};

/**
 * Export only the detailed station reports sheet to Excel
 */
export const exportDetailedReportsToExcel = (reports: StationReport[], filters: FilterState) => {
  const wb = XLSX.utils.book_new();
  const meta = buildMetadataRows("RAPPORT D'AUDIT DÉTAILLÉ DES STATIONS", filters);
  const data = getDetailedReportsSheetData(reports);
  const ws = XLSX.utils.aoa_to_sheet([...meta, ...data]);
  
  XLSX.utils.book_append_sheet(wb, ws, "Détails Stations");
  const today = new Date().toISOString().split("T")[0];
  downloadWorkbook(wb, `Audit_Rapports_Détails_${today}.xlsx`);
};

/**
 * Export only the daily payment transactions journal sheet to Excel
 */
export const exportTransactionsToExcel = (reports: StationReport[], filters: FilterState) => {
  const wb = XLSX.utils.book_new();
  const meta = buildMetadataRows("JOURNAL DÉTAILLÉ DES TRANSACTIONS PAR MODE DE PAIEMENT", filters);
  const data = getTransactionsSheetData(reports);
  const ws = XLSX.utils.aoa_to_sheet([...meta, ...data]);
  
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  const today = new Date().toISOString().split("T")[0];
  downloadWorkbook(wb, `Audit_Transactions_Journalières_${today}.xlsx`);
};
