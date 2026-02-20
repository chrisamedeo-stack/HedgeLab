export type TradeType =
  | "PHYSICAL_BUY" | "PHYSICAL_SELL"
  | "FINANCIAL_BUY" | "FINANCIAL_SELL"
  | "SWAP" | "OPTION_CALL" | "OPTION_PUT";

export type TradeStatus =
  | "DRAFT" | "CONFIRMED" | "AMENDED" | "CANCELLED"
  | "PARTIALLY_DELIVERED" | "FULLY_DELIVERED" | "SETTLED";

export type DeliveryStatus = "PENDING" | "PARTIAL" | "COMPLETE" | "CANCELLED";

export interface Trade {
  id: number;
  tradeReference: string;
  tradeType: TradeType;
  status: TradeStatus;
  counterpartyId: number;
  counterpartyName: string;
  commodityId: number;
  commodityCode: string;
  bookId: number;
  bookCode: string;
  tradeDate: string;
  startDate: string;
  endDate: string;
  quantity: string;
  quantityUnit: string;
  pricingType: string;
  fixedPrice: string | null;
  priceIndexCode: string | null;
  spread: string;
  currency: string;
  notionalUsd: string | null;
  mtmValueUsd: string | null;
  unrealizedPnlUsd: string | null;
  amendmentCount?: number;
}

export interface DeliverySchedule {
  id: number;
  deliveryMonth: string;
  scheduledQuantity: string;
  deliveredQuantity: string;
  status: DeliveryStatus;
  deliveryLocation: string | null;
  nominationRef: string | null;
}

export interface AmendTradeRequest {
  quantity?: number;
  fixedPrice?: number;
  startDate?: string;
  endDate?: string;
  amendmentReason: string;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
