
import { StationReport, CurrencyBlock, SalesRow, TaxItem, ClosureInfo, AuditSummary } from "./types";
import { EXCHANGE_RATES_TO_XOF } from "./utils/constants";

// master station database to fetch city info and full names
export const STATION_DB: Record<string, { name: string; city: string; country: string }> = {
  "03222811": { name: "LFWCT", city: "LFW CTO", country: "Togo" },
  "03222822": { name: "LFWAP", city: "LFW APT", country: "Togo" },
  "32228173": { name: "LFWCC", city: "LFW Call Center", country: "Togo" },
  "03222516": { name: "ABJCT", city: "ABJ CTO", country: "Côte d'Ivoire" },
  "03222520": { name: "ABJAP", city: "ABJ APT", country: "Côte d'Ivoire" },
  "03223441": { name: "ABVAP", city: "ABV APT", country: "Nigéria" },
  "03223452": { name: "ABVCT", city: "ABV CTO", country: "Nigéria" },
  "03223474": { name: "ABVCT2", city: "ABV CTO2", country: "Nigéria" },
  "03223312": { name: "ACCCT", city: "ACC CTO", country: "Ghana" },
  "03223323": { name: "ACCCT2", city: "Acc CT2", country: "Ghana" },
  "99990015": { name: "BGFCT", city: "BGF CTO", country: "République Centrafricaine" },
  "32236035": { name: "BGFAP", city: "BGF APT", country: "République Centrafricaine" },
  "03222004": { name: "BJLAP", city: "BJL APT", country: "Gambie" },
  "22209961": { name: "BJLCT", city: "BJL CTO", country: "Gambie" },
  "03222306": { name: "BKOAP", city: "BKO APT", country: "Mali" },
  "03222310": { name: "BKOCT", city: "BKO CTO", country: "Mali" },
  "03224222": { name: "BZVCT", city: "BZV CTO", country: "Congo" },
  "32242022": { name: "BZVAP", city: "BZV APT", country: "Congo" },
  "03222450": { name: "CKYCT", city: "CKY CTO", country: "Guinée" },
  "32224006": { name: "CKYAP", city: "CKY APT", country: "Guinée" },
  "03222914": { name: "COOCT", city: "COO CTO", country: "Bénin" },
  "03222962": { name: "COOAP", city: "COO APT", country: "Bénin" },
  "03223710": { name: "DLACT", city: "DLA CTO", country: "Cameroun" },
  "32237144": { name: "DLAAP", city: "DLA APT", country: "Cameroun" },
  "03222111": { name: "DKRCT", city: "DKR CTO", country: "Sénégal" },
  "32221000": { name: "DSSAP", city: "DSS APT", country: "Sénégal" },
  "03224314": { name: "FIHCT", city: "FIH CTO", country: "RD Congo" },
  "32243002": { name: "FIHAP", city: "FIH APT", country: "RD Congo" },
  "03223220": { name: "FNACT", city: "FNA CTO", country: "Sierra Leone" },
  "03223253": { name: "FNACT", city: "FNA CTO2", country: "Sierra Leone" },
  "03202710": { name: "JNBAP", city: "JNB APT", country: "Afrique du Sud" },
  "03202721": { name: "JNBCC", city: "JNB CC", country: "Afrique du Sud" },
  "03202732": { name: "JNBCT", city: "JNB CTO", country: "Afrique du Sud" },
  "03224115": { name: "LBVCT", city: "LBV CTO", country: "Gabon" },
  "32241005": { name: "LBVAP", city: "LBV APT", country: "Gabon" },
  "03223426": { name: "LOSCT", city: "LOS CTO", country: "Nigéria" },
  "03223430": { name: "LOSAP", city: "LOS APT", country: "Nigéria" },
  "03223511": { name: "NDJCT", city: "NDJ CTO", country: "Tchad" },
  "03223522": { name: "NDJAP", city: "NDJ APT", country: "Tchad" },
  "03222715": { name: "NIMCT", city: "NIM CTO", country: "Niger" },
  "32227075": { name: "NIMAP", city: "NIM APT", country: "Niger" },
  "03223721": { name: "YAOCT", city: "NSI CTO", country: "Cameroun" },
  "32237122": { name: "NSIAP", city: "NSI APT", country: "Cameroun" },
  "03222612": { name: "OUACT", city: "OuA CTO", country: "Burkina Faso" },
  "32226003": { name: "OUAAP", city: "OUA APT", country: "Burkina Faso" },
  "03224594": { name: "OXBAP", city: "OXB APT", country: "Guinée-Bissau" },
  "28209882": { name: "OXBCT", city: "OXB CTO", country: "Guinée-Bissau" },
  "03224281": { name: "PNRCT", city: "PNR CTO", country: "Congo" },
  "32242011": { name: "PNRAP", city: "PNR APT", country: "Congo" },
  "03223113": { name: "MLWCT", city: "MLW CTO", country: "Liberia" },
  "03223146": { name: "ROBAP", city: "ROB APT", country: "Liberia" },
  "03223802": { name: "RAICT", city: "RIA CTO", country: "Cap-Vert" },
  "03223813": { name: "RAIAP", city: "RIA APT", country: "Cap-Vert" },
  "03224410": { name: "LADCT", city: "LAD CTO", country: "Angola" },
  "03224406": { name: "LADCT", city: "LAD CTO2", country: "Angola" },
  "03225401": { name: "NBOCT", city: "NBO CTO", country: "Kenya" },
  "03225412": { name: "NBOAP", city: "NBO APT", country: "Kenya" },
  "03222214": { name: "NKCCT", city: "NKC CTO", country: "Mauritanie" },
  "03222203": { name: "NKCAP", city: "NKC APT", country: "Mauritanie" }
};

// Map months to index
const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
};

export function parseDateString(dayMonth: string): Date {
  // Day Month is like "01JUN" or "05JUN"
  const day = parseInt(dayMonth.substring(0, 2), 10);
  const monthStr = dayMonth.substring(2, 5).toUpperCase();
  const month = MONTH_MAP[monthStr] !== undefined ? MONTH_MAP[monthStr] : 5; // default June
  const year = 2026; // Based on metadata and GRAND TOTAL STATION REPORT FOR 01JUN26
  return new Date(year, month, day);
}

export function parseRawReports(rawText: string): StationReport[] {
  const reports: StationReport[] = [];
  
  const rawBlocks = rawText.split(/(?=WY\*T#STA)/);

  rawBlocks.forEach((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return;

    const lines = trimmed.split("\n").map(l => l.trimEnd());
    const firstLine = lines[0] || "";

    // Parse header WY*T#STA03222811#D01JUN
    const headerMatch = firstLine.match(/WY\*T#STA(\d+)#D(\d+[A-Z]{3})/i);
    if (!headerMatch) {
      return; // Skip invalid blocks
    }

    const stationNumber = headerMatch[1];
    const dateStr = headerMatch[2];
    const parsedDate = parseDateString(dateStr);
    const stationId = `rep_${stationNumber}_${dateStr}_${index}`;

    // Read details from station line (usually line 2 or 3)
    // STATION NAME:LFWCT    STATUS: CLOSED   STATION NUMBER:03222811
    let stationName = "";
    let status = "";
    lines.forEach(l => {
      const match = l.match(/STATION NAME:\s*([A-Z0-9\s*_]*?)\s+STATUS:\s*([A-Z0-9\s_*]*?)\s+STATION NUMBER:/i);
      if (match) {
        stationName = match[1].trim();
        status = match[2].trim();
      }
    });

    // Fallback on master station database if fields are blank
    const dbInfo = STATION_DB[stationNumber];
    if (!stationName && dbInfo) {
      stationName = dbInfo.name;
    }
    if (!status) {
      status = "CLOSED"; // Default to CLOSED as list says CLOSED
    }

    const cityCode = stationName ? stationName.substring(0, 3).toUpperCase() : (dbInfo ? stationName?.substring(0,3) || "UNK" : "UNK");
    const cityName = dbInfo ? dbInfo.city : (STATION_DB[stationNumber]?.city || "Ville Inconnue");
    const country = dbInfo ? dbInfo.country : (STATION_DB[stationNumber]?.country || "Inconnu");

    let stationType: "CT" | "AP" | "CC" | "Unknown" = "Unknown";
    if (stationName.endsWith("CT")) stationType = "CT";
    else if (stationName.endsWith("AP")) stationType = "AP";
    else if (stationName.endsWith("CC")) stationType = "CC";
    else if (dbInfo) {
      if (dbInfo.name.endsWith("CT")) stationType = "CT";
      if (dbInfo.name.endsWith("AP")) stationType = "AP";
      if (dbInfo.name.endsWith("CC")) stationType = "CC";
    }

    // Check if empty report (just "END OF REPORT" and no sales)
    const isEndOnly = trimmed.includes("END OF REPORT") && !trimmed.includes("TOTAL SALES FROM CLOSED AGENT REPORTS");
    const isEmpty = isEndOnly || lines.length < 8;

    const report: StationReport = {
      id: stationId,
      stationNumber,
      stationName: stationName || `STA-${stationNumber}`,
      cityCode,
      cityName: cityName + (country ? ` (${country})` : ""),
      stationType,
      dateStr,
      fullDate: parsedDate,
      year: 2026,
      status,
      currencyBlocks: [],
      closure: null,
      rawText: trimmed,
      isEmpty,
      hasErrors: false,
      errorMessages: []
    };

    if (!isEmpty) {
      // 1. EXTRACT SALES BLOCK
      // Under TOTAL SALES FROM CLOSED AGENT REPORTS until TAXES or ADJUSTMENTS: or ACCUMULATED
      let salesSectionText = "";
      let foundSalesHeader = false;
      const salesSectionLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("TOTAL SALES FROM CLOSED AGENT REPORTS")) {
          foundSalesHeader = true;
          continue;
        }
        if (foundSalesHeader) {
          if (line.includes("TAXES") || line.includes("ADJUSTMENTS:") || line.includes("ACCUMULATED OVERAGE")) {
            break;
          }
          salesSectionLines.push(line);
        }
      }

      salesSectionText = salesSectionLines.join("\n");

      // Group sales sections by separating asterisks "*********************************" (at least 10 asterisks to avoid splitting on "***" currency)
      const rawCurrencyBlocks = salesSectionText.split(/\s*\*{10,}\s*/);

      rawCurrencyBlocks.forEach(subBlock => {
        const subLines = subBlock.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        if (subLines.length === 0) return;

        // Try to identify the currency of this block (usually prefix of parsed row, or in total totals line)
        let blockCurrency = "";
        const salesRows: SalesRow[] = [];
        let commission = 0;
        let refundTotal = 0;
        let netFareTotal = 0;
        let amountTotal = 0;

        subLines.forEach(subLine => {
          // Parse sales row:
          // XOF CA               985200                 0           3766900
          // *** ET                    0                 0                 0
          // USD ET                 0.00              0.00           2114.50
          const salesRowMatch = subLine.match(/^([A-Z*]{3})\s+([A-Z0-9\s]{2,3})\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/);
          if (salesRowMatch) {
            const curr = salesRowMatch[1];
            const method = salesRowMatch[2].trim();
            const refund = parseFloat(salesRowMatch[3]);
            const netFare = parseFloat(salesRowMatch[4]);
            const totalAmount = parseFloat(salesRowMatch[5]);

            if (!blockCurrency && curr !== "***") {
              blockCurrency = curr;
            }

            salesRows.push({
              currency: curr,
              method,
              refund,
              netFare,
              totalAmount
            });
          }

          // COMMISSION AMOUNT                                        -56080
          // COMMISSION AMOUNT                                      -1733.34
          const commMatch = subLine.match(/COMMISSION AMOUNT\s+(-?\d+(?:\.\d+)?)/i);
          if (commMatch) {
            commission = parseFloat(commMatch[1]);
          }

          // TOTAL XOF - REFUND                                       985200
          const refTotMatch = subLine.match(/TOTAL\s+([A-Z*]{3})\s+-\s+REFUND\s+(-?\d+(?:\.\d+)?)/i);
          if (refTotMatch) {
            refundTotal = parseFloat(refTotMatch[2]);
            if (!blockCurrency && refTotMatch[1] !== "***") {
              blockCurrency = refTotMatch[1];
            }
          }

          // NET FARE                                                    0
          // NET FARE                                                 0.00
          // Don't match the table header "                       RFND          NET FARE      TOTAL AMOUNT"
          if (subLine.includes("NET FARE") && !subLine.includes("RFND")) {
            const netMatch = subLine.match(/NET FARE\s+(-?\d+(?:\.\d+)?)/i);
            if (netMatch) {
              netFareTotal = parseFloat(netMatch[1]);
            }
          }

          // TOTAL AMOUNT                                          8177020
          // TOTAL AMOUNT                                          2114.50
          if (subLine.includes("TOTAL AMOUNT") && !subLine.includes("RFND")) {
            const amtMatch = subLine.match(/TOTAL AMOUNT\s+(-?\d+(?:\.\d+)?)/i);
            if (amtMatch) {
              amountTotal = parseFloat(amtMatch[1]);
            }
          }
        });

        // Set default currency if unknown
        if (!blockCurrency && salesRows.length > 0) {
          blockCurrency = salesRows[0].currency;
        }
        if (!blockCurrency) {
          blockCurrency = "***";
        }

        // Align individual currencies on row if they are "***" but block has a known currency
        if (blockCurrency !== "***") {
          salesRows.forEach(row => {
            if (row.currency === "***") {
              row.currency = blockCurrency;
            }
          });
        }

        if (salesRows.length > 0 || commission !== 0 || amountTotal !== 0) {
          report.currencyBlocks.push({
            currency: blockCurrency,
            sales: salesRows,
            commission,
            refundTotal,
            netFareTotal,
            amountTotal,
            taxes: [], // Will populate in TAXES parsing
            taxTotal: 0,
            accountingTotal: 0, // Calculated after taxes
            netFareHT: 0        // Calculated after taxes
          });
        }
      });

      // 2. EXTRACT TAXES BLOCKS
      // There can be multiple TAXES blocks! Each starting with "TAXES" and ending with "TOTAL TAX - [CURRENCY]"
      // Let's locate them
      let insideTaxesBlock = false;
      let tempTaxesCurrency = "";
      let tempTaxesList: TaxItem[] = [];
      let tempTaxesSum = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith("TAXES")) {
          insideTaxesBlock = true;
          tempTaxesCurrency = "";
          tempTaxesList = [];
          tempTaxesSum = 0;
          continue;
        }

        if (insideTaxesBlock) {
          const totalTaxMatch = line.match(/TOTAL TAX\s*-\s*([A-Z]{3})\s+(-?\d+(?:\.\d+)?)/i);
          if (totalTaxMatch) {
            tempTaxesCurrency = totalTaxMatch[1];
            tempTaxesSum = parseFloat(totalTaxMatch[2]);

            // Save to corresponding currency blocks
            let targetBlock = report.currencyBlocks.find(b => b.currency === tempTaxesCurrency);
            // If no block exists, create a shell currency block
            if (!targetBlock) {
              targetBlock = {
                currency: tempTaxesCurrency,
                sales: [],
                commission: 0,
                refundTotal: 0,
                netFareTotal: 0,
                amountTotal: 0,
                taxes: [],
                taxTotal: 0,
                accountingTotal: 0,
                netFareHT: 0
              };
              report.currencyBlocks.push(targetBlock);
            }

            // Assign currency to taxes items and push
            tempTaxesList.forEach(t => {
              if (t.currency === "***" || !t.currency) {
                t.currency = tempTaxesCurrency;
              }
            });
            targetBlock.taxes = tempTaxesList;
            targetBlock.taxTotal = tempTaxesSum;

            insideTaxesBlock = false;
          } else {
            // Parse individual tax components
            // e.g. "XOF CF                25000 CI3               -5000"
            // or "GHS BF2              130.00 BF3               43.40"
            // or "USD YQF              112.10 YRF               40.00"
            const taxTokens = line.split(/\s+/).map(t => t.trim()).filter(t => t.length > 0);
            if (taxTokens.length === 0) continue;

            let inheritedCurrency = "";
            let tIndex = 0;

            // Check if the first token is a 3-letter currency descriptor (e.g. "XOF" followed by "YQF" and "366900")
            // A currency descriptor is 3 uppercase letters, followed by a tax code (non-numeric), followed by a numeric amount.
            if (
              taxTokens.length >= 3 &&
              /^[A-Z]{3}$/.test(taxTokens[0]) &&
              !/^-?\d+(?:\.\d+)?$/.test(taxTokens[1]) &&
              /^-?\d+(?:\.\d+)?$/.test(taxTokens[2])
            ) {
              inheritedCurrency = taxTokens[0];
              tIndex = 1; // Start parsing tax pairs from the second token
            }

            // Extract all [taxCode, amount] pairs
            while (tIndex < taxTokens.length) {
              const code = taxTokens[tIndex];
              const amountToken = taxTokens[tIndex + 1];

              if (code && amountToken && /^-?\d+(?:\.\d+)?$/.test(amountToken)) {
                tempTaxesList.push({
                  currency: inheritedCurrency || "***",
                  code: code.toUpperCase(),
                  amount: parseFloat(amountToken)
                });
                tIndex += 2;
              } else {
                tIndex += 1;
              }
            }
          }
        }
      }

      // 3. EXTRACT CLOSE INDICATION
      // AUTO-CLOSED 2304/01JUN/AUTOSYS
      // CLOSED 0001/03JUN/OXBX07
      let closure: ClosureInfo | null = null;
      let delays: string[] = [];

      lines.forEach(line => {
        if (line.includes("AUTOCLOSE DELAY FROM")) {
          delays.push(line.trim());
        }

        // Try to match closing details
        const autoCloseMatch = line.match(/(AUTO-CLOSED|CLOSED)\s+(\d+)\/(\d+[A-Z]{3})\/([A-Z0-9_]+)/i);
        if (autoCloseMatch) {
          closure = {
            isAutoClosed: autoCloseMatch[1].toUpperCase() === "AUTO-CLOSED",
            time: autoCloseMatch[2],
            date: autoCloseMatch[3],
            operator: autoCloseMatch[4],
            rawLine: line.trim(),
            delays: [...delays]
          };
        }
      });

      report.closure = closure;

    // 4. PERFORM AUDIT VALIDATIONS
    // Check for discrepancies: eg. calculated sum of sales rows != reported totals
    
    // a. Basic integrity checks
    if (!report.stationNumber || !/^\d+$/.test(report.stationNumber)) {
      report.hasErrors = true;
      report.errorMessages.push("Numéro de station malformé ou manquant.");
    }

    if (report.currencyBlocks.length === 0 && !isEmpty) {
      report.hasErrors = true;
      report.errorMessages.push("Aucune donnée financière détectée malgré un rapport non vide.");
    }

    report.currencyBlocks.forEach(block => {
      // b. Currency validation
      if (block.currency === "***") {
        report.hasErrors = true;
        report.errorMessages.push("Devise indéterminée (***) dans un bloc de ventes.");
      }

      // --- NEW ACCOUNTING FORMULAS ---
      // totalAmount to pay = amountTotal - ET_amount
      const etAmount = block.sales.filter(s => s.method === "ET").reduce((sum, s) => sum + s.totalAmount, 0);
      block.accountingTotal = block.amountTotal - etAmount;
      // HT = (amountTotal - ET_amount) - taxTotal
      block.netFareHT = block.accountingTotal - block.taxTotal;

      // c. Calculated vs Reported Checks
      let calcRefund = 0;
      let calcNetFar = 0;
      let calcTotAmt = 0;

      block.sales.forEach(row => {
        calcRefund += row.refund;
        calcNetFar += row.netFare;
        calcTotAmt += row.totalAmount;

        // Inconsistency: row currency mismatch with block
        if (row.currency !== block.currency && row.currency !== "***") {
          report.hasErrors = true;
          report.errorMessages.push(`Incohérence de devise : ${row.currency} trouvé dans un bloc déclaré en ${block.currency}`);
        }
      });

      const EPSILON = 0.05; // float precision
      
      // Sum rows total audit
      if (Math.abs(calcTotAmt - block.amountTotal) > EPSILON) {
        const diffWithComm = Math.abs((calcTotAmt + block.commission) - block.amountTotal);
        if (diffWithComm > EPSILON && Math.abs(calcTotAmt - block.amountTotal) > EPSILON) {
          report.hasErrors = true;
          report.errorMessages.push(
            `Écart sur les ventes (${block.currency}) : Détails (${calcTotAmt}) vs Total rapporté (${block.amountTotal}). Diff: ${parseFloat((calcTotAmt - block.amountTotal).toFixed(2))}`
          );
        }
      }

      // Refund total audit
      if (Math.abs(calcRefund - block.refundTotal) > EPSILON) {
        report.hasErrors = true;
        report.errorMessages.push(
          `Écart sur les remboursements (${block.currency}) : Détails (${calcRefund}) vs Rapporté (${block.refundTotal})`
        );
      }

      // Tax totals audit
      if (block.taxes.length > 0) {
        let calcTaxesSum = 0;
        block.taxes.forEach(t => calcTaxesSum += t.amount);
        
        if (Math.abs(calcTaxesSum - block.taxTotal) > EPSILON) {
          report.hasErrors = true;
          report.errorMessages.push(
            `Écart sur les taxes (${block.currency}) : Composantes (${parseFloat(calcTaxesSum.toFixed(2))}) vs Déclaré (${block.taxTotal})`
          );
        }
      }
    });

    // d. Closure validation
    if (!closure && !trimmed.includes("END OF REPORT")) {
      report.hasErrors = true;
      report.errorMessages.push("Information de clôture (CLOSED/AUTO-CLOSED) manquante.");
    }
  }

  reports.push(report);
  });

  return reports;
}

export function computeAuditSummary(reports: StationReport[]): AuditSummary {
  const activeReports = reports.filter(r => !r.isEmpty);
  const totalSalesCount = activeReports.length;
  const emptyReportsCount = reports.length - totalSalesCount;
  const activeStations = new Set(reports.map(r => r.stationNumber));
  const totalSalesByCurrency: AuditSummary["totalSalesByCurrency"] = {};
  const paymentMethodDistribution: Record<string, number> = {};
  const totalTaxByCurrency: Record<string, number> = {};
  const commissionsByStation: Record<string, number> = {};
  const commissionsByDay: Record<string, number> = {};
  let errorCount = reports.filter(r => r.hasErrors).length;

  activeReports.forEach(rep => {
    const stationKey = `${rep.stationName} (${rep.stationNumber})`;
    const dayKey = rep.dateStr;

    rep.currencyBlocks.forEach(block => {
      const cur = block.currency;
      const rate = EXCHANGE_RATES_TO_XOF[cur] || 1;
      const commInXOF = block.commission * rate;

      // Aggregating commissions
      commissionsByStation[stationKey] = (commissionsByStation[stationKey] || 0) + commInXOF;
      commissionsByDay[dayKey] = (commissionsByDay[dayKey] || 0) + commInXOF;
      
      if (!totalSalesByCurrency[cur]) {
        totalSalesByCurrency[cur] = { 
          refund: 0, 
          netFare: 0, 
          total: 0, 
          commission: 0,
          accountingTotal: 0,
          netFareHT: 0
        };
      }

      totalSalesByCurrency[cur].refund += block.refundTotal;
      totalSalesByCurrency[cur].netFare += block.netFareTotal;
      totalSalesByCurrency[cur].total += block.amountTotal;
      totalSalesByCurrency[cur].commission += block.commission;
      totalSalesByCurrency[cur].accountingTotal += block.accountingTotal;
      totalSalesByCurrency[cur].netFareHT += block.netFareHT;

      // payment method
      block.sales.forEach(row => {
        const method = row.method || "ET";
        if (!paymentMethodDistribution[method]) {
          paymentMethodDistribution[method] = 0;
        }
        paymentMethodDistribution[method] += row.totalAmount;
      });

      // taxes
      if (!totalTaxByCurrency[cur]) {
        totalTaxByCurrency[cur] = 0;
      }
      totalTaxByCurrency[cur] += block.taxTotal;
    });
  });
  return {
    totalSalesCount,
    emptyReportsCount,
    activeStationsCount: activeStations.size,
    currenciesList: Object.keys(totalSalesByCurrency),
    totalSalesByCurrency,
    paymentMethodDistribution,
    totalTaxByCurrency,
    commissionsByStation,
    commissionsByDay,
    errorCount
  };
}
