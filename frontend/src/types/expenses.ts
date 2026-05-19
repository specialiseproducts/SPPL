export interface ExpenseDocument {
  documentId?: string;
  fileName: string;
  fileUrl: string;
  uploadedAt?: string;
}

export interface ExpenseRecord {
  expenseId: string;
  expenseHead: string;
  /** Present for new canonical heads; omitted on older DynamoDB items */
  subCategory?: string;
  location: string;
  purpose: string;
  serviceProvider: string;
  billNumber: string;
  date: string;
  amount: number;
  employeeName: string;
  employeeId?: string;
  employeeEmail?: string;
  monthYear: string;
  createdAt: string;
  updatedAt: string;
  fromLocation?: string;
  toLocation?: string;
  returnType?: string;
  kilometers?: number;
  stayDateFrom?: string;
  stayDateTo?: string;
  /** Yes = supporting file expected/present; No = none */
  supportingDocument?: 'Yes' | 'No';
  fuelType?: string;
  documents?: ExpenseDocument[];
  selectedFile?: File;
}
