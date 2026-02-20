export interface VaRResult {
  var1d95: string;
  var1d99: string;
  var10d95: string;
  var10d99: string;
  observationCount: number;
  lookbackDays: number;
  calculationDate: string;
}

export interface Black76Result {
  delta: number;
  gamma: number;
  vega: number;
  premium: number;
  impliedVolatility: number;
  d1: number;
  d2: number;
  calculationDate: string;
}

export interface CreditUtilization {
  counterpartyId: number;
  counterpartyName: string;
  creditLimit: string;
  utilizedAmount: string;
  utilizationPct: number;
  alertLevel: "GREEN" | "AMBER" | "RED";
  snapshotDate: string;
}

export interface RiskMetric {
  id: number;
  metricType: string;
  metricDate: string;
  metricValue: string;
  currency: string;
  methodology: string | null;
}
