
export interface SalesRow {
  currency: string;
  method: string; // CA (Cash), ET (E-ticket/Credit Card), CK (Cheque), IN (Invoice), XX (Other)
  refund: number;
  netFare: number;
  totalAmount: number;
}

export interface TaxItem {
  currency: string;
  code: string; // e.g. BF2, BJ2, YQF
  amount: number;
}

export interface CurrencyBlock {
  currency: string;
  sales: SalesRow[];
  commission: number;
  refundTotal: number;
  netFareTotal: number;
  amountTotal: number;
  taxes: TaxItem[];
  taxTotal: number;
  accountingTotal: number; // user formula: totalAmount - ET
  netFareHT: number;       // user formula: (totalAmount - ET) - taxTotal
}

export interface ClosureInfo {
  isAutoClosed: boolean;
  time: string; // e.g. "2304" or "0004"
  date: string; // e.g. "01JUN"
  operator: string; // e.g. "AUTOSYS", "OXBX07"
  rawLine: string;
  delays: string[]; // List of accumulated change of closes if any
}

export interface StationReport {
  id: string; // random uuid or unique key
  stationNumber: string; // e.g. "03222811"
  stationName: string; // e.g. "LFWCT"
  cityCode: string; // e.g. "LFW"
  cityName: string; // Lomé
  stationType: "CT" | "AP" | "CC" | "Unknown"; // City, Airport, Call Center, etc.
  dateStr: string; // e.g. "01JUN"
  fullDate: Date; // standard JS Date object calculated
  year: number; // e.g. 2026
  status: string; // e.g. "CLOSED"
  currencyBlocks: CurrencyBlock[];
  closure: ClosureInfo | null;
  rawText: string;
  isEmpty: boolean;
  hasErrors: boolean;
  errorMessages: string[];
}

export interface SalesData {
  date: string;
  station: string;
  officeId: number;
  stationCode: string;
  currency: string;
  et: number;
  visa: number;
  amex: number;
  mastercard: number;
  otherFop: number;
  refund: number;
  netFare: number;
  totalAmount: number;
  totalTax: number;
  totalHt: number;
}

export interface AuditSummary {
  totalSalesCount: number;
  emptyReportsCount: number;
  activeStationsCount: number;
  currenciesList: string[];
  totalSalesByCurrency: Record<string, { 
    refund: number; 
    netFare: number; 
    total: number; 
    commission: number;
    accountingTotal: number;
    netFareHT: number;
  }>;
  paymentMethodDistribution: Record<string, number>;
  totalTaxByCurrency: Record<string, number>;
  commissionsByStation: Record<string, number>; // Station Name -> Total Commission in primary currency or native
  commissionsByDay: Record<string, number>;     // Date -> Total Commission
  errorCount: number;
}
