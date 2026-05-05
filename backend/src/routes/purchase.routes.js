/**
 * Purchase Routes
 * 
 * Defines all purchase management API endpoints.
 */

import express from 'express';
import * as PurchaseController from '../controllers/purchase.controller.js';
// import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All purchase routes (uncomment authenticate when auth is implemented)
// router.use(authenticate);

// Purchase CRUD operations
router.get('/', PurchaseController.getPurchases);
router.get('/:id', PurchaseController.getPurchaseById);
router.post('/', PurchaseController.createPurchase);
router.put('/:id', PurchaseController.updatePurchaseHeader);
router.delete('/:id', PurchaseController.deletePurchase);

// Line item operations
router.put('/:purchaseId/line-items/:lineItemId', PurchaseController.updateLineItem);

export default router;


