/**
 * Order Processing Service
 *
 * Business logic for Order Processing CRUD operations.
 */

import * as OrderModel from '../models/OrderProcessing.js';
import { buildAuditFields } from '../utils/audit.js';
import { buildSoftDeleteFields } from '../utils/softDelete.js';
import { isAdmin, isDeveloper, isOwnedByUser } from '../utils/accessControl.js';
import log from '../utils/logger.js';
import * as AuditTrailService from './auditTrail.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../constants/auditTrail.js';

function trimText(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function auditOrder(user, action, order, description, extra = {}) {
  const id = String(order?.orderId || '').trim();
  if (!id) return;
  void AuditTrailService.log({
    module: AUDIT_MODULES.ORDER_PROCESSING,
    entityType: 'order',
    entityId: id,
    action,
    description,
    performedBy: trimText(user?.employeeCode),
    performedByRole: user?.role || '',
    employeeCode: trimText(user?.employeeCode),
    employeeName:
      trimText(user?.fullName) ||
      `${trimText(user?.firstName)} ${trimText(user?.lastName)}`.trim(),
    oldValues: extra.oldValues ?? null,
    newValues: extra.newValues ?? null,
    metadata: {
      ownerEmployeeCode: order?.employeeCode || order?.created_by_employee_code || '',
      ...(extra.metadata || {}),
    },
    reference: order?.spplReferenceNumber || '',
  });
}

function normalizeAttachments(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((d) => d?.fileName && d?.fileUrl)
    .map((d) => ({ fileName: d.fileName, fileUrl: d.fileUrl }));
}

function normalizeParts(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((p) => ({
    partNumber: trimText(p.partNumber),
    description: trimText(p.description),
    unitPrice: p.unitPrice != null ? Number(p.unitPrice) : null,
    quantity: p.quantity != null ? Number(p.quantity) : null,
    total: p.total != null ? Number(p.total) : null,
  }));
}

export const getMyOrders = async (user) => {
  const code = trimText(user?.employeeCode);
  if (!code) throw Object.assign(new Error('Employee code required'), { statusCode: 400 });
  return OrderModel.getOrdersByEmployeeCode(code);
};

export const getOrderById = async (orderId, user, effectiveRole) => {
  const order = await OrderModel.getOrderById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });

  const privileged = isAdmin(effectiveRole) || isDeveloper(effectiveRole);
  if (!privileged && !isOwnedByUser(order, user)) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }
  return order;
};

export const createOrder = async (body, user) => {
  const audit = buildAuditFields(user);
  const data = {
    ...audit,
    employeeCode: trimText(user?.employeeCode),
    employeeName:
      trimText(user?.fullName) ||
      `${trimText(user?.firstName)} ${trimText(user?.lastName)}`.trim(),

    spplReferenceNumber: trimText(body.spplReferenceNumber),
    referenceDate: trimText(body.referenceDate),
    checklist: trimText(body.checklist),

    sourceOfEnquiry: trimText(body.sourceOfEnquiry),
    tenderReferenceNumber: trimText(body.tenderReferenceNumber),
    tenderDocument: normalizeAttachments(body.tenderDocument),
    emdSubmitted: trimText(body.emdSubmitted),

    organizationName: trimText(body.organizationName),
    customerContractPONumber: trimText(body.customerContractPONumber),
    poDate: trimText(body.poDate),
    customerGSTNumber: trimText(body.customerGSTNumber),

    billToAddress: trimText(body.billToAddress),
    billContactPerson: trimText(body.billContactPerson),
    billContactMobile: trimText(body.billContactMobile),
    billEmail: trimText(body.billEmail),

    shipToAddress: trimText(body.shipToAddress),
    shipContactPerson: trimText(body.shipContactPerson),
    shipContactMobile: trimText(body.shipContactMobile),
    shipEmail: trimText(body.shipEmail),

    orderedParts: normalizeParts(body.orderedParts),

    principalName: trimText(body.principalName),
    principalCommunication: normalizeAttachments(body.principalCommunication),
    quotationFromPrincipal: normalizeAttachments(body.quotationFromPrincipal),

    expectedDeliveryDate: trimText(body.expectedDeliveryDate),
    ldCharges: trimText(body.ldCharges),
    deliveryTerms: trimText(body.deliveryTerms),
    paymentTerms: trimText(body.paymentTerms),
    warranty: trimText(body.warranty),
    pbgPercentageAmount: trimText(body.pbgPercentageAmount),
    pbgFormat: normalizeAttachments(body.pbgFormat),
    concernedPerson: trimText(body.concernedPerson),

    importantPoints: trimText(body.importantPoints),

    status: 'Draft',
  };

  const order = await OrderModel.createOrder(data);
  log.info('Order created', { orderId: order.orderId, by: user?.employeeCode });
  auditOrder(user, AUDIT_ACTIONS.CREATE, order, 'Order Created', {
    newValues: { status: order.status, organizationName: order.organizationName },
  });
  return order;
};

export const updateOrder = async (orderId, body, user, effectiveRole) => {
  const existing = await OrderModel.getOrderById(orderId);
  if (!existing) throw Object.assign(new Error('Order not found'), { statusCode: 404 });

  const privileged = isAdmin(effectiveRole) || isDeveloper(effectiveRole);
  if (!privileged && !isOwnedByUser(existing, user)) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }

  const updates = {};
  const textFields = [
    'spplReferenceNumber', 'referenceDate', 'checklist',
    'sourceOfEnquiry', 'tenderReferenceNumber', 'emdSubmitted',
    'organizationName', 'customerContractPONumber', 'poDate', 'customerGSTNumber',
    'billToAddress', 'billContactPerson', 'billContactMobile', 'billEmail',
    'shipToAddress', 'shipContactPerson', 'shipContactMobile', 'shipEmail',
    'principalName',
    'expectedDeliveryDate', 'ldCharges', 'deliveryTerms', 'paymentTerms',
    'warranty', 'pbgPercentageAmount', 'concernedPerson', 'importantPoints',
    'status',
  ];

  for (const key of textFields) {
    if (body[key] !== undefined) updates[key] = trimText(body[key]);
  }
  if (body.orderedParts !== undefined) updates.orderedParts = normalizeParts(body.orderedParts);
  if (body.tenderDocument !== undefined) updates.tenderDocument = normalizeAttachments(body.tenderDocument);
  if (body.principalCommunication !== undefined)
    updates.principalCommunication = normalizeAttachments(body.principalCommunication);
  if (body.quotationFromPrincipal !== undefined)
    updates.quotationFromPrincipal = normalizeAttachments(body.quotationFromPrincipal);
  if (body.pbgFormat !== undefined) updates.pbgFormat = normalizeAttachments(body.pbgFormat);

  if (Object.keys(updates).length === 0) return existing;

  const order = await OrderModel.updateOrder(orderId, updates);
  log.info('Order updated', { orderId, by: user?.employeeCode });

  const statusChanged =
    updates.status !== undefined && String(updates.status) !== String(existing.status || '');
  let action = AUDIT_ACTIONS.UPDATE;
  let description = 'Order Updated';
  if (statusChanged) {
    const next = String(updates.status || '').toLowerCase();
    if (next.includes('submit')) {
      action = AUDIT_ACTIONS.WORKFLOW_CHANGE;
      description = 'Order Submitted';
    } else if (next.includes('approv')) {
      action = AUDIT_ACTIONS.APPROVE;
      description = 'Order Approved';
    } else if (next.includes('close') || next.includes('closed')) {
      action = AUDIT_ACTIONS.STATUS_CHANGE;
      description = 'Order Closed';
    } else {
      action = AUDIT_ACTIONS.STATUS_CHANGE;
      description = 'Order Status Updated';
    }
  }

  const fieldDiff = AuditTrailService.diffChangedFields(existing, { ...existing, ...updates }, [
    'status',
    'organizationName',
    'spplReferenceNumber',
    'expectedDeliveryDate',
    'importantPoints',
  ]);
  auditOrder(user, action, order, description, {
    oldValues: fieldDiff.oldValues,
    newValues: fieldDiff.newValues,
  });

  return order;
};

export const deleteOrder = async (orderId, user, effectiveRole) => {
  const existing = await OrderModel.getOrderById(orderId);
  if (!existing) throw Object.assign(new Error('Order not found'), { statusCode: 404 });

  const privileged = isAdmin(effectiveRole) || isDeveloper(effectiveRole);
  if (!privileged && !isOwnedByUser(existing, user)) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }

  const result = await OrderModel.updateOrder(orderId, buildSoftDeleteFields(user));
  log.info('Order deleted', { orderId, by: user?.employeeCode });
  auditOrder(user, AUDIT_ACTIONS.DELETE, existing, 'Order Deleted', {
    oldValues: { status: existing.status },
    newValues: { status: 'Deleted' },
  });
  return result;
};
