/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { ManifestFlight, TransportedPassengerReport } from "../types";
import { FlightEvolutionPoint, FlightKeySummary } from "./manifestDb";
import { getFlightWebCheckinCount, normalizeDcsFlightDate } from "./manifestParser";
import { sanitizePdfText } from "./emdPdfExport";

function sanitizeTableRow(row: unknown[]): unknown[] {
  return row.map((cell) => {
    if (typeof cell === "string") return sanitizePdfText(cell);
    if (cell && typeof cell === "object" && "content" in cell) {
      const c = cell as Record<string, unknown>;
      return {
        ...c,
        content:
          typeof c.content === "string" || typeof c.content === "number"
            ? sanitizePdfText(c.content)
            : c.content,
      };
    }
    return cell;
  });
}

function pdfAutoTable(doc: jsPDF, options: Parameters<typeof autoTable>[1]) {
  const sanitizedOptions = { ...options };
  if (Array.isArray(options.head)) {
    sanitizedOptions.head = options.head.map((row) =>
      Array.isArray(row) ? sanitizeTableRow(row) : row
    ) as typeof options.head;
  }
  if (Array.isArray(options.body)) {
    sanitizedOptions.body = options.body.map((row) =>
      Array.isArray(row) ? sanitizeTableRow(row) : row
    ) as typeof options.body;
  }
  if (Array.isArray(options.foot)) {
    sanitizedOptions.foot = options.foot.map((row) =>
      Array.isArray(row) ? sanitizeTableRow(row) : row
    ) as typeof options.foot;
  }
  return autoTable(doc, sanitizedOptions);
}

export interface DailyOperationsStatRow {
  dateKey: string;
  flightsCount: number;
  totalPassengers: number;
  rawPassengersCount: number;
  deduplicatedCount: number;
  economy: number;
  business: number;
  ecoShare: number;
  bizShare: number;
  male: number;
  female: number;
  child: number;
  infant: number;
  unknownGender: number;
  bagsCount: number;
  totalWeight: number;
  uncoveredDeviations: number;
  webCheckin?: number;
}

export interface ManifestOverviewDateGroupExport {
  date: string;
  flights: ManifestFlight[];
  totalPax: number;
  totalBags: number;
  totalWeight: number;
  totalUncovered: number;
  transported: TransportedPassengerReport;
}

const escapeCSV = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (/[",;\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const downloadCSV = (rows: (string | number)[][], filename: string) => {
  const csvContent = rows
    .map((row) => row.map((cell) => escapeCSV(cell)).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const todayIso = () => new Date().toISOString().split("T")[0];

function drawAskyPdfHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  generatedLabel: string
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  // Dark chocolate ASKY banner
  doc.setFillColor(50, 27, 10); // #321B0A
  doc.rect(0, 0, pageWidth, 34, "F");

  // Gold accent bar
  doc.setFillColor(232, 156, 29); // #E89C1D
  doc.rect(0, 34, pageWidth, 2, "F");

  doc.setTextColor(247, 186, 66); // #F7BA42
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ASKY AIRLINES - OPERATIONS & MANIFESTES", 14, 14);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(sanitizePdfText(title), 14, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(243, 233, 216); // #F3E9D8
  doc.text(sanitizePdfText(subtitle), 14, 29);
  doc.text(sanitizePdfText(generatedLabel), pageWidth - 14, 29, {
    align: "right",
  });
}

function addPdfPageFooters(doc: jsPDF, footerText: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 90, 65);
    doc.text(
      sanitizePdfText(`${footerText} | Page ${i} / ${totalPages}`),
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
  }
}

/* -------------------------------------------------------------------------- */
/* 1. Daily Operations Cabin Volume & Passenger Stats (Chart / Daily View)    */
/* -------------------------------------------------------------------------- */

export function exportDailyOperationsStatsToCSV(
  days: DailyOperationsStatRow[],
  language: "fr" | "en" = "fr"
) {
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "fr-FR";

  const totals = days.reduce(
    (acc, d) => {
      acc.flights += d.flightsCount;
      acc.transported += d.totalPassengers;
      acc.raw += d.rawPassengersCount;
      acc.dedup += d.deduplicatedCount;
      acc.eco += d.economy;
      acc.biz += d.business;
      acc.male += d.male;
      acc.female += d.female;
      acc.child += d.child;
      acc.infant += d.infant;
      acc.unknown += d.unknownGender;
      acc.bags += d.bagsCount;
      acc.weight += d.totalWeight;
      acc.uncovered += d.uncoveredDeviations;
      acc.webCheckin += d.webCheckin ?? 0;
      return acc;
    },
    {
      flights: 0,
      transported: 0,
      raw: 0,
      dedup: 0,
      eco: 0,
      biz: 0,
      male: 0,
      female: 0,
      child: 0,
      infant: 0,
      unknown: 0,
      bags: 0,
      weight: 0,
      uncovered: 0,
      webCheckin: 0,
    }
  );

  const totalCab = totals.eco + totals.biz;
  const totalEcoShare = totalCab > 0 ? ((totals.eco / totalCab) * 100).toFixed(1) : "0.0";
  const totalBizShare = totalCab > 0 ? ((totals.biz / totalCab) * 100).toFixed(1) : "0.0";
  const totalWbShare =
    totals.transported > 0
      ? ((totals.webCheckin / totals.transported) * 100).toFixed(1)
      : "0.0";

  const rows: (string | number)[][] = [
    [
      isEn
        ? "# ASKY DAILY FLIGHT OPERATIONS & PASSENGER STATISTICS REPORT"
        : "# ASKY - RAPPORT STATISTIQUES QUOTIDIENNES DES VOLS & PASSAGERS",
    ],
    [
      isEn
        ? `# Generated on: ${new Date().toLocaleString(locale)}`
        : `# Généré le : ${new Date().toLocaleString(locale)}`,
    ],
    [],
    isEn
      ? [
          "Date",
          "Segments/Flights",
          "Transported Pax",
          "Web Check-in (WB)",
          "WB %",
          "Eco (Y)",
          "Eco %",
          "Business (C)",
          "Business %",
          "Men (M)",
          "Women (F)",
          "Children (CHD)",
          "Infants (INF)",
          "Unknown Gender",
          "Baggage (pcs)",
          "Total Weight (kg)",
          "Uncovered Deviations",
        ]
      : [
          "Date",
          "Tronçons / Vols",
          "Passagers Transportés",
          "Check-in Web (WB)",
          "Taux WB (%)",
          "Éco (Y)",
          "Part Éco (%)",
          "Business (C)",
          "Part Business (%)",
          "Hommes (M)",
          "Femmes (F)",
          "Enfants (CHD)",
          "Bébés (INF)",
          "Genre N/D",
          "Bagages (pcs)",
          "Poids Total (kg)",
          "Écarts Sans EMD",
        ],
    ...days.map((d) => {
      const wb = d.webCheckin ?? 0;
      const wbPct =
        d.totalPassengers > 0 ? ((wb / d.totalPassengers) * 100).toFixed(1) : "0.0";
      return [
        d.dateKey,
        d.flightsCount,
        d.totalPassengers,
        wb,
        `${wbPct}%`,
        d.economy,
        `${d.ecoShare}%`,
        d.business,
        `${d.bizShare}%`,
        d.male,
        d.female,
        d.child,
        d.infant,
        d.unknownGender,
        d.bagsCount,
        d.totalWeight,
        d.uncoveredDeviations,
      ];
    }),
    [],
    [
      isEn ? "TOTAL" : "TOTAL GÉNÉRAL",
      totals.flights,
      totals.transported,
      totals.webCheckin,
      `${totalWbShare}%`,
      totals.eco,
      `${totalEcoShare}%`,
      totals.biz,
      `${totalBizShare}%`,
      totals.male,
      totals.female,
      totals.child,
      totals.infant,
      totals.unknown,
      totals.bags,
      totals.weight,
      totals.uncovered,
    ],
  ];

  downloadCSV(
    rows,
    `${isEn ? "ASKY_Daily_Stats_Report" : "ASKY_Rapport_Stats_Quotidiennes"}_${todayIso()}.csv`
  );
}

export function exportDailyOperationsStatsToPDF(
  days: DailyOperationsStatRow[],
  language: "fr" | "en" = "fr"
) {
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "fr-FR";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  drawAskyPdfHeader(
    doc,
    isEn
      ? "Daily Flight Operations Statistics Report (Eco vs Business)"
      : "Rapport Quotidien des Statistiques de Vols (Eco vs Business)",
    isEn
      ? "Daily passenger volume breakdown by cabin and category"
      : "Répartition quotidienne des passagers transportés par cabine et catégorie",
    `${isEn ? "Generated" : "Généré le"}: ${new Date().toLocaleString(locale)}`
  );

  const totals = days.reduce(
    (acc, d) => {
      acc.flights += d.flightsCount;
      acc.transported += d.totalPassengers;
      acc.raw += d.rawPassengersCount;
      acc.dedup += d.deduplicatedCount;
      acc.eco += d.economy;
      acc.biz += d.business;
      acc.male += d.male;
      acc.female += d.female;
      acc.child += d.child;
      acc.infant += d.infant;
      acc.bags += d.bagsCount;
      acc.weight += d.totalWeight;
      acc.uncovered += d.uncoveredDeviations;
      acc.webCheckin += d.webCheckin ?? 0;
      return acc;
    },
    {
      flights: 0,
      transported: 0,
      raw: 0,
      dedup: 0,
      eco: 0,
      biz: 0,
      male: 0,
      female: 0,
      child: 0,
      infant: 0,
      bags: 0,
      weight: 0,
      uncovered: 0,
      webCheckin: 0,
    }
  );

  const totalCab = totals.eco + totals.biz;
  const ecoPct = totalCab > 0 ? ((totals.eco / totalCab) * 100).toFixed(1) : "0.0";
  const bizPct = totalCab > 0 ? ((totals.biz / totalCab) * 100).toFixed(1) : "0.0";
  const wbPct =
    totals.transported > 0
      ? ((totals.webCheckin / totals.transported) * 100).toFixed(1)
      : "0.0";

  // KPI Summary table
  pdfAutoTable(doc, {
    startY: 42,
    head: [
      isEn
        ? [
            "Tracked Days",
            "Segments",
            "Transported Pax",
            "Web Check-in (WB)",
            "Eco (Y)",
            "Business (C)",
            "Men / Women",
            "CHD / INF",
            "Baggage / Weight",
          ]
        : [
            "Jours Suivis",
            "Tronçons",
            "Pax Transportés",
            "Check-in Web (WB)",
            "Éco (Y)",
            "Business (C)",
            "Hommes / Femmes",
            "CHD / INF",
            "Bagages / Poids",
          ],
    ],
    body: [
      [
        days.length.toString(),
        totals.flights.toString(),
        totals.transported.toLocaleString(locale),
        `${totals.webCheckin.toLocaleString(locale)} (${wbPct}%)`,
        `${totals.eco.toLocaleString(locale)} (${ecoPct}%)`,
        `${totals.biz.toLocaleString(locale)} (${bizPct}%)`,
        `${totals.male} M / ${totals.female} F`,
        `${totals.child} CHD / ${totals.infant} INF`,
        `${totals.bags.toLocaleString(locale)} pcs | ${totals.weight.toLocaleString(locale)} kg`,
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [76, 40, 18], // #4C2812
      textColor: [247, 186, 66], // #F7BA42
      fontStyle: "bold",
      fontSize: 8.5,
    },
    styles: { fontSize: 8.5, halign: "center" },
  });

  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } })
    .lastAutoTable?.finalY;

  pdfAutoTable(doc, {
    startY: (lastY || 62) + 6,
    head: [
      isEn
        ? [
            "Date",
            "Flights",
            "Transp.",
            "WB (Rate)",
            "Eco (Y)",
            "Eco %",
            "Biz (C)",
            "Biz %",
            "Men",
            "Women",
            "CHD",
            "INF",
            "Bags",
            "Weight (kg)",
            "Uncov.",
          ]
        : [
            "Date",
            "Vols",
            "Transp.",
            "WB (Taux)",
            "Éco (Y)",
            "Éco %",
            "Biz (C)",
            "Biz %",
            "Hommes",
            "Femmes",
            "CHD",
            "INF",
            "Bagages",
            "Poids (kg)",
            "Écarts",
          ],
    ],
    body: [
      ...days.map((d) => {
        const dWb = d.webCheckin ?? 0;
        const dWbPct =
          d.totalPassengers > 0 ? ((dWb / d.totalPassengers) * 100).toFixed(1) : "0.0";
        return [
          d.dateKey,
          d.flightsCount,
          d.totalPassengers,
          `${dWb} (${dWbPct}%)`,
          d.economy,
          `${d.ecoShare}%`,
          d.business,
          `${d.bizShare}%`,
          d.male,
          d.female,
          d.child,
          d.infant,
          d.bagsCount,
          d.totalWeight.toLocaleString(locale),
          d.uncoveredDeviations,
        ];
      }),
      [
        "TOTAL",
        totals.flights,
        totals.transported,
        `${totals.webCheckin} (${wbPct}%)`,
        totals.eco,
        `${ecoPct}%`,
        totals.biz,
        `${bizPct}%`,
        totals.male,
        totals.female,
        totals.child,
        totals.infant,
        totals.bags,
        totals.weight.toLocaleString(locale),
        totals.uncovered,
      ],
    ],
    theme: "striped",
    headStyles: {
      fillColor: [50, 27, 10],
      textColor: [247, 186, 66],
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: { fontSize: 8, cellPadding: 2 },
    didParseCell: (data) => {
      if (data.row.index === days.length) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [253, 244, 227]; // #FDF4E3
        data.cell.styles.textColor = [50, 27, 10];
      }
    },
  });

  addPdfPageFooters(
    doc,
    isEn
      ? "ASKY Daily Flight Operations Report"
      : "ASKY - Reporting Quotidien des Opérations de Vol"
  );

  doc.save(
    `${isEn ? "ASKY_Daily_Stats_Report" : "ASKY_Rapport_Stats_Quotidiennes"}_${todayIso()}.pdf`
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Manifest Overview Report (Date Groups + Filtered Flights Table)         */
/* -------------------------------------------------------------------------- */

export function exportManifestOverviewReportToCSV(
  dateGroups: ManifestOverviewDateGroupExport[],
  flights: ManifestFlight[],
  language: "fr" | "en" = "fr"
) {
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "fr-FR";

  const rows: (string | number)[][] = [
    [
      isEn
        ? "# ASKY FLIGHT MANIFESTS STATISTICAL REPORT"
        : "# ASKY - RAPPORT STATISTIQUE DES MANIFESTES DE VOLS",
    ],
    [
      isEn
        ? `# Generated on: ${new Date().toLocaleString(locale)} | Scope: Traveled passengers only (with assigned seat)`
        : `# Généré le : ${new Date().toLocaleString(locale)} | Périmètre : Passagers ayant voyagé uniquement (avec siège attribué)`,
    ],
    [],
    [
      isEn
        ? "SECTION 1: DAILY TRANSPORTED PASSENGER SUMMARY"
        : "SECTION 1 : SYNTHÈSE QUOTIDIENNE DES PASSAGERS TRANSPORTÉS",
    ],
    isEn
      ? [
          "Departure Date",
          "Flights Count",
          "Transported Pax",
          "Web Check-in (WB)",
          "WB %",
          "Eco (Y)",
          "Business (C)",
          "Men (M)",
          "Women (F)",
          "Children (CHD)",
          "Infants (INF)",
          "Baggage (pcs)",
          "Weight (kg)",
          "Uncovered Deviations",
        ]
      : [
          "Date Départ",
          "Nb Vols",
          "Pax Transportés",
          "Check-in Web (WB)",
          "Taux WB (%)",
          "Éco (Y)",
          "Business (C)",
          "Hommes (M)",
          "Femmes (F)",
          "Enfants (CHD)",
          "Bébés (INF)",
          "Bagages (pcs)",
          "Poids (kg)",
          "Écarts Sans EMD",
        ],
    ...dateGroups.map((g) => {
      const wbPct =
        g.transported.totalPassengers > 0
          ? ((g.transported.webCheckin / g.transported.totalPassengers) * 100).toFixed(1)
          : "0.0";
      return [
        g.date,
        g.flights.length,
        g.transported.totalPassengers,
        g.transported.webCheckin,
        `${wbPct}%`,
        g.transported.economy,
        g.transported.business,
        g.transported.male,
        g.transported.female,
        g.transported.child,
        g.transported.infant,
        g.totalBags,
        g.totalWeight,
        g.totalUncovered,
      ];
    }),
    [],
    [
      isEn
        ? "SECTION 2: FLIGHT SEGMENT DETAILS"
        : "SECTION 2 : DÉTAIL PAR TRONÇON DE VOL",
    ],
    isEn
      ? [
          "Date",
          "Flight",
          "Origin",
          "Primary Dest.",
          "Dep. Time",
          "Aircraft",
          "Config",
          "Total Pax",
          "Web Check-in (WB)",
          "Business (C)",
          "Eco (Y)",
          "Men (M)",
          "Women (F)",
          "Children (CHD)",
          "Infants (INF)",
          "Bags (pcs)",
          "Weight (kg)",
          "Uncovered Dev.",
          "Covered Dev.",
          "EMD",
          "FF / FQTV",
        ]
      : [
          "Date",
          "Vol",
          "Origine",
          "Dest. Principale",
          "Heure Dép.",
          "Appareil",
          "Composition",
          "Total Pax",
          "Check-in Web (WB)",
          "Business (C)",
          "Éco (Y)",
          "Hommes (M)",
          "Femmes (F)",
          "Enfants (CHD)",
          "Bébés (INF)",
          "Bagages (pcs)",
          "Poids (kg)",
          "Écarts Sans EMD",
          "Écarts Couverts",
          "EMD",
          "FF / FQTV",
        ],
    ...flights.map((f) => [
      normalizeDcsFlightDate(f.date),
      `${f.airline} ${f.flightNumber}`,
      f.origin,
      f.primaryDestination,
      f.departureTimeFormatted,
      f.aircraftType,
      f.configRaw || "-",
      f.grandTotals.passengersCount,
      getFlightWebCheckinCount(f),
      f.businessTotals.passengersCount,
      f.economyTotals.passengersCount,
      f.grandTotals.male,
      f.grandTotals.female,
      f.grandTotals.child,
      f.grandTotals.infant,
      f.grandTotals.bagsCount,
      f.grandTotals.totalWeight,
      f.baggageUncoveredDeviationsCount,
      f.baggageCoveredDeviationsCount,
      f.emdCount,
      f.ffCount + f.fqtvCount,
    ]),
  ];

  downloadCSV(
    rows,
    `${isEn ? "ASKY_Manifests_Stats_Report" : "ASKY_Rapport_Manifestes_Stats"}_${todayIso()}.csv`
  );
}

export function exportManifestOverviewReportToPDF(
  dateGroups: ManifestOverviewDateGroupExport[],
  flights: ManifestFlight[],
  language: "fr" | "en" = "fr"
) {
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "fr-FR";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  drawAskyPdfHeader(
    doc,
    isEn
      ? "Flight Manifests Statistical Report"
      : "Rapport Statistique des Manifestes de Vols",
    isEn
      ? `${dateGroups.length} departure date(s) | ${flights.length} flight segment(s) | Seated / traveled pax`
      : `${dateGroups.length} date(s) de départ | ${flights.length} tronçon(s) | Passagers ayant voyagé (avec siège)`,
    `${isEn ? "Generated" : "Généré le"}: ${new Date().toLocaleString(locale)}`
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(50, 27, 10);
  doc.text(
    isEn
      ? "1. Daily Summary - Transported Passengers"
      : "1. Synthèse Quotidienne - Passagers Transportés",
    14,
    43
  );

  pdfAutoTable(doc, {
    startY: 46,
    head: [
      isEn
        ? [
            "Date",
            "Flights",
            "Transp.",
            "WB (Rate)",
            "Eco (Y)",
            "Biz (C)",
            "Men",
            "Women",
            "CHD",
            "INF",
            "Bags",
            "Weight (kg)",
            "Uncov.",
          ]
        : [
            "Date",
            "Vols",
            "Transp.",
            "WB (Taux)",
            "Éco (Y)",
            "Biz (C)",
            "Hommes",
            "Femmes",
            "CHD",
            "INF",
            "Bagages",
            "Poids (kg)",
            "Écarts",
          ],
    ],
    body: dateGroups.map((g) => {
      const wbPct =
        g.transported.totalPassengers > 0
          ? ((g.transported.webCheckin / g.transported.totalPassengers) * 100).toFixed(1)
          : "0.0";
      return [
        g.date,
        g.flights.length,
        g.transported.totalPassengers,
        `${g.transported.webCheckin} (${wbPct}%)`,
        g.transported.economy,
        g.transported.business,
        g.transported.male,
        g.transported.female,
        g.transported.child,
        g.transported.infant,
        g.totalBags,
        g.totalWeight.toLocaleString(locale),
        g.totalUncovered,
      ];
    }),
    theme: "grid",
    headStyles: {
      fillColor: [76, 40, 18],
      textColor: [247, 186, 66],
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  const lastY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY || 90;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(50, 27, 10);
  doc.text(
    isEn ? "2. Detailed Breakdown by Flight" : "2. Détail par Vol",
    14,
    lastY + 9
  );

  pdfAutoTable(doc, {
    startY: lastY + 12,
    head: [
      isEn
        ? [
            "Date",
            "Flight",
            "Orig -> Dest",
            "Time / Acft",
            "Config",
            "Pax (C/Y)",
            "WB",
            "M / F / CHD / INF",
            "Bags / Weight",
            "Audit",
            "EMD / FF",
          ]
        : [
            "Date",
            "Vol",
            "Orig -> Dest",
            "Heure / Avion",
            "Comp.",
            "Pax (C/Y)",
            "WB",
            "H / F / CHD / INF",
            "Bag. / Poids",
            "Audit",
            "EMD / FF",
          ],
    ],
    body: flights.map((f) => [
      normalizeDcsFlightDate(f.date),
      `${f.airline} ${f.flightNumber}`,
      `${f.origin} -> ${f.primaryDestination}`,
      `${f.departureTimeFormatted} | ${f.aircraftType}`,
      f.configRaw || "-",
      `${f.grandTotals.passengersCount} (${f.businessTotals.passengersCount}C/${f.economyTotals.passengersCount}Y)`,
      getFlightWebCheckinCount(f),
      `${f.grandTotals.male}/${f.grandTotals.female}/${f.grandTotals.child}/${f.grandTotals.infant}`,
      `${f.grandTotals.bagsCount} pcs | ${f.grandTotals.totalWeight.toLocaleString(locale)} kg`,
      f.baggageUncoveredDeviationsCount > 0
        ? `${f.baggageUncoveredDeviationsCount} ${isEn ? "uncov." : "sans EMD"}`
        : "OK",
      `${f.emdCount} / ${f.ffCount + f.fqtvCount}`,
    ]),
    theme: "striped",
    headStyles: {
      fillColor: [50, 27, 10],
      textColor: [247, 186, 66],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    didParseCell: (data) => {
      if (
        data.column.index === 9 &&
        typeof data.cell.text[0] === "string" &&
        data.cell.text[0] !== "OK"
      ) {
        data.cell.styles.textColor = [190, 18, 60];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  addPdfPageFooters(
    doc,
    isEn
      ? "ASKY Flight Manifests Statistical Report"
      : "ASKY - Rapport Statistique des Manifestes de Vols"
  );

  doc.save(
    `${isEn ? "ASKY_Manifests_Stats_Report" : "ASKY_Rapport_Manifestes_Stats"}_${todayIso()}.pdf`
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Flight Evolution Trends Export (Archive Evolution Sub-View)             */
/* -------------------------------------------------------------------------- */

export function exportFlightEvolutionStatsToCSV(
  flightMeta: FlightKeySummary,
  points: FlightEvolutionPoint[],
  language: "fr" | "en" = "fr"
) {
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "fr-FR";

  const rows: (string | number)[][] = [
    [
      isEn
        ? `# ASKY FLIGHT EVOLUTION STATISTICS - ${flightMeta.airline} ${flightMeta.flightNumber} (DEP ${flightMeta.origin})`
        : `# ASKY - ÉVOLUTION STATISTIQUE DU VOL ${flightMeta.airline} ${flightMeta.flightNumber} (DÉPART ${flightMeta.origin})`,
    ],
    [
      isEn
        ? `# Generated on: ${new Date().toLocaleString(locale)}`
        : `# Généré le : ${new Date().toLocaleString(locale)}`,
    ],
    [],
    isEn
      ? [
          "Date",
          "Flight",
          "Origin",
          "Dep. Time",
          "Aircraft",
          "Config",
          "Total Pax",
          "Web Check-in (WB)",
          "Business (C)",
          "Economy (Y)",
          "Baggage (pcs)",
          "Total Weight (kg)",
          "Avg kg/pax",
          "Avg kg/bag",
          "Uncovered Deviations",
          "EMD",
          "FF Total",
        ]
      : [
          "Date",
          "Vol",
          "Origine",
          "Heure Dép.",
          "Appareil",
          "Composition",
          "Total Pax",
          "Check-in Web (WB)",
          "Business (C)",
          "Économie (Y)",
          "Bagages (pcs)",
          "Poids Total (kg)",
          "Moy. kg/pax",
          "Moy. kg/sac",
          "Écarts Sans EMD",
          "EMD",
          "FF Total",
        ],
    ...points.map((pt) => [
      pt.dateKey,
      `${pt.airline} ${pt.flightNumber}`,
      pt.origin,
      pt.departureTimeFormatted,
      pt.aircraftType,
      pt.configRaw || "-",
      pt.passengersTotal,
      pt.webCheckinCount ?? 0,
      pt.businessCount,
      pt.economyCount,
      pt.bagsCount,
      pt.totalWeight,
      pt.avgWeightPerPax,
      pt.avgWeightPerBag,
      pt.uncoveredDeviations,
      pt.emdCount,
      pt.ffTotal,
    ]),
  ];

  downloadCSV(
    rows,
    `ASKY_Evolution_${flightMeta.airline}${flightMeta.flightNumber}_${flightMeta.origin}_${todayIso()}.csv`
  );
}

export function exportFlightEvolutionStatsToPDF(
  flightMeta: FlightKeySummary,
  points: FlightEvolutionPoint[],
  language: "fr" | "en" = "fr"
) {
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "fr-FR";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  drawAskyPdfHeader(
    doc,
    isEn
      ? `Flight Evolution Statistics - ${flightMeta.airline} ${flightMeta.flightNumber} (Dep. ${flightMeta.origin})`
      : `Statistiques d'Évolution du Vol - ${flightMeta.airline} ${flightMeta.flightNumber} (Départ ${flightMeta.origin})`,
    isEn
      ? `${points.length} recorded day(s) | Avg. ${flightMeta.avgPassengers} pax | Avg. ${flightMeta.avgWeight} kg`
      : `${points.length} jour(s) archivé(s) | Moy. ${flightMeta.avgPassengers} pax | Moy. ${flightMeta.avgWeight} kg`,
    `${isEn ? "Generated" : "Généré le"}: ${new Date().toLocaleString(locale)}`
  );

  pdfAutoTable(doc, {
    startY: 42,
    head: [
      isEn
        ? [
            "Date",
            "Dep. Time",
            "Aircraft",
            "Config",
            "Total Pax",
            "WB",
            "Business (C)",
            "Eco (Y)",
            "Bags (pcs)",
            "Weight (kg)",
            "Avg kg/pax",
            "Uncov. Dev.",
            "EMD",
            "FF",
          ]
        : [
            "Date",
            "Heure",
            "Avion",
            "Comp.",
            "Total Pax",
            "WB",
            "Business (C)",
            "Éco (Y)",
            "Bagages",
            "Poids (kg)",
            "Moy. kg/pax",
            "Écarts",
            "EMD",
            "FF",
          ],
    ],
    body: points.map((pt) => [
      pt.dateKey,
      pt.departureTimeFormatted,
      pt.aircraftType,
      pt.configRaw || "-",
      pt.passengersTotal,
      pt.webCheckinCount ?? 0,
      pt.businessCount,
      pt.economyCount,
      pt.bagsCount,
      pt.totalWeight.toLocaleString(locale),
      pt.avgWeightPerPax,
      pt.uncoveredDeviations,
      pt.emdCount,
      pt.ffTotal,
    ]),
    theme: "striped",
    headStyles: {
      fillColor: [50, 27, 10],
      textColor: [247, 186, 66],
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  addPdfPageFooters(
    doc,
    isEn
      ? "ASKY Flight Evolution Report"
      : "ASKY - Rapport d'Évolution des Vols"
  );

  doc.save(
    `ASKY_Evolution_${flightMeta.airline}${flightMeta.flightNumber}_${flightMeta.origin}_${todayIso()}.pdf`
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Advanced Aviation Analytics & Capacity Report                           */
/* -------------------------------------------------------------------------- */

export interface AnalyticsFlightExportRow {
  flightLabel: string;
  origins: string;
  destinations: string;
  tailNbr: string;
  equipmentType: string;
  seatCapacity: number | null;
  segmentsCount: number;
  traveledTotal: number;
  traveledEco: number;
  traveledBiz: number;
  avgTraveled: number;
  loadFactorPct: number | null;
  ecoLfPct: number | null;
  bizLfPct: number | null;
  noShowTotal: number;
  noShowRatePct: number;
  totalWeight: number;
  avgWeightPerPax: number;
  uncoveredDeviations: number;
  emdCount: number;
  webCheckinCount?: number;
  webCheckinRatePct?: number;
}

export interface AnalyticsKpiExportSummary {
  scopeLabel: string;
  totalDays: number;
  totalSegments: number;
  assignedSegments: number;
  traveledTotal: number;
  traveledEco: number;
  traveledBiz: number;
  offeredTotalCapacity: number;
  globalLoadFactorPct: number | null;
  ecoLoadFactorPct: number | null;
  bizLoadFactorPct: number | null;
  noShowTotal: number;
  noShowRatePct: number;
  totalBags: number;
  totalWeight: number;
  avgWeightPerPax: number;
  uncoveredDeviations: number;
  emdCount: number;
  webCheckinTotal?: number;
  webCheckinRatePct?: number;
}

export function exportFlightAnalyticsReportToCSV(
  summary: AnalyticsKpiExportSummary,
  flightRows: AnalyticsFlightExportRow[],
  language: "fr" | "en" = "fr"
) {
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "fr-FR";

  const rows: (string | number)[][] = [
    [
      isEn
        ? "# ASKY AVIATION ANALYTICS, LOAD FACTOR & FLEET UTILIZATION REPORT"
        : "# ASKY - RAPPORT ANALYTIQUE AVANCÉ, LOAD FACTOR & FLOTTE",
    ],
    [
      isEn
        ? `# Generated on: ${new Date().toLocaleString(locale)} | Scope: ${summary.scopeLabel}`
        : `# Généré le : ${new Date().toLocaleString(locale)} | Périmètre : ${summary.scopeLabel}`,
    ],
    [],
    isEn
      ? [
          "Tracked Days",
          "Segments",
          "Assigned Acft Segments",
          "Traveled Pax",
          "Web Check-in (WB)",
          "WB %",
          "Eco (Y)",
          "Business (C)",
          "Offered Seats",
          "Global LF %",
          "Eco LF %",
          "Biz LF %",
          "No-Show Pax",
          "No-Show %",
          "Total Bags (pcs)",
          "Total Weight (kg)",
          "Avg kg/Pax",
          "Uncovered Dev.",
          "EMD",
        ]
      : [
          "Jours Analysés",
          "Tronçons",
          "Tronçons Affectés",
          "Pax Transportés",
          "Check-in Web (WB)",
          "Taux WB (%)",
          "Éco (Y)",
          "Business (C)",
          "Sièges Offerts",
          "LF Global %",
          "LF Éco %",
          "LF Business %",
          "No-Show",
          "Taux No-Show %",
          "Bagages (pcs)",
          "Poids Total (kg)",
          "Moy. kg/Pax",
          "Écarts Sans EMD",
          "EMD",
        ],
    [
      summary.totalDays,
      summary.totalSegments,
      summary.assignedSegments,
      summary.traveledTotal,
      summary.webCheckinTotal ?? 0,
      `${summary.webCheckinRatePct ?? 0}%`,
      summary.traveledEco,
      summary.traveledBiz,
      summary.offeredTotalCapacity,
      summary.globalLoadFactorPct !== null ? `${summary.globalLoadFactorPct}%` : "-",
      summary.ecoLoadFactorPct !== null ? `${summary.ecoLoadFactorPct}%` : "-",
      summary.bizLoadFactorPct !== null ? `${summary.bizLoadFactorPct}%` : "-",
      summary.noShowTotal,
      `${summary.noShowRatePct}%`,
      summary.totalBags,
      summary.totalWeight,
      summary.avgWeightPerPax,
      summary.uncoveredDeviations,
      summary.emdCount,
    ],
    [],
    isEn
      ? [
          "Flight",
          "Origins",
          "Destinations",
          "Tail Nbr",
          "Aircraft Type",
          "Seat Capacity",
          "Segments",
          "Traveled Pax",
          "Web Check-in (WB)",
          "WB %",
          "Eco (Y)",
          "Biz (C)",
          "Avg Pax/Seg",
          "Global LF %",
          "Eco LF %",
          "Biz LF %",
          "No-Show",
          "No-Show %",
          "Weight (kg)",
          "Avg kg/Pax",
          "Uncovered Dev.",
          "EMD",
        ]
      : [
          "Vol",
          "Origines",
          "Destinations",
          "Immatriculation",
          "Type Appareil",
          "Capacité Sièges",
          "Tronçons",
          "Pax Transportés",
          "Check-in Web (WB)",
          "Taux WB (%)",
          "Éco (Y)",
          "Biz (C)",
          "Moy. Pax/Vol",
          "LF Global %",
          "LF Éco %",
          "LF Biz %",
          "No-Show",
          "No-Show %",
          "Poids (kg)",
          "Moy. kg/Pax",
          "Écarts Sans EMD",
          "EMD",
        ],
    ...flightRows.map((r) => [
      r.flightLabel,
      r.origins,
      r.destinations,
      r.tailNbr || "-",
      r.equipmentType || "-",
      r.seatCapacity !== null ? r.seatCapacity : "-",
      r.segmentsCount,
      r.traveledTotal,
      r.webCheckinCount ?? 0,
      `${r.webCheckinRatePct ?? 0}%`,
      r.traveledEco,
      r.traveledBiz,
      r.avgTraveled,
      r.loadFactorPct !== null ? `${r.loadFactorPct}%` : "-",
      r.ecoLfPct !== null ? `${r.ecoLfPct}%` : "-",
      r.bizLfPct !== null ? `${r.bizLfPct}%` : "-",
      r.noShowTotal,
      `${r.noShowRatePct}%`,
      r.totalWeight,
      r.avgWeightPerPax,
      r.uncoveredDeviations,
      r.emdCount,
    ]),
  ];

  downloadCSV(
    rows,
    `${isEn ? "ASKY_Aviation_Analytics_Report" : "ASKY_Rapport_Statistique_Analyse"}_${todayIso()}.csv`
  );
}

export function exportFlightAnalyticsReportToPDF(
  summary: AnalyticsKpiExportSummary,
  flightRows: AnalyticsFlightExportRow[],
  language: "fr" | "en" = "fr"
) {
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "fr-FR";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  drawAskyPdfHeader(
    doc,
    isEn
      ? "Aviation Statistics, Load Factor & Fleet Performance"
      : "Statistiques & Analyse Avancée — Remplissage & Performance Flotte",
    `${summary.scopeLabel} | ${summary.totalDays} ${isEn ? "day(s)" : "jour(s)"} | ${summary.totalSegments} ${isEn ? "segments" : "tronçons"}`,
    `${isEn ? "Generated" : "Généré le"}: ${new Date().toLocaleString(locale)}`
  );

  pdfAutoTable(doc, {
    startY: 42,
    head: [
      isEn
        ? [
            "Traveled Pax",
            "Web Check-in (WB)",
            "Eco / Biz",
            "Offered Seats",
            "Global LF %",
            "Eco / Biz LF%",
            "No-Show",
            "Baggage / Weight",
            "Avg kg/Pax",
            "Uncov. / EMD",
          ]
        : [
            "Pax Transportés",
            "Check-in Web (WB)",
            "Éco / Biz",
            "Sièges Offerts",
            "LF Global %",
            "LF Éco / Biz",
            "No-Show",
            "Bagages / Poids",
            "Moy. kg/Pax",
            "Écarts / EMD",
          ],
    ],
    body: [
      [
        summary.traveledTotal.toLocaleString(locale),
        `${(summary.webCheckinTotal ?? 0).toLocaleString(locale)} (${summary.webCheckinRatePct ?? 0}%)`,
        `${summary.traveledEco}Y / ${summary.traveledBiz}C`,
        summary.offeredTotalCapacity > 0
          ? summary.offeredTotalCapacity.toLocaleString(locale)
          : "-",
        summary.globalLoadFactorPct !== null
          ? `${summary.globalLoadFactorPct}%`
          : "-",
        `${summary.ecoLoadFactorPct !== null ? `${summary.ecoLoadFactorPct}%` : "-"} / ${
          summary.bizLoadFactorPct !== null ? `${summary.bizLoadFactorPct}%` : "-"
        }`,
        `${summary.noShowTotal} (${summary.noShowRatePct}%)`,
        `${summary.totalBags.toLocaleString(locale)} pcs | ${summary.totalWeight.toLocaleString(locale)} kg`,
        `${summary.avgWeightPerPax} kg`,
        `${summary.uncoveredDeviations} / ${summary.emdCount}`,
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [30, 41, 59], // Slate 800
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: { fontSize: 8.5, halign: "center" },
  });

  const lastY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY || 64;

  pdfAutoTable(doc, {
    startY: lastY + 6,
    head: [
      isEn
        ? [
            "Flight",
            "Tail / Type (Cap.)",
            "Segs",
            "Traveled (C/Y)",
            "WB (%)",
            "Avg",
            "Global LF%",
            "Eco LF%",
            "Biz LF%",
            "No-Show",
            "Weight (kg)",
            "kg/Pax",
            "Uncov.",
          ]
        : [
            "Vol",
            "Immat. / Type (Cap.)",
            "Vols",
            "Transp. (C/Y)",
            "WB (%)",
            "Moy.",
            "LF Global",
            "LF Éco",
            "LF Biz",
            "No-Show",
            "Poids (kg)",
            "kg/Pax",
            "Écarts",
          ],
    ],
    body: flightRows.map((r) => [
      r.flightLabel,
      r.tailNbr
        ? `${r.tailNbr} (${r.equipmentType} · ${r.seatCapacity ?? "-"})`
        : isEn
        ? `${r.equipmentType || "—"} (No PTRG*)`
        : `${r.equipmentType || "—"} (Sans PTRG*)`,
      r.segmentsCount,
      `${r.traveledTotal} (${r.traveledBiz}C/${r.traveledEco}Y)`,
      `${r.webCheckinCount ?? 0} (${r.webCheckinRatePct ?? 0}%)`,
      r.avgTraveled,
      r.loadFactorPct !== null ? `${r.loadFactorPct}%` : "-",
      r.ecoLfPct !== null ? `${r.ecoLfPct}%` : "-",
      r.bizLfPct !== null ? `${r.bizLfPct}%` : "-",
      `${r.noShowTotal} (${r.noShowRatePct}%)`,
      r.totalWeight.toLocaleString(locale),
      r.avgWeightPerPax,
      r.uncoveredDeviations,
    ]),
    theme: "striped",
    headStyles: {
      fillColor: [79, 70, 229], // Indigo 600
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });

  addPdfPageFooters(
    doc,
    isEn
      ? "ASKY Aviation Analytics & Fleet Decision Report"
      : "ASKY - Rapport Décisionnel Statistique & Flotte"
  );

  doc.save(
    `${isEn ? "ASKY_Aviation_Analytics_Report" : "ASKY_Rapport_Statistique_Analyse"}_${todayIso()}.pdf`
  );
}

/* -------------------------------------------------------------------------- */
/* 5. No-Show Detailed Report (CSV / Excel / PDF)                             */
/* -------------------------------------------------------------------------- */

export interface NoShowReportExportSummary {
  scopeLabel: string;
  totalNoShow: number;
  noShowEco: number;
  noShowBiz: number;
  listedTotal: number;
  traveledTotal: number;
  noShowRatePct: number;
  flightsAffectedCount: number;
  totalFlightsCount: number;
}

export interface NoShowFlightExportRow {
  dateKey: string;
  flightLabel: string;
  origin: string;
  destination: string;
  aircraftType: string;
  registration: string;
  capacityTotal: number | null;
  traveledTotal: number;
  noShowTotal: number;
  noShowEco: number;
  noShowBiz: number;
  listedTotal: number;
  noShowRatePct: number;
}

export interface NoShowPassengerExportRow {
  dateKey: string;
  flightLabel: string;
  origin: string;
  destination: string;
  seqLabel: string;
  cabinClass: string;
  bookingClass: string;
  fullNameDisplay: string;
  genderOrType: string;
  hasInfant: boolean;
  ticketNumber: string;
  ticketStatus: string;
  editCodes: string;
}

export function exportNoShowReportToCSV(
  summary: NoShowReportExportSummary,
  byFlight: NoShowFlightExportRow[],
  passengers: NoShowPassengerExportRow[],
  language: "fr" | "en" = "fr"
) {
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "fr-FR";

  const rows: (string | number)[][] = [
    [
      isEn
        ? "# ASKY NO-SHOW REPORT (UNSEATED MANIFEST PASSENGERS)"
        : "# ASKY - RAPPORT NO-SHOW (PASSAGERS SANS SIÈGE SUR LISTE)",
    ],
    [
      isEn
        ? `# Generated on: ${new Date().toLocaleString(locale)} | Scope: ${summary.scopeLabel}`
        : `# Généré le : ${new Date().toLocaleString(locale)} | Périmètre : ${summary.scopeLabel}`,
    ],
    [],
    isEn
      ? [
          "Total No-Show",
          "Eco (Y)",
          "Business (C)",
          "Traveled (Seated)",
          "Total Listed",
          "No-Show Rate %",
          "Affected Flights",
          "Total Flights",
        ]
      : [
          "Total No-Show",
          "Éco (Y)",
          "Business (C)",
          "Voyagés (Avec siège)",
          "Total en liste",
          "Taux No-Show %",
          "Vols touchés",
          "Total Vols",
        ],
    [
      summary.totalNoShow,
      summary.noShowEco,
      summary.noShowBiz,
      summary.traveledTotal,
      summary.listedTotal,
      `${summary.noShowRatePct}%`,
      summary.flightsAffectedCount,
      summary.totalFlightsCount,
    ],
    [],
    [isEn ? "# BREAKDOWN BY FLIGHT & DATE" : "# SYNTHÈSE PAR VOL & DATE"],
    isEn
      ? [
          "Date",
          "Flight",
          "Route",
          "Aircraft / Reg",
          "Capacity",
          "Traveled",
          "No-Show",
          "No-Show (Y/C)",
          "Listed",
          "No-Show %",
        ]
      : [
          "Date",
          "Vol",
          "Tronçon",
          "Appareil / Immat.",
          "Capacité",
          "Voyagés",
          "No-Show",
          "No-Show (Y/C)",
          "En liste",
          "Taux No-Show %",
        ],
    ...byFlight.map((f) => [
      f.dateKey,
      f.flightLabel,
      `${f.origin}->${f.destination}`,
      f.registration ? `${f.aircraftType}/${f.registration}` : f.aircraftType || "-",
      f.capacityTotal !== null ? f.capacityTotal : "-",
      f.traveledTotal,
      f.noShowTotal,
      `${f.noShowEco}Y / ${f.noShowBiz}C`,
      f.listedTotal,
      `${f.noShowRatePct}%`,
    ]),
    [],
    [isEn ? "# NO-SHOW PASSENGER LIST" : "# LISTE DES PASSAGERS NO-SHOW"],
    isEn
      ? [
          "Date",
          "Flight",
          "Route",
          "Seq",
          "Cabin",
          "Class",
          "Passenger",
          "Type",
          "INF",
          "Ticket No.",
          "Ticket Status",
          "Edit Codes",
        ]
      : [
          "Date",
          "Vol",
          "Tronçon",
          "Ordre",
          "Cabine",
          "Classe",
          "Passager",
          "Type",
          "INF",
          "N° Billet",
          "Statut Billet",
          "Edit Codes",
        ],
    ...passengers.map((p) => [
      p.dateKey,
      p.flightLabel,
      `${p.origin}->${p.destination}`,
      p.seqLabel,
      p.cabinClass,
      p.bookingClass,
      p.fullNameDisplay,
      p.genderOrType,
      p.hasInfant ? "INF" : "-",
      p.ticketNumber || "-",
      p.ticketStatus || "-",
      p.editCodes || "-",
    ]),
  ];

  downloadCSV(
    rows,
    `${isEn ? "ASKY_NoShow_Report" : "ASKY_Rapport_NoShow"}_${todayIso()}.csv`
  );
}

export function exportNoShowReportToExcel(
  summary: NoShowReportExportSummary,
  byFlight: NoShowFlightExportRow[],
  passengers: NoShowPassengerExportRow[],
  language: "fr" | "en" = "fr"
) {
  const isEn = language === "en";
  const wb = XLSX.utils.book_new();

  const summarySheetRows = byFlight.map((f) =>
    isEn
      ? {
          Date: f.dateKey,
          Flight: f.flightLabel,
          Origin: f.origin,
          Destination: f.destination,
          "Aircraft / Reg": f.registration
            ? `${f.aircraftType}/${f.registration}`
            : f.aircraftType || "-",
          Capacity: f.capacityTotal !== null ? f.capacityTotal : "-",
          "Traveled (Seated)": f.traveledTotal,
          "No-Show Total": f.noShowTotal,
          "No-Show Eco (Y)": f.noShowEco,
          "No-Show Biz (C)": f.noShowBiz,
          "Listed Total": f.listedTotal,
          "No-Show Rate (%)": f.noShowRatePct,
        }
      : {
          Date: f.dateKey,
          Vol: f.flightLabel,
          Origine: f.origin,
          Destination: f.destination,
          "Appareil / Immat.": f.registration
            ? `${f.aircraftType}/${f.registration}`
            : f.aircraftType || "-",
          Capacité: f.capacityTotal !== null ? f.capacityTotal : "-",
          "Voyagés (Avec siège)": f.traveledTotal,
          "Total No-Show": f.noShowTotal,
          "No-Show Éco (Y)": f.noShowEco,
          "No-Show Biz (C)": f.noShowBiz,
          "Total en liste": f.listedTotal,
          "Taux No-Show (%)": f.noShowRatePct,
        }
  );

  const paxSheetRows = passengers.map((p) =>
    isEn
      ? {
          Date: p.dateKey,
          Flight: p.flightLabel,
          Origin: p.origin,
          Destination: p.destination,
          Seq: p.seqLabel,
          Cabin: p.cabinClass,
          Class: p.bookingClass,
          Passenger: p.fullNameDisplay,
          "Gender / Type": p.genderOrType,
          Infant: p.hasInfant ? "INF" : "-",
          "Ticket No.": p.ticketNumber || "-",
          "Ticket Status": p.ticketStatus || "-",
          "Edit Codes": p.editCodes || "-",
        }
      : {
          Date: p.dateKey,
          Vol: p.flightLabel,
          Origine: p.origin,
          Destination: p.destination,
          Ordre: p.seqLabel,
          Cabine: p.cabinClass,
          Classe: p.bookingClass,
          Passager: p.fullNameDisplay,
          "Sexe / Type": p.genderOrType,
          Bébé: p.hasInfant ? "INF" : "-",
          "N° Billet": p.ticketNumber || "-",
          "Statut Billet": p.ticketStatus || "-",
          "Edit Codes": p.editCodes || "-",
        }
  );

  const overviewRows = [
    isEn
      ? {
          Scope: summary.scopeLabel,
          "Total No-Show": summary.totalNoShow,
          "Eco (Y)": summary.noShowEco,
          "Business (C)": summary.noShowBiz,
          "Traveled (Seated)": summary.traveledTotal,
          "Listed Total": summary.listedTotal,
          "No-Show Rate (%)": summary.noShowRatePct,
          "Affected Flights": `${summary.flightsAffectedCount}/${summary.totalFlightsCount}`,
        }
      : {
          Périmètre: summary.scopeLabel,
          "Total No-Show": summary.totalNoShow,
          "Éco (Y)": summary.noShowEco,
          "Business (C)": summary.noShowBiz,
          "Voyagés (Avec siège)": summary.traveledTotal,
          "Total en liste": summary.listedTotal,
          "Taux No-Show (%)": summary.noShowRatePct,
          "Vols touchés": `${summary.flightsAffectedCount}/${summary.totalFlightsCount}`,
        },
  ];

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(overviewRows),
    isEn ? "Summary" : "Résumé"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      summarySheetRows.length > 0
        ? summarySheetRows
        : [{ Info: isEn ? "No No-Show flights" : "Aucun vol avec No-Show" }]
    ),
    isEn ? "No-Show by Flight" : "No-Show par Vol"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      paxSheetRows.length > 0
        ? paxSheetRows
        : [{ Info: isEn ? "No No-Show passengers" : "Aucun passager No-Show" }]
    ),
    isEn ? "No-Show Passengers" : "Passagers No-Show"
  );

  XLSX.writeFile(
    wb,
    `${isEn ? "ASKY_NoShow_Report" : "ASKY_Rapport_NoShow"}_${todayIso()}.xlsx`
  );
}

export function exportNoShowReportToPDF(
  summary: NoShowReportExportSummary,
  byFlight: NoShowFlightExportRow[],
  passengers: NoShowPassengerExportRow[],
  language: "fr" | "en" = "fr"
) {
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "fr-FR";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  drawAskyPdfHeader(
    doc,
    isEn
      ? "No-Show Report — Unseated Manifest Passengers"
      : "Rapport No-Show — Passagers Sans Siège sur Liste",
    `${summary.scopeLabel} | ${summary.totalNoShow} No-Show (${summary.noShowRatePct}%)`,
    `${isEn ? "Generated" : "Généré le"}: ${new Date().toLocaleString(locale)}`
  );

  pdfAutoTable(doc, {
    startY: 42,
    head: [
      isEn
        ? [
            "Total No-Show",
            "Eco (Y) / Biz (C)",
            "Traveled (Seated)",
            "Total Listed",
            "No-Show Rate %",
            "Flights Affected",
          ]
        : [
            "Total No-Show",
            "Éco (Y) / Biz (C)",
            "Voyagés (Avec siège)",
            "Total en liste",
            "Taux No-Show %",
            "Vols touchés",
          ],
    ],
    body: [
      [
        summary.totalNoShow.toLocaleString(locale),
        `${summary.noShowEco}Y / ${summary.noShowBiz}C`,
        summary.traveledTotal.toLocaleString(locale),
        summary.listedTotal.toLocaleString(locale),
        `${summary.noShowRatePct}%`,
        `${summary.flightsAffectedCount} / ${summary.totalFlightsCount}`,
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [190, 18, 60], // Rose 700
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    styles: { fontSize: 9, halign: "center" },
  });

  let nextY =
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY || 62) + 6;

  if (byFlight.length > 0) {
    pdfAutoTable(doc, {
      startY: nextY,
      head: [
        isEn
          ? [
              "Date",
              "Flight",
              "Sector",
              "Aircraft / Reg",
              "Cap.",
              "Traveled",
              "No-Show",
              "Y / C",
              "Listed",
              "Rate %",
            ]
          : [
              "Date",
              "Vol",
              "Tronçon",
              "Appareil / Immat.",
              "Cap.",
              "Voyagés",
              "No-Show",
              "Y / C",
              "En liste",
              "Taux %",
            ],
      ],
      body: byFlight.map((f) => [
        f.dateKey,
        f.flightLabel,
        `${f.origin} -> ${f.destination}`,
        f.registration ? `${f.aircraftType}/${f.registration}` : f.aircraftType || "-",
        f.capacityTotal !== null ? f.capacityTotal : "-",
        f.traveledTotal,
        f.noShowTotal,
        `${f.noShowEco}Y / ${f.noShowBiz}C`,
        f.listedTotal,
        `${f.noShowRatePct}%`,
      ]),
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: { fontSize: 8, cellPadding: 1.8 },
    });

    nextY =
      ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY || nextY + 20) + 8;
  }

  if (passengers.length > 0) {
    pdfAutoTable(doc, {
      startY: nextY,
      head: [
        isEn
          ? [
              "Date",
              "Flight",
              "Sector",
              "Seq",
              "Cabin/Cls",
              "Passenger Name",
              "Type",
              "Ticket No.",
              "Status",
              "Codes",
            ]
          : [
              "Date",
              "Vol",
              "Tronçon",
              "Ordre",
              "Cab./Cls",
              "Nom & Prénom",
              "Type",
              "N° Billet",
              "Statut",
              "Codes",
            ],
      ],
      body: passengers.map((p) => [
        p.dateKey,
        p.flightLabel,
        `${p.origin} -> ${p.destination}`,
        p.seqLabel,
        `${p.cabinClass}/${p.bookingClass}`,
        p.fullNameDisplay,
        `${p.genderOrType}${p.hasInfant ? "+INF" : ""}`,
        p.ticketNumber || "-",
        p.ticketStatus || "-",
        p.editCodes || "-",
      ]),
      theme: "striped",
      headStyles: {
        fillColor: [225, 29, 72],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
      },
      styles: { fontSize: 7.5, cellPadding: 1.6 },
    });
  }

  addPdfPageFooters(
    doc,
    isEn ? "ASKY No-Show Report" : "ASKY - Rapport No-Show"
  );

  doc.save(
    `${isEn ? "ASKY_NoShow_Report" : "ASKY_Rapport_NoShow"}_${todayIso()}.pdf`
  );
}

