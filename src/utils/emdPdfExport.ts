/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  EmdDocumentDetail,
  ManifestFlight,
  ManifestPassenger,
} from "../types";
import {
  classifyEmdBaggagePieces,
  convertEmdDetailToCurrency,
  formatCurrencyAmount,
  formatEmdMonetaryValue,
  formatEmdMonetaryWithTarget,
  formatEmdRoute,
  formatFopMethodLabel,
  formatIssuingPointLabel,
  formatTotalsWithTarget,
  getEmdIssuanceInfo,
  loadDisplayCurrency,
  loadXofRates,
  normalizeEmdNumber,
} from "./emdAudit";
import { normalizeDcsFlightDate } from "./manifestParser";

/**
 * jsPDF standard Helvetica uses WinAnsiEncoding where narrow no-break spaces (\u202F)
 * produced by Intl/toLocaleString("fr-FR") render as "/", and Unicode symbols such as
 * ≈, →, ×, — can render incorrectly or corrupt spacing.
 */
export function sanitizePdfText(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/[\u202F\u00A0]/g, " ")
    .replace(/≈/g, "~")
    .replace(/→/g, "->")
    .replace(/×/g, "x")
    .replace(/—/g, "-");
}

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

function pdfAutoTable(
  doc: jsPDF,
  options: Parameters<typeof autoTable>[1]
) {
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

function drawEmdPdfBanner(
  doc: jsPDF,
  title: string,
  subtitle: string,
  generatedLabel: string
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(50, 27, 10); // #321B0A
  doc.rect(0, 0, pageWidth, 32, "F");

  doc.setFillColor(232, 156, 29); // #E89C1D
  doc.rect(0, 32, pageWidth, 2, "F");

  doc.setTextColor(247, 186, 66); // #F7BA42
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("ASKY AIRLINES - AUDIT EMD", 14, 13);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(sanitizePdfText(title), 14, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(243, 233, 216);
  doc.text(sanitizePdfText(subtitle), 14, 27.5);
  doc.text(sanitizePdfText(generatedLabel), pageWidth - 14, 27.5, {
    align: "right",
  });
}

function addEmdPdfFooters(doc: jsPDF, footerText: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 90, 65);
    doc.text(
      sanitizePdfText(`${footerText} · Page ${i}/${totalPages}`),
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
  }
}

export function exportPassengerEmdAuditToPDF(params: {
  passenger: ManifestPassenger;
  flight: ManifestFlight;
  emdDetailsMap: Record<string, EmdDocumentDetail>;
  xofRates?: Record<string, number>;
  targetCurrency?: string;
  language?: "fr" | "en";
}) {
  const {
    passenger,
    flight,
    emdDetailsMap,
    xofRates,
    targetCurrency,
    language = "fr",
  } = params;
  const rates = xofRates || loadXofRates();
  const target = (targetCurrency || loadDisplayCurrency()).trim().toUpperCase();
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "fr-FR";

  const uniqueNums = Array.from(
    new Set(
      [
        ...(passenger.emdNumbers || []),
        ...(passenger.ancillaries || [])
          .map((a) => a.emdNumber)
          .filter((v): v is string => Boolean(v)),
      ]
        .map((n) => normalizeEmdNumber(n))
        .filter(Boolean)
    )
  );

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const normDate = normalizeDcsFlightDate(flight.date);

  drawEmdPdfBanner(
    doc,
    isEn ? "Passenger EMD Audit Certificate" : "Relevé d'Audit EMD Passager",
    `${passenger.lastName} ${passenger.firstName} · ${flight.airline}${flight.flightNumber} · ${normDate} · ${flight.origin} -> ${passenger.destination}`,
    `${isEn ? "Generated" : "Généré"}: ${new Date().toLocaleString(locale)}`
  );

  pdfAutoTable(doc, {
    startY: 38,
    margin: { left: 14, right: 14 },
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 2.2,
      textColor: [31, 18, 9],
      lineColor: [230, 215, 195],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [250, 247, 242],
      textColor: [76, 40, 18],
      fontStyle: "bold",
    },
    head: [
      [
        isEn ? "Passenger" : "Passager",
        isEn ? "Flight & Route" : "Vol & Parcours",
        isEn ? "Cabin / Seat" : "Cabine / Siège",
        isEn ? "Ticket" : "Billet",
        "EMDs",
      ],
    ],
    body: [
      [
        `${passenger.lastName} ${passenger.firstName}`,
        `${flight.airline} ${flight.flightNumber} · ${normDate}\n${flight.origin} -> ${passenger.destination}`,
        `${passenger.cabinClass} (${passenger.bookingClass}) · ${passenger.seat || "-"}`,
        passenger.ticket?.ticketNumber || "-",
        String(uniqueNums.length),
      ],
    ],
  });

  let cursorY =
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 60) + 6;

  const ensureSpace = (neededMm: number) => {
    if (cursorY + neededMm > pageHeight - 16) {
      doc.addPage();
      cursorY = 16;
    }
  };

  const detailsList = uniqueNums.map((num) => ({
    emdNumber: num,
    detail: emdDetailsMap[num] as EmdDocumentDetail | undefined,
  }));

  for (const { emdNumber, detail } of detailsList) {
    ensureSpace(64);

    if (!detail) {
      pdfAutoTable(doc, {
        startY: cursorY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        headStyles: { fillColor: [76, 40, 18], textColor: [247, 186, 66] },
        head: [[`EMD ${emdNumber}`, isEn ? "Status" : "Statut"]],
        body: [
          [
            passenger.ancillaries
              .filter((a) => normalizeEmdNumber(a.emdNumber || "") === emdNumber)
              .map((a) => a.description || a.rawHeader)
              .join(" · ") || "-",
            isEn
              ? "WEMD* printout not yet imported"
              : "Détail WEMD* non encore importé",
          ],
        ],
      });
      cursorY =
        ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? cursorY + 20) + 6;
      continue;
    }

    const issuance = getEmdIssuanceInfo(detail);
    const pointLabel = formatIssuingPointLabel(
      issuance.issuingPointCode,
      language
    );
    const stationText = issuance.issuingStation
      ? `${issuance.issuingStation}${
          issuance.issuingPointCode
            ? ` (${issuance.issuingPointCode}${
                pointLabel ? ` - ${pointLabel}` : ""
              })`
            : ""
        }`
      : "-";

    const isStationOriginMatch =
      issuance.issuingStation && issuance.issuingStation === flight.origin;
    const pieces = classifyEmdBaggagePieces(detail);
    const pieceLabel = [
      pieces.pieces32kg > 0 ? `${pieces.pieces32kg}x 32kg` : "",
      pieces.pieces23kg > 0 ? `${pieces.pieces23kg}x 23kg` : "",
      pieces.specialBagPieces > 0 ? `${pieces.specialBagPieces}x Spéc.` : "",
      pieces.inFlightUpgradeCount > 0
        ? `${pieces.inFlightUpgradeCount}x Upgrade`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");

    pdfAutoTable(doc, {
      startY: cursorY,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [31, 18, 9],
        lineColor: [230, 215, 195],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [76, 40, 18],
        textColor: [247, 186, 66],
        fontStyle: "bold",
      },
      head: [
        [
          `EMD ${detail.emdNumber}`,
          "REASON FOR ISSUANCE",
          isEn ? "Issuing Station" : "Station d'émission",
          "Agent / N° Station",
          "PNR / Date",
        ],
      ],
      body: [
        [
          `${
            detail.issuedInConnectionWith
              ? `TKT ${detail.issuedInConnectionWith}`
              : "-"
          }${pieceLabel ? `\n${pieceLabel}` : ""}`,
          detail.reasonForIssuance || "-",
          `${stationText}${
            issuance.issuingStation
              ? isStationOriginMatch
                ? `\n(${isEn ? "Departure station" : "Station départ"})`
                : `\n(${isEn ? "Transit / Other" : "Hors station départ"})`
              : ""
          }`,
          `${issuance.issuingAgent || "-"} / STA-${
            issuance.issuingStationNumber || "-"
          }`,
          `${detail.pnr || "-"} · ${detail.dateOfIssue || "-"}`,
        ],
      ],
    });

    cursorY =
      ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? cursorY + 20) + 2;

    if (detail.coupons.length > 0) {
      ensureSpace(24);
      pdfAutoTable(doc, {
        startY: cursorY,
        margin: { left: 14, right: 14 },
        theme: "striped",
        styles: {
          fontSize: 8,
          cellPadding: 1.8,
          textColor: [31, 18, 9],
        },
        headStyles: {
          fillColor: [243, 233, 216],
          textColor: [76, 40, 18],
          fontStyle: "bold",
        },
        head: [
          [
            "CPN",
            isEn ? "Route" : "Parcours",
            "A/L",
            "RFISC",
            isEn ? "Qty" : "Qté",
            isEn ? "Status" : "Statut",
            "REASON FOR ISSUANCE (Sub Code)",
          ],
        ],
        body: detail.coupons.map((cpn) => [
          cpn.couponNumber,
          formatEmdRoute(cpn.route),
          cpn.airline,
          cpn.rfisc,
          cpn.quantity !== undefined ? String(cpn.quantity) : "1",
          cpn.status || "-",
          cpn.reasonForIssuanceSubCode || "-",
        ]),
      });
      cursorY =
        ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? cursorY + 18) + 2;
    }

    ensureSpace(28);
    const fopText =
      detail.fopEntries.length > 0
        ? detail.fopEntries
            .map(
              (f) =>
                `${formatFopMethodLabel(f.methodCode, language)}${
                  f.methodDetails !== f.methodCode ? ` · ${f.methodDetails}` : ""
                }${f.amount ? ` · ${f.amount}` : ""}${
                  f.approvalCode ? ` · APP ${f.approvalCode}` : ""
                }`
            )
            .join("\n")
        : detail.fopSummary || "-";

    pdfAutoTable(doc, {
      startY: cursorY,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        textColor: [31, 18, 9],
        lineColor: [230, 215, 195],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [250, 247, 242],
        textColor: [76, 40, 18],
        fontStyle: "bold",
      },
      head: [
        [
          "BASE VALUE",
          isEn ? "EQUIV VALUE (Local)" : "EQUIV VALUE (Monnaie locale)",
          isEn ? `TOTAL VALUE (Equiv. ${target})` : `TOTAL VALUE (Equiv. ${target})`,
          "FOP (Form of Payment)",
        ],
      ],
      body: [
        [
          formatEmdMonetaryValue(detail.baseValue, locale),
          detail.equivValue
            ? formatEmdMonetaryValue(detail.equivValue, locale)
            : isEn
            ? "- (local)"
            : "- (locale)",
          formatEmdMonetaryWithTarget(detail, target, rates, locale),
          fopText,
        ],
      ],
    });

    cursorY =
      ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? cursorY + 16) + 2;

    if (detail.valueCalc || detail.endorsementsRestrictions) {
      ensureSpace(16);
      pdfAutoTable(doc, {
        startY: cursorY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 2,
          textColor: [31, 18, 9],
          lineColor: [232, 156, 29],
          lineWidth: 0.25,
        },
        body: [
          ...(detail.valueCalc
            ? [
                [
                  {
                    content: "VALUE CALC",
                    styles: {
                      fontStyle: "bold" as const,
                      cellWidth: 42,
                      fillColor: [253, 244, 227] as [number, number, number],
                    },
                  },
                  detail.valueCalc,
                ],
              ]
            : []),
          ...(detail.endorsementsRestrictions
            ? [
                [
                  {
                    content: "ENDORSEMENTS / RESTRICTIONS",
                    styles: {
                      fontStyle: "bold" as const,
                      cellWidth: 42,
                      fillColor: [253, 244, 227] as [number, number, number],
                    },
                  },
                  detail.endorsementsRestrictions,
                ],
              ]
            : []),
        ],
      });
      cursorY =
        ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? cursorY + 12) + 6;
    } else {
      cursorY += 4;
    }
  }

  const auditedList = detailsList
    .map((x) => x.detail)
    .filter((d): d is EmdDocumentDetail => Boolean(d));
  if (auditedList.length >= 1) {
    ensureSpace(18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(76, 40, 18);
    doc.text(
      sanitizePdfText(
        `${isEn ? `Passenger EMD Total (${target})` : `Total EMD Passager (${target})`} (${
          auditedList.length
        }) : ${formatTotalsWithTarget(auditedList, target, rates, locale)}`
      ),
      14,
      cursorY
    );
  }

  addEmdPdfFooters(
    doc,
    `ASKY Airlines · Audit EMD Passager · ${flight.airline}${flight.flightNumber}`
  );

  const safePax = `${passenger.lastName}_${passenger.firstName}`
    .replace(/[^A-Z0-9_-]+/gi, "_")
    .slice(0, 32);
  const emdTag =
    uniqueNums.length === 1 ? uniqueNums[0] : `${uniqueNums.length}EMDs`;
  doc.save(`Audit_EMD_${safePax}_${emdTag}.pdf`);
  void pageWidth;
}

export function exportEmdAuditListToPDF(params: {
  details: EmdDocumentDetail[];
  scopeLabel: string;
  xofRates?: Record<string, number>;
  targetCurrency?: string;
  language?: "fr" | "en";
}) {
  const {
    details,
    scopeLabel,
    xofRates,
    targetCurrency,
    language = "fr",
  } = params;
  const rates = xofRates || loadXofRates();
  const target = (targetCurrency || loadDisplayCurrency()).trim().toUpperCase();
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "fr-FR";

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  let pieces32 = 0;
  let pieces23 = 0;
  let upgrades = 0;
  for (const d of details) {
    const c = classifyEmdBaggagePieces(d);
    pieces32 += c.pieces32kg;
    pieces23 += c.pieces23kg;
    upgrades += c.inFlightUpgradeCount;
  }

  drawEmdPdfBanner(
    doc,
    isEn
      ? "EMD Issuance & Revenue Audit Report"
      : "Rapport d'Audit & Émissions EMD",
    `${scopeLabel} · ${details.length} EMD · 32kg: ${pieces32} · 23kg: ${pieces23} · Upgrades: ${upgrades}`,
    `${isEn ? "Generated" : "Généré"}: ${new Date().toLocaleString(locale)}`
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(76, 40, 18);
  doc.text(
    sanitizePdfText(
      `${
        isEn ? `Total Collected (${target})` : `Montant Total Encaissé (${target})`
      } : ${formatTotalsWithTarget(details, target, rates, locale)}`
    ),
    14,
    40
  );

  pdfAutoTable(doc, {
    startY: 44,
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 7.2,
      cellPadding: 1.7,
      textColor: [31, 18, 9],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [76, 40, 18],
      textColor: [247, 186, 66],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [250, 247, 242],
    },
    head: [
      [
        "EMD #",
        isEn ? "Station (Pt)" : "Station (Pt)",
        "Agent",
        "N° STA",
        isEn ? "Passenger / PNR" : "Passager / PNR",
        isEn ? "Routes" : "Parcours",
        isEn ? "Reason / Pieces" : "Raison / Pièces",
        "Base",
        "Total",
        isEn ? `Equiv. ${target}` : `Équiv. ${target}`,
        "FOP",
        "Restrictions",
      ],
    ],
    body: details.map((d) => {
      const iss = getEmdIssuanceInfo(d);
      const cls = classifyEmdBaggagePieces(d);
      const convertedVal = convertEmdDetailToCurrency(
        d,
        target,
        rates,
        "totalValue"
      );
      const pieceTxt = [
        cls.pieces32kg > 0 ? `${cls.pieces32kg}x32kg` : "",
        cls.pieces23kg > 0 ? `${cls.pieces23kg}x23kg` : "",
        cls.specialBagPieces > 0 ? `${cls.specialBagPieces}xSpéc` : "",
        cls.inFlightUpgradeCount > 0 ? `${cls.inFlightUpgradeCount}xUpg` : "",
      ]
        .filter(Boolean)
        .join(" ");

      return [
        d.emdNumber,
        iss.issuingStation
          ? `${iss.issuingStation}${
              iss.issuingPointCode ? ` (${iss.issuingPointCode})` : ""
            }`
          : "-",
        iss.issuingAgent || "-",
        iss.issuingStationNumber || "-",
        `${d.passengerName || "-"}\n${d.pnr || ""}`,
        d.coupons.map((c) => formatEmdRoute(c.route)).join("\n") || "-",
        `${d.reasonForIssuance || "-"}${pieceTxt ? `\n${pieceTxt}` : ""}`,
        formatEmdMonetaryValue(d.baseValue, locale),
        formatEmdMonetaryValue(d.totalValue, locale),
        formatCurrencyAmount(convertedVal, target, locale),
        d.fopSummary || "-",
        d.endorsementsRestrictions || "-",
      ];
    }),
  });

  addEmdPdfFooters(doc, "ASKY Airlines · Audit & Statistiques EMD");
  doc.save(`Rapport_Audit_EMD_${target}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportEmdAuditListToCSV(params: {
  details: EmdDocumentDetail[];
  xofRates?: Record<string, number>;
  targetCurrency?: string;
  language?: "fr" | "en";
}) {
  const { details, xofRates, targetCurrency, language = "fr" } = params;
  const rates = xofRates || loadXofRates();
  const target = (targetCurrency || loadDisplayCurrency()).trim().toUpperCase();
  const escape = (val: string | number | undefined) => {
    const s = String(val ?? "");
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header =
    language === "en"
      ? [
          "EMD",
          "Date",
          "PNR",
          "Passenger",
          "Station",
          "PointCode",
          "Agent",
          "StationNumber",
          "Reason",
          "Routes",
          "Pieces32kg",
          "Pieces23kg",
          "BaseCurrency",
          "BaseAmount",
          "EquivCurrency",
          "EquivAmount",
          "TotalCurrency",
          "TotalAmount",
          `Total${target}`,
          "FOP",
          "Restrictions",
        ]
      : [
          "EMD",
          "Date",
          "PNR",
          "Passager",
          "Station",
          "CodePoint",
          "Agent",
          "NumStation",
          "Raison",
          "Parcours",
          "Pieces32kg",
          "Pieces23kg",
          "DeviseBase",
          "MontantBase",
          "DeviseEquiv",
          "MontantEquiv",
          "DeviseTotal",
          "MontantTotal",
          `Total${target}`,
          "FOP",
          "Restrictions",
        ];

  const rows = details.map((d) => {
    const iss = getEmdIssuanceInfo(d);
    const cls = classifyEmdBaggagePieces(d);
    const targetVal = convertEmdDetailToCurrency(d, target, rates, "totalValue");
    return [
      d.emdNumber,
      d.dateOfIssue || "",
      d.pnr || "",
      d.passengerName || "",
      iss.issuingStation || "",
      iss.issuingPointCode || "",
      iss.issuingAgent || "",
      iss.issuingStationNumber || "",
      d.reasonForIssuance || "",
      d.coupons.map((c) => formatEmdRoute(c.route)).join(" | "),
      cls.pieces32kg,
      cls.pieces23kg,
      d.baseValue?.currency || "",
      d.baseValue?.rawAmount || "",
      d.equivValue?.currency || "",
      d.equivValue?.rawAmount || "",
      d.totalValue?.currency || "",
      d.totalValue?.rawAmount || "",
      targetVal ?? "",
      d.fopSummary || "",
      d.endorsementsRestrictions || "",
    ];
  });

  const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Audit_EMD_${target}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
