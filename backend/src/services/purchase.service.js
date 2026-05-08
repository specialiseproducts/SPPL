/**
 * Purchase Service
 * 
 * Business logic layer for purchase management operations.
 * Handles purchase headers and line items CRUD operations.
 */

import * as PurchaseHeadersModel from '../models/PurchaseHeaders.js';
import * as PurchaseLineItemsModel from '../models/PurchaseLineItems.js';
import * as AuditLogsModel from '../models/AuditLogs.js';
import { buildAuditFields } from '../utils/audit.js';
import { canAccessAllRecords, isOwnedByUser } from '../utils/accessControl.js';
import { v4 as uuidv4 } from 'uuid';
import log from '../utils/logger.js';

/**
 * Get purchase header with line items
 * @param {string} purchaseHeaderId - Purchase header ID
 * @returns {Promise<Object>} Purchase header with line items
 */
export const getPurchaseById = async (purchaseHeaderId, authUser = null, effectiveRole = 'User') => {
  try {
    if (!purchaseHeaderId) {
      throw new Error('purchaseHeaderId is required');
    }

    log.info('Getting purchase:', purchaseHeaderId);
    const header = await PurchaseHeadersModel.getHeaderById(purchaseHeaderId);
    if (!header) {
      throw new Error('Purchase not found');
    }
    const lineItems = await PurchaseLineItemsModel.getLineItemsByPurchaseHeaderId(purchaseHeaderId);

    const result = {
      header,
      lineItems,
    };

    if (!authUser || canAccessAllRecords(effectiveRole)) {
      return result;
    }

    const ownedLineItems = lineItems.filter((item) => isOwnedByUser(item, authUser));
    const headerOwned = isOwnedByUser(header, authUser);
    if (!headerOwned && ownedLineItems.length === 0) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    return {
      header,
      lineItems: ownedLineItems,
    };
  } catch (error) {
    log.error('Error getting purchase:', error);
    throw error;
  }
};

/**
 * Get purchases with filters
 * @param {Object} filters - Filter criteria
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} List of purchases
 */
export const getPurchases = async (filters = {}, options = {}, authUser = null, effectiveRole = 'User') => {
  try {
    log.info('Getting purchases with filters:', filters);
    const headers = await PurchaseHeadersModel.getAllHeaders();
    const purchases = await Promise.all(
      headers.map(async (header) => {
        const lineItems = await PurchaseLineItemsModel.getLineItemsByPurchaseHeaderId(header.purchaseHeaderId);
        return {
          header,
          lineItems,
        };
      })
    );

    if (!authUser || canAccessAllRecords(effectiveRole)) {
      return purchases;
    }

    const filtered = purchases
      .map((purchase) => {
        const ownedHeader = isOwnedByUser(purchase.header, authUser);
        const ownedLineItems = purchase.lineItems.filter((item) => isOwnedByUser(item, authUser));
        if (!ownedHeader && ownedLineItems.length === 0) {
          return null;
        }
        return {
          ...purchase,
          lineItems: ownedLineItems,
        };
      })
      .filter(Boolean);

    return filtered;
  } catch (error) {
    log.error('Error getting purchases:', error);
    throw error;
  }
};

/**
 * Create purchase with line items
 * @param {Object} purchaseData - Purchase header data
 * @param {Array} lineItems - Array of line item data
 * @param {string} userId - User ID creating the purchase (for audit)
 * @returns {Promise<Object>} Created purchase with line items
 */
export const createPurchase = async (purchaseData, lineItems = [], authUser) => {
  try {
    if (!purchaseData) {
      throw new Error('purchaseData is required');
    }
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      throw new Error('lineItems are required');
    }

    log.info('Creating purchase:', purchaseData);
    const timestamp = new Date().toISOString();
    const purchaseHeaderId = `PH#${uuidv4()}`;
    const auditFields = authUser ? buildAuditFields(authUser) : {};

    const header = await PurchaseHeadersModel.createHeader({
      purchaseHeaderId,
      recordType: purchaseData.record_type || purchaseData.recordType || '',
      poNumber: purchaseData.po_number || purchaseData.poNumber || '',
      date: purchaseData.date || '',
      principal: purchaseData.principal || '',
      invoiceNumber: purchaseData.invoice_number || purchaseData.invoiceNumber || '',
      invoiceDate: purchaseData.invoice_date || purchaseData.invoiceDate || '',
      boeNumber: purchaseData.boe_number || purchaseData.boeNumber || '',
      boeDate: purchaseData.boe_date || purchaseData.boeDate || '',
      ...auditFields,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const normalizedLineItems = lineItems.map((item) => ({
      purchaseHeaderId,
      itemDetails: item.item_details || item.itemDetails || '',
      partNumber: item.part_number || item.partNumber || '',
      unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
      quantity: Number(item.qty ?? item.quantity ?? 0),
      freightCharges: Number(item.freight_charges_international ?? item.freightCharges ?? 0),
      gst: Number(item.gst_on_import_cgst_sgst_igst_local ?? item.gst ?? 0),
      totalLandedPrice: Number(item.total_landed_price ?? item.totalLandedPrice ?? 0),
      priceToSPPL: Number(item.price_to_sppl ?? item.priceToSPPL ?? 0),
      gmPercentage: Number(item.gm_percentage ?? item.gmPercentage ?? 0),
      margin: Number(item.margin ?? 0),
      ...auditFields,
      createdAt: item.created_at || timestamp,
      updatedAt: timestamp,
    }));

    const createdLineItems = await PurchaseLineItemsModel.createLineItems(normalizedLineItems);

    return {
      header,
      lineItems: createdLineItems,
    };
  } catch (error) {
    log.error('Error creating purchase:', error);
    throw error;
  }
};

/**
 * Update purchase header
 * @param {string} purchaseHeaderId - Purchase header ID
 * @param {Object} updateData - Fields to update
 * @param {string} userId - User ID making the update (for audit)
 * @returns {Promise<Object>} Updated purchase header
 */
export const updatePurchaseHeader = async (purchaseHeaderId, updateData, userId) => {
  try {
    // TODO: Add business logic
    // 1. Validate purchaseHeaderId and updateData
    // 2. Check if purchase can be updated (status checks)
    // 3. Call PurchaseHeadersModel.updatePurchaseHeader
    // 4. Create audit log entry
    // 5. Return updated purchase
    
    log.info('Updating purchase header:', purchaseHeaderId);
    throw new Error('Not implemented yet');
  } catch (error) {
    log.error('Error updating purchase header:', error);
    throw error;
  }
};

/**
 * Update line item
 * @param {string} lineItemId - Line item ID
 * @param {Object} updateData - Fields to update
 * @param {string} userId - User ID making the update (for audit)
 * @returns {Promise<Object>} Updated line item
 */
export const updateLineItem = async (lineItemId, updateData, userId) => {
  try {
    // TODO: Add business logic
    // 1. Validate lineItemId and updateData
    // 2. Call PurchaseLineItemsModel.updateLineItem
    // 3. Update purchase header totals if needed
    // 4. Create audit log entry
    // 5. Return updated line item
    
    log.info('Updating line item:', lineItemId);
    throw new Error('Not implemented yet');
  } catch (error) {
    log.error('Error updating line item:', error);
    throw error;
  }
};

/**
 * Delete purchase
 * @param {string} purchaseHeaderId - Purchase header ID
 * @param {string} userId - User ID making the deletion (for audit)
 * @returns {Promise<Object>} Deletion result
 */
export const deletePurchase = async (purchaseHeaderId, userId) => {
  try {
    // TODO: Add business logic
    // 1. Validate purchaseHeaderId
    // 2. Check if purchase can be deleted (status checks)
    // 3. Delete all line items
    // 4. Delete purchase header
    // 5. Create audit log entry
    // 6. Return deletion result
    
    log.info('Deleting purchase:', purchaseHeaderId);
    throw new Error('Not implemented yet');
  } catch (error) {
    log.error('Error deleting purchase:', error);
    throw error;
  }
};


