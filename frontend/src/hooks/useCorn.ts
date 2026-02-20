import useSWR from "swr";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoverageResponse {
  siteCode: string;
  siteName: string;
  budgetedMt: number;
  committedMt: number;
  hedgedMt: number;
  efpdMt: number;
  receivedMt: number;
  coveragePct: number;
  openBasisMt: number;
  openHedgeLots: number;
  months: MonthDetail[];
}

export interface MonthDetail {
  month: string;
  budgetedMt: number;
  committedMt: number;
  hedgedMt: number;
  efpdMt: number;
  receivedMt: number;
  coveragePct: number;
}

export interface PhysicalContractResponse {
  id: number;
  contractRef: string;
  siteCode: string;
  siteName: string;
  supplierName: string | null;
  commodityCode: string;
  quantityMt: number;
  quantityBu: number;
  deliveryMonth: string;
  basisCentsBu: number | null;
  freightPerMt: number | null;
  futuresRef: string | null;
  currency: string;
  status: string;
  boardPriceCentsBu: number | null;
  basisLockedDate: string | null;
  allInCentsBu: number | null;
  allInPerMt: number | null;
  contractDate: string;
  notes: string | null;
}

export interface HedgeTradeResponse {
  id: number;
  tradeRef: string;
  futuresMonth: string;
  lots: number;
  openLots: number;
  allocatedLots: number;
  unallocatedLots: number;
  pricePerBushel: number;
  brokerAccount: string;
  tradeDate: string;
  status: string;
  equivalentMt: number;
  book: string;
  notes: string;
}

export interface HedgeAllocationResponse {
  id: number;
  hedgeTradeId: number;
  tradeRef: string;
  siteCode: string;
  siteName: string;
  budgetMonth: string;
  allocatedLots: number;
  allocatedMt: number;
  notes: string | null;
  createdAt: string;
}

export interface EFPTicketResponse {
  id: number;
  ticketRef: string;
  hedgeTradeRef: string;
  contractRef: string;
  siteName: string;
  supplierName: string;
  lots: number;
  futuresMonth: string;
  boardPrice: number;
  basisValue: number;
  quantityMt: number;
  efpDate: string;
  confirmationRef: string;
  status: string;
  notes: string;
}

export interface ReceiptResponse {
  id: number;
  ticketRef: string;
  contractRef: string;
  siteCode: string;
  siteName: string;
  receiptDate: string;
  grossMt: number;
  netMt: number;
  moisturePct: number;
  netBushels: number;
  deliveredCostPerMt: number;
  totalCostUsd: number;
  vehicleRef: string;
  notes: string;
}

export interface SiteResponse {
  id: number;
  code: string;
  name: string;
  province: string;
  annualBudgetMt: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCoverage() {
  const { data, error, mutate } = useSWR<CoverageResponse[]>(
    "/api/v1/corn/coverage",
    (url: string) => api.get<CoverageResponse[]>(url),
    { refreshInterval: 30_000 }
  );
  return { coverage: data ?? [], isLoading: !data && !error, error, mutate };
}

export function useContracts(site?: string) {
  const url = site ? `/api/v1/corn/contracts?site=${site}` : "/api/v1/corn/contracts";
  const { data, error, mutate } = useSWR<PhysicalContractResponse[]>(
    url,
    (u: string) => api.get<PhysicalContractResponse[]>(u),
    { refreshInterval: 15_000 }
  );
  return { contracts: data ?? [], isLoading: !data && !error, error, mutate };
}

export function useHedges() {
  const { data, error, mutate } = useSWR<HedgeTradeResponse[]>(
    "/api/v1/corn/hedges",
    (url: string) => api.get<HedgeTradeResponse[]>(url),
    { refreshInterval: 15_000 }
  );
  return { hedges: data ?? [], isLoading: !data && !error, error, mutate };
}

export function useEFPs() {
  const { data, error, mutate } = useSWR<EFPTicketResponse[]>(
    "/api/v1/corn/efp",
    (url: string) => api.get<EFPTicketResponse[]>(url),
    { refreshInterval: 15_000 }
  );
  return { efps: data ?? [], isLoading: !data && !error, error, mutate };
}

export function useReceipts(site?: string) {
  const url = site ? `/api/v1/corn/receipts?site=${site}` : "/api/v1/corn/receipts";
  const { data, error, mutate } = useSWR<ReceiptResponse[]>(
    url,
    (u: string) => api.get<ReceiptResponse[]>(u),
    { refreshInterval: 15_000 }
  );
  return { receipts: data ?? [], isLoading: !data && !error, error, mutate };
}

export function useSites() {
  const { data, error } = useSWR<SiteResponse[]>(
    "/api/v1/corn/sites",
    (url: string) => api.get<SiteResponse[]>(url)
  );
  return { sites: data ?? [], isLoading: !data && !error, error };
}

// ─── Position Manager Types ────────────────────────────────────────────────────

export interface CorporatePoolItem {
  hedgeTradeId: number;
  tradeRef: string;
  futuresMonth: string;
  lots: number;
  openLots: number;
  entryPrice: number;
  settlePrice: number | null;
  mtmPnlUsd: number | null;
  openMt: number;
  validDeliveryMonths: string[];
  status: string;
  brokerAccount: string;
}

export interface PhysicalPositionItem {
  contractId: number;
  contractRef: string;
  deliveryMonth: string;
  siteCode: string;
  siteName: string;
  supplierName: string;
  committedMt: number;
  basisValue: number | null;
  basisLocked: boolean;
  boardPriceLocked: number | null;
  efpExecuted: boolean;
  allInPricePerMt: number | null;
  status: string;
}

export interface LockedPositionItem {
  efpTicketId: number;
  ticketRef: string;
  siteCode: string;
  siteName: string;
  supplierName: string;
  deliveryMonth: string;
  futuresMonth: string;
  lots: number;
  boardPrice: number;
  basisValue: number | null;
  freightValue: number | null;
  allInPricePerMt: number | null;
  quantityMt: number;
  efpDate: string;
  confirmationRef: string;
  status: string;
}

export interface CornPositionResponse {
  corporatePool: CorporatePoolItem[];
  physicalPositions: PhysicalPositionItem[];
  lockedPositions: LockedPositionItem[];
  latestSettles: Record<string, number>;
}

// ─── Budget Types ──────────────────────────────────────────────────────────────

export interface BudgetComponentDto {
  id?: number;
  componentName: string;
  unit: string;
  targetValue: number;
  valuePerMt?: number;
  displayOrder?: number;
}

export interface CornBudgetLineResponse {
  id: number;
  siteCode: string;
  siteName: string;
  commodityCode: string;
  budgetMonth: string;
  futuresMonth: string | null;
  budgetVolumeMt: number;
  budgetVolumeBu: number | null;
  fiscalYear: string | null;
  cropYear: string | null;
  targetAllInPerMt: number | null;
  notes: string | null;
  components: BudgetComponentDto[];
}

export function useBudget(site?: string, fiscalYear?: string) {
  const params = new URLSearchParams();
  if (site)        params.set("site", site);
  if (fiscalYear)  params.set("fiscalYear", fiscalYear);
  const url = `/api/v1/corn/budget?${params.toString()}`;
  const { data, error, mutate } = useSWR<CornBudgetLineResponse[]>(
    url,
    (u: string) => api.get<CornBudgetLineResponse[]>(u),
    { refreshInterval: 30_000 }
  );
  return { budget: data ?? [], isLoading: !data && !error, error, mutate };
}

export function usePositions() {
  const { data, error, mutate } = useSWR<CornPositionResponse>(
    "/api/v1/corn/positions",
    (url: string) => api.get<CornPositionResponse>(url),
    { refreshInterval: 30_000 }
  );
  return { positions: data, isLoading: !data && !error, error, mutate };
}

export function useHedgesByBook(book: "CANADA" | "US") {
  const { data, error, mutate } = useSWR<HedgeTradeResponse[]>(
    `/api/v1/corn/hedges?book=${book}`,
    (url: string) => api.get<HedgeTradeResponse[]>(url),
    { refreshInterval: 15_000 }
  );
  return { hedges: data ?? [], isLoading: !data && !error, error, mutate };
}

export function useHedgeAllocations(tradeId: number | null) {
  const { data, error, mutate } = useSWR<HedgeAllocationResponse[]>(
    tradeId ? `/api/v1/corn/hedges/${tradeId}/allocations` : null,
    (url: string) => api.get<HedgeAllocationResponse[]>(url)
  );
  return { allocations: data ?? [], isLoading: !data && !error, error, mutate };
}
