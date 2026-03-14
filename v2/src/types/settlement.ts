// ─── Settlement Module Types ─────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "issued" | "paid" | "cancelled";
export type InvoiceType = "purchase" | "sale";

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  delivery_id?: string;
}

export interface Invoice {
  id: string;
  org_id: string;
  counterparty_id: string | null;
  counterparty_name: string | null;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  tax: number;
  freight: number;
  adjustments: number;
  total: number;
  currency: string;
  line_items: InvoiceLineItem[];
  payment_date: string | null;
  payment_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceParams {
  orgId: string;
  userId: string;
  counterpartyId?: string;
  counterpartyName?: string;
  invoiceType: InvoiceType;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  subtotal: number;
  tax?: number;
  freight?: number;
  adjustments?: number;
  total: number;
  currency?: string;
  lineItems?: InvoiceLineItem[];
  notes?: string;
}

export interface UpdateInvoiceParams {
  counterpartyId?: string;
  counterpartyName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  subtotal?: number;
  tax?: number;
  freight?: number;
  adjustments?: number;
  total?: number;
  lineItems?: InvoiceLineItem[];
  notes?: string;
}

export interface InvoiceFilters {
  orgId: string;
  counterpartyId?: string;
  status?: InvoiceStatus;
  invoiceType?: InvoiceType;
}
