export interface OrderAttachment {
  fileName: string;
  fileUrl: string;
}

export interface OrderPart {
  partNumber: string;
  description: string;
  unitPrice: number | null;
  quantity: number | null;
  total: number | null;
}

export interface OrderProcessingRecord {
  orderId: string;
  employeeCode: string;
  employeeName: string;
  status: string;

  spplReferenceNumber: string;
  referenceDate: string;
  checklist: string;

  sourceOfEnquiry: string;
  tenderReferenceNumber: string;
  tenderDocument: OrderAttachment[];
  emdSubmitted: string;

  organizationName: string;
  customerContractPONumber: string;
  poDate: string;
  customerGSTNumber: string;

  billToAddress: string;
  billContactPerson: string;
  billContactMobile: string;
  billEmail: string;

  shipToAddress: string;
  shipContactPerson: string;
  shipContactMobile: string;
  shipEmail: string;

  orderedParts: OrderPart[];

  principalName: string;
  principalCommunication: OrderAttachment[];
  quotationFromPrincipal: OrderAttachment[];

  expectedDeliveryDate: string;
  ldCharges: string;
  deliveryTerms: string;
  paymentTerms: string;
  warranty: string;
  pbgPercentageAmount: string;
  pbgFormat: OrderAttachment[];
  concernedPerson: string;

  importantPoints: string;

  created_by_employee_code: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
}

export type OrderFormData = Omit<
  OrderProcessingRecord,
  'orderId' | 'employeeCode' | 'employeeName' | 'status' | 'created_by_employee_code' | 'created_by_name' | 'created_at' | 'updated_at' | 'is_deleted'
>;
