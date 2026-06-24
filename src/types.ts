/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  id: string; 
  stationNumber: string;
  stationName: string;
  cityCode: string;
  cityName: string;
  stationType: "CT" | "AP" | "CC" | "Unknown";
  dateStr: string;
  fullDate: Date; // standard JS Date object calculated
  year: number; 
  status: string; // e.g. "CLOSED"
  currencyBlocks: CurrencyBlock[];
  closure: ClosureInfo | null;
  rawText: string;
  isEmpty: boolean;
  hasErrors: boolean;
  errorMessages: string[];
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

export interface ProcessingStatus {
  isProcessing: boolean;
  progress: number;
  currentStep: string;
  error?: string;
}

export interface CurrencyRate {
  code: string;
  name: string;
  rate: number; // Rate to USD
}

export interface SavedData {
  id: string;
  date: string;
  filename: string;
  data: SalesData[];
}

export interface ChartData {
  date: string;
  total: number;
  totalHT: number;
  count: number;
}
