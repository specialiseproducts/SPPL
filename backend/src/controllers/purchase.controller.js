/**
 * Purchase Controller
 * 
 * Handles HTTP requests/responses for purchase management endpoints.
 */

import * as PurchaseService from '../services/purchase.service.js';
import log from '../utils/logger.js';

/**
 * Get purchase by ID (with line items)
 * GET /api/purchases/:id
 */
export const getPurchaseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const purchase = await PurchaseService.getPurchaseById(id);

    res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    log.error('Get purchase controller error:', error);
    next(error);
  }
};

/**
 * Get all purchases
 * GET /api/purchases
 */
export const getPurchases = async (req, res, next) => {
  try {
    const filters = req.query;
    const options = {
      limit: parseInt(req.query.limit) || 50,
      lastKey: req.query.lastKey,
    };

    const result = await PurchaseService.getPurchases(filters, options);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('Get purchases controller error:', error);
    next(error);
  }
};

/**
 * Create new purchase (with line items)
 * POST /api/purchases
 */
export const createPurchase = async (req, res, next) => {
  try {
    const { purchaseData, lineItems } = req.body;
    const userId = req.user?.id; // From auth middleware

    const purchase = await PurchaseService.createPurchase(purchaseData, lineItems, userId);

    res.status(201).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    log.error('Create purchase controller error:', error);
    next(error);
  }
};

/**
 * Update purchase header
 * PUT /api/purchases/:id
 */
export const updatePurchaseHeader = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user?.id; // From auth middleware

    const purchase = await PurchaseService.updatePurchaseHeader(id, updateData, userId);

    res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    log.error('Update purchase controller error:', error);
    next(error);
  }
};

/**
 * Update line item
 * PUT /api/purchases/:purchaseId/line-items/:lineItemId
 */
export const updateLineItem = async (req, res, next) => {
  try {
    const { lineItemId } = req.params;
    const updateData = req.body;
    const userId = req.user?.id; // From auth middleware

    const lineItem = await PurchaseService.updateLineItem(lineItemId, updateData, userId);

    res.status(200).json({
      success: true,
      data: lineItem,
    });
  } catch (error) {
    log.error('Update line item controller error:', error);
    next(error);
  }
};

/**
 * Delete purchase
 * DELETE /api/purchases/:id
 */
export const deletePurchase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // From auth middleware

    await PurchaseService.deletePurchase(id, userId);

    res.status(200).json({
      success: true,
      message: 'Purchase deleted successfully',
    });
  } catch (error) {
    log.error('Delete purchase controller error:', error);
    next(error);
  }
};


