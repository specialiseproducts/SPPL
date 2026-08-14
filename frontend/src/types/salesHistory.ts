export interface SalesHistoryRecord {
  recordId: string;
  invoiceDate: string;
  invoiceNumber: string;
  customerName: string;
  billingAddress: string;
  principal: string;
  serialNumber: string;
  warranty: string;
  partNumber: string;
  itemDescription: string;
  quantity: number | null;
  endUser: string;
  primaryContactEmail: string;
  createdAt: string;
  updatedAt: string;
  created_by_employee_code?: string;
  created_by_name?: string;
}

export type SalesHistoryInput = {
  invoiceDate: string;
  invoiceNumber: string;
  customerName: string;
  billingAddress?: string;
  principal: string;
  serialNumber?: string;
  warranty?: string;
  partNumber: string;
  itemDescription: string;
  quantity?: number | string | null;
  endUser?: string;
  primaryContactEmail?: string;
};

export type SalesHistoryListParams = {
  q?: string;
  customer?: string;
  principal?: string;
  year?: string;
  invoiceNumber?: string;
  partNumber?: string;
  limit?: number;
  cursor?: string;
};
