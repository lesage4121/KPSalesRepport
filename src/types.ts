export interface SalesRow {
  currency: string;
  method: string;
  refund: number;
  netFare: number;
  totalAmount: number;
}

export interface TaxItem {
  currency: string;
  code: string;
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
  accountingTotal: number; 
  netFareHT: number; 
}

export interface ClosureInfo {
  isAutoClosed: boolean;
  time: string;
  date: string;
  operator: string; 
  rawLine: string;
  delays: string[];
}

export interface StationReport {
  id: string;
  stationNumber: string;
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

export interface FlightSegment {
  id: string;
  flightNumber: string;
  date: string;
  origin: string;
  destination: string;
  schedDep: string;
  schedArr: string;
  schedDepFormatted: string;
  schedArrFormatted: string;
  actualDep: string;
  actualArr: string;
  actualDepFormatted: string;
  actualArrFormatted: string;
  isKpOperated: boolean; // Numéro à 2 chiffres : opéré directement par KP
  carrierType: "KP_OPERATED" | "CODESHARE";
  hasSystemAdjustment: boolean; // Si une heure réelle a été saisie dans le système
  systemAdjustmentNote: string;
  isSubSegment: boolean;
  segmentIndex: number;
  rawLine: string;
  status: "Opéré par KP" | "Codeshare (Info)";
  wincmd: string;
  ptrgWincmd?: string; // WINCMD("PTRG*/KP22/19NOVLFW/D")
  // Optional metadata extracted from GD* station departure lists
  gdLineNumber?: string;
  gdTerminal?: string;
  gdGate?: string;
  gdFlightStatus?: string;
  gdAircraftType?: string;
  gdPaxBookedRaw?: string;
  gdDownlineStations?: string[];
  arrFromPtrg?: boolean;
  arrIsActualFromPtrg?: boolean;
}

export interface FlightScheduleParseResult {
  date: string;
  segments: FlightSegment[];
  uniqueFlightNumbers: string[];
  uniqueFlightsCount: number;
  kpOperatedSegmentsCount: number;
  codeshareSegmentsCount: number;
  kpUniqueFlightsCount: number;
  codeshareUniqueFlightsCount: number;
  origins: string[];
  destinations: string[];
  rawText: string;
  sourceType?: "VDS" | "GD";
  stationsQueriedCount?: number;
  stationsWithFlightsCount?: number;
}

export interface FlightStatusLeg {
  station: string; // e.g. "LFW", "ACC", "FNA", "BJL"
  status: string; // e.g. "PDC", ""
  eta: string; // e.g. "1325" or ""
  etd: string; // e.g. "1400" or ""
  etaActual?: boolean; // true when ETA/ATA carries '*' marker in PTRG* (e.g. 1029*)
  etdActual?: boolean; // true when ETD/ATD carries '*' marker in PTRG*
  date: string; // e.g. "18NOV" or ""
  dFlag?: string; // e.g. "N"
  tFlag?: string; // e.g. "N"
  aFlag?: string; // e.g. "N"
  rawLine: string;
}

export interface FlightStatusDetail {
  id: string; // e.g. "22|18NOV|LFW"
  queryCommand: string; // e.g. "G*/KP22/18NOVLFW/D"
  airline: string; // e.g. "KP"
  flightNumber: string; // normalized e.g. "22"
  date: string; // e.g. "18NOV"
  origin: string; // e.g. "LFW"
  gate: string; // e.g. "6", "A22"
  etaHeader: string; // e.g. "ORIG" or "1605"
  etdHeader: string; // e.g. "1230"
  headerStatus: string; // e.g. "PDC"
  aircraftType: string; // e.g. "737", "738", "7M8"
  cfg: string; // e.g. "4", "12", "7"
  registration: string; // e.g. "ETBAR"
  seatsRaw: string; // e.g. "16/144"
  businessCapacity: number; // e.g. 16
  economyCapacity: number; // e.g. 144
  totalCapacity: number; // e.g. 160
  boardingTime: string; // raw e.g. "1130"
  boardingTimeFormatted: string; // e.g. "11h30"
  autoOn: string; // e.g. "OFF"
  ckInRule: string; // e.g. "4"
  bagPw: string; // e.g. "PW"
  heldst: string; // e.g. "ON"
  som: string; // e.g. "NN"
  app: string; // e.g. "APP"
  departureStatus: string; // status read from leg matching origin (e.g. "PDC")
  legs: FlightStatusLeg[];
  footerTimestamp?: string;
  rawBlock: string;
  isManualOverride?: boolean;
  isManualOnly?: boolean;
  originalEquipmentSnapshot?: {
    aircraftType: string;
    cfg: string;
    registration: string;
    seatsRaw: string;
    businessCapacity: number;
    economyCapacity: number;
    totalCapacity: number;
  };
}


export interface FlightManifestFile {
  name: string;
  size: number;
  uploadedAt: string;
  content: string;
  linesCount: number;
}

export interface ManifestBagItem {
  tag: string;
  weight: number;
  hasMissingWeight?: boolean; // true if tag is present without weight or with 0 weight
  marker?: string; // e.g. 'P' (Priority/Heavy) or 'V'
  destination: string; // e.g. 'BGF', 'FIH'
  carrier: string; // e.g. 'KP'
}

export interface ManifestAncillaryItem {
  rawHeader: string; // e.g. AE-KP 0071/JNBFIH/BG  BG /HI/4 /0
  route: string; // e.g. JNBFIH
  flightCode: string; // e.g. KP 0071
  serviceType: string; // e.g. BG
  quantity?: number; // e.g. 4
  description: string; // e.g. UPTO50LB 23KG BAGGAGE
  emdNumber?: string; // e.g. 0324400114134
  emdCoupon?: string; // e.g. C01
}

export interface ManifestConnectionFlight {
  direction: "INBOUND" | "OUTBOUND";
  carrier: string; // e.g. KP, ET
  flightNumber: string; // e.g. 34, 0015, 949
  bookingClass: string; // e.g. H, U, Q
  origin?: string; // e.g. LFW, NKC, ADD
  destination?: string; // e.g. BGF (for outbound)
  date: string; // e.g. 11NOV
  timeType: "ETD" | "ETA" | "SKD";
  time: string; // e.g. 1320, 1135
  rawLine: string;
}

export interface ManifestTicketInfo {
  ticketNumber: string; // e.g. 0323997602832
  couponNumber: string; // e.g. C01
  date: string; // e.g. 11NOV
  bookingClass: string; // e.g. H
  route: string; // e.g. NSILFW
  status: string; // e.g. USED
  isPaperTicket?: boolean;
  paperTicketNumber?: string;
}

export interface ManifestInfantInfo {
  lastName: string;
  firstName: string;
  fullNameDisplay: string;
  birthDate?: string; // e.g. 04MAR26, 25NOV24
  ticket?: ManifestTicketInfo; // Billet électronique bébé associé (IFET)
  rawIdentityLine?: string;
  rawTicketLine?: string;
}

export type ManifestBaggageCompliance = "CONFORME" | "COUVERT_EMD" | "ECART_NON_COUVERT";

export interface ManifestPassenger {
  id: string;
  seq: number;
  classSeq: number; // 1-based alphabetical order number within cabinClass (C or Y)
  isTransitMarker: boolean; // '#' after seq (e.g. 33#)
  lastName: string;
  firstName: string;
  partyCode?: string; // e.g. AD3, AE2, AF2
  fullNameDisplay: string;
  bookingClass: string; // e.g. H, Q, C, J, D, Z, I, R
  cabinClass: "C" | "Y"; // Business (C,J,D,Z,I,R) vs Eco (Y)
  destination: string; // Segment destination e.g. LFW, SSG, FIH
  seat: string; // e.g. 16L, 2J, or ""
  fareCode: string; // e.g. F (Full Fare), S
  bagsDeclaredCount: number; // from header (NB = 0, else integer)
  isNoBagDeclared: boolean; // true if NB
  gender: "M" | "F" | "";
  paxType: "ADT" | "CHD" | "INF";
  hasInfant: boolean; // INF / IFET
  infant?: ManifestInfantInfo;
  isChild: boolean; // CHD
  isCodeshare: boolean; // CS
  isWebCheckin: boolean; // WB
  isOffloadedOrNoSeat: boolean; // OFL or no seat + 0 bags status
  editCodes: string[];
  bags: ManifestBagItem[];
  bagsTotalDeclaredLine?: { count: number; weight: number; hasMissingWeight?: boolean };
  totalBagWeight: number;
  baggageDestination: string;
  // Allowance & Deviation audit
  allowedBagsCount: number; // 2
  allowedWeightPerBag: number; // 32 for Business, 24 for Eco
  allowedTotalWeight: number; // 64 for Business, 48 for Eco
  baggageCompliance: ManifestBaggageCompliance;
  baggageDeviations: string[];
  hasMissingBaggageWeight?: boolean;
  missingBaggageWeightDetails?: string[];
  // Ancillaries & EMDs
  ancillaries: ManifestAncillaryItem[];
  emdNumbers: string[];
  // Loyalty
  kpFrequentFlyer?: { number: string; tier?: string }; // FF
  partnerFrequentFlyer?: { carrier: string; number: string }; // FQTV
  // Connections
  inboundFlight?: ManifestConnectionFlight;
  outboundFlight?: ManifestConnectionFlight;
  // Ticket
  ticket?: ManifestTicketInfo;
  // Other remarks (OTHS, CM)
  othsRemarks: string[];
  cmRemarks: string[];
  rawLines: string[];
}

export interface ManifestCabinTotals {
  male: number;
  female: number;
  unknown: number;
  child: number;
  infant: number;
  passengersCount: number;
  bagsCount: number;
  totalWeight: number;
}

export interface ManifestFlight {
  id: string;
  commandLine: string; // e.g. G*L69/11NOVNSI#BT/ET/...
  airline: string; // KP
  flightNumber: string; // 69
  date: string; // 11NOV
  origin: string; // NSI (Station de départ)
  primaryDestination: string; // Destination majoritaire des passagers sur ce tronçon
  destinationCounts: { code: string; count: number }[]; // Destinations passagers trouvées
  gate?: string; // e.g. A3, 6, 8
  departureTime: string; // raw 830
  departureTimeFormatted: string; // 08:30
  aircraftType: string; // 738, 737
  configRaw: string; // Composition actuelle du vol (ex: C12Y102 ou Y58 si pure éco)
  configBusiness: number; // Nombre de passagers Business annoncés en entête (C)
  configEconomy: number; // Nombre de passagers Éco annoncés en entête (Y)
  isPureEconomy: boolean; // true quand l'entête indique Yx sans Business (ex: Y58)
  headerEditCodes: string[]; // BT ET IB OB
  footerTimestamp?: string; // HDQ.HDQ8HEA 1123 12-NOV-2026 1CC450
  extractedYear: string; // e.g. 26 from 12-NOV-2026
  passengers: ManifestPassenger[];
  businessPassengers: ManifestPassenger[];
  economyPassengers: ManifestPassenger[];
  businessTotals: ManifestCabinTotals;
  economyTotals: ManifestCabinTotals;
  grandTotals: ManifestCabinTotals;
  transitPassengersCount: number;
  emdCount: number;
  ancillariesCount: number;
  baggageUncoveredDeviationsCount: number;
  baggageCoveredDeviationsCount: number;
  baggageMissingWeightCount?: number;
  ffCount: number;
  fqtvCount: number;
  codeshareCount: number;
  etoCount: number;
  webCheckinCount?: number;
}

export interface TransportedPassengerReport {
  totalPassengers: number;
  rawPassengersCount: number;
  deduplicatedCount: number;
  economy: number;
  business: number;
  male: number;
  female: number;
  child: number;
  infant: number;
  unknownGender: number;
  webCheckin: number;
}

export interface ManifestParseResult {
  flights: ManifestFlight[];
  totalFlights: number;
  totalPassengers: number;
  totalBusinessPassengers: number;
  totalEconomyPassengers: number;
  totalBags: number;
  totalWeight: number;
  totalUncoveredDeviations: number;
  totalCoveredDeviations: number;
  totalMissingBaggageWeightCount?: number;
  totalEmds: number;
  totalLoyaltyCount: number;
  totalWebCheckin?: number;
  manifestDate: string;
  extractedTimestamp?: string;
}

export interface EmdMonetaryValue {
  currency: string;
  amount: number;
  rawAmount: string;
}

export interface EmdCouponDetail {
  couponNumber: string;
  airline: string;
  route: string;
  rfisc: string;
  status: string;
  quantity?: number;
  reasonForIssuanceSubCode: string;
  inConnectionWithDocument?: string;
  associationStatus?: string;
}

export interface EmdFopEntry {
  methodCode: string;
  methodDetails: string;
  amount?: string;
  approvalCode?: string;
  raw: string;
}

export interface EmdDocumentDetail {
  emdNumber: string;
  passengerName: string;
  pnr?: string;
  dateOfIssue?: string;
  totalCouponsCount?: number;
  reasonForIssuance: string;
  coupons: EmdCouponDetail[];
  baseValue?: EmdMonetaryValue;
  equivValue?: EmdMonetaryValue;
  totalValue?: EmdMonetaryValue;
  valueCalc?: string;
  fopEntries: EmdFopEntry[];
  fopSummary: string;
  endorsementsRestrictions?: string;
  issuedAt?: string;
  issuingOffice?: string;
  issuingStation?: string;
  issuingPointCode?: string;
  issuingAgent?: string;
  issuingAgentSignIn?: string;
  issuingStationNumber?: string;
  issuedInConnectionWith?: string;
  updatedAt?: string;
}
