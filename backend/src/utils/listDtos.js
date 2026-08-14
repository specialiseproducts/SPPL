/**
 * Lightweight list DTOs — exclude documents, audit blobs, and heavy nested fields.
 */

function pickPrimaryDocument(documents) {
  if (!Array.isArray(documents) || documents.length === 0) return null;
  const doc = documents.find((d) => d && String(d.fileUrl || '').trim() !== '');
  if (!doc) return null;
  return {
    fileName: String(doc.fileName || 'document').trim(),
    fileUrl: String(doc.fileUrl).trim(),
  };
}

export function toExpenseListDto(row, enrichFn) {
  if (!row || typeof row !== 'object') return row;
  const { documents, supportingDocument: sdRaw, ...rest } = row;
  const primaryDoc = pickPrimaryDocument(documents);
  const hasDocArray = primaryDoc != null;
  const sd = typeof sdRaw === 'string' ? sdRaw.trim() : '';
  let supportingDocument = 'No';
  if (sd === 'Yes' || sd === 'No') {
    supportingDocument = sd;
  } else if (hasDocArray) {
    supportingDocument = 'Yes';
  }
  const hasDocuments = supportingDocument === 'Yes' || hasDocArray;
  const base = {
    ...rest,
    supportingDocument,
    hasDocuments,
    ...(primaryDoc ? { documents: [primaryDoc] } : {}),
  };
  return typeof enrichFn === 'function' ? enrichFn(base) : base;
}

/** Sales opportunity summary for tables / infinite scroll (detail via GET /:id). */
export function toSalesOpportunityListDto(row, normalizeFn) {
  if (!row) return null;
  const item = typeof normalizeFn === 'function' ? normalizeFn(row) : row;
  const ws = item.workflowStatus || 'draft';
  const showRef =
    (ws === 'approved' || ws === 'in_progress' || ws === 'closed') &&
    String(item.quotationRef || '').trim() !== '';
  return {
    forecastId: item.forecastId,
    workflowStatus: ws,
    quotationRef: showRef ? String(item.quotationRef || '').trim() : '',
    opportunityStatus: item.opportunityStatus || '',
    revisionNumber:
      item.revisionNumber != null && Number.isFinite(Number(item.revisionNumber))
        ? Math.max(0, Math.floor(Number(item.revisionNumber)))
        : 0,
    customerOrganization: item.customerOrganization || item.endCustomer || '',
    principal: item.principal || '',
    inrValueExclGst:
      item.inrValueExclGst != null
        ? item.inrValueExclGst
        : item.conversionToINR != null
          ? item.conversionToINR
          : null,
    probabilityLabel:
      item.probabilityLabel ||
      (item.probability != null && item.probability !== '' ? `${item.probability}%` : ''),
    probabilityPercent: item.probabilityPercent ?? null,
    quotationDate: item.quotationDate || '',
    decisionExpectedBy: item.decisionExpectedBy || '',
    ownerEmployeeCode: item.ownerEmployeeCode || item.created_by_employee_code || '',
    ownerEmployeeName: item.ownerEmployeeName || item.employeeName || item.created_by_name || '',
    createdByEmployeeCode: item.created_by_employee_code || '',
    updatedAt: item.updatedAt || item.updated_at || '',
  };
}

export function toPurchaseHeaderListDto(header) {
  if (!header) return null;
  return {
    purchaseHeaderId: header.purchaseHeaderId || header.id,
    recordType: header.recordType || header.record_type || '',
    poNumber: header.poNumber || header.po_number || '',
    date: header.date || '',
    principal: header.principal || '',
    invoiceNumber: header.invoiceNumber || header.invoice_number || '',
    invoiceDate: header.invoiceDate || header.invoice_date || '',
    boeNumber: header.boeNumber || header.boe_number || '',
    boeDate: header.boeDate || header.boe_date || '',
    created_by_employee_code: header.created_by_employee_code || '',
    created_by_name: header.created_by_name || '',
    updatedAt: header.updatedAt || header.updated_at || '',
  };
}

export function toPurchaseLineItemListDto(item) {
  if (!item) return null;
  return {
    purchaseLineItemId: item.purchaseLineItemId || item.id || item.lineItemId,
    purchaseHeaderId: item.purchaseHeaderId || item.po_number || '',
    itemDetails: item.itemDetails || item.item_details || '',
    partNumber: item.partNumber || item.part_number || '',
    unitPrice: Number(item.unitPrice ?? item.unit_price ?? 0),
    quantity: Number(item.quantity ?? item.qty ?? 0),
    totalLandedPrice: Number(item.totalLandedPrice ?? item.total_landed_price ?? 0),
    priceToSPPL: Number(item.priceToSPPL ?? item.price_to_sppl ?? 0),
    gmPercentage: Number(item.gmPercentage ?? item.gm_percentage ?? 0),
    margin: Number(item.margin ?? 0),
    createdAt: item.createdAt || item.created_at || '',
    updatedAt: item.updatedAt || item.updated_at || '',
  };
}

export function toPurchaseListEntry(header, lineItems) {
  return {
    header: toPurchaseHeaderListDto(header),
    lineItems: (lineItems || []).map(toPurchaseLineItemListDto).filter(Boolean),
  };
}

/**
 * Employee directory row for User Management table + export.
 * Omits passwords and file blobs only; keeps scalar HR/contact fields and file URL keys.
 */
export function toEmployeeListDto(employee) {
  if (!employee || typeof employee !== 'object') return employee;
  const {
    password,
    temporaryPassword,
    documents,
    pastExperience,
    profilePhoto,
    ...rest
  } = employee;

  const officialEmail =
    rest.officialEmail || rest.official_email || rest.email || '';

  return {
    employeeId: rest.employeeId,
    employeeCode: rest.employeeCode || rest.employee_code,
    firstName: rest.firstName || rest.first_name,
    lastName: rest.lastName || rest.last_name,
    name: rest.name,
    designation: rest.designation,
    department: rest.department,
    role: rest.role,
    location: rest.location,
    corporateId: rest.corporateId || rest.corporate_id,
    dateOfJoining: rest.dateOfJoining || rest.date_of_joining,
    dateOfExit: rest.dateOfExit || rest.date_of_exit,
    dateOfBirth: rest.dateOfBirth || rest.date_of_birth,
    gender: rest.gender,
    phoneNumber: rest.phoneNumber || rest.phone,
    officialEmail,
    personalEmail: rest.personalEmail || rest.personal_email,
    aadharNo: rest.aadharNo || rest.aadhar_no,
    panNo: rest.panNo || rest.pan_no,
    accountNo: rest.accountNo || rest.account_no,
    bankName: rest.bankName || rest.bank_name,
    ifsc: rest.ifsc,
    uanNumber: rest.uanNumber || rest.uan_no,
    emergencyContact: rest.emergencyContact || rest.emergency_contact,
    address: rest.address,
    permanentAddress: rest.permanentAddress || rest.permanent_address,
    biometricCode: rest.biometricCode || rest.biometric_code,
    biometricPassword: rest.biometricPassword || rest.biometric_password,
    passportNo: rest.passportNo || rest.passport_no,
    mediClaimNo: rest.mediClaimNo || rest.medi_claim_no,
    documentsUrl: rest.documentsUrl || rest.documents_url,
    pastExperienceUrl: rest.pastExperienceUrl || rest.past_experience_url,
    profilePhotoUrl:
      rest.profilePhotoUrl || rest.profile_photo_url || (typeof profilePhoto === 'string' ? profilePhoto : ''),
    approval_status: rest.approval_status,
    is_deleted: rest.is_deleted,
    imported: rest.imported,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
  };
}
