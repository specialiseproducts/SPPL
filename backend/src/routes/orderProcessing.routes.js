/**
 * Order Processing Routes
 */

import express from 'express';
import * as OrderController from '../controllers/orderProcessing.controller.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';
import { upload } from '../config/s3.js';
import log from '../utils/logger.js';

const router = express.Router();

router.use(authenticateToken, authorize('orderProcessing'));

function uploadOrderFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      log.error('Order processing file upload error:', err);
      const e = err;
      if (!Number.isInteger(e.statusCode) || e.statusCode < 400 || e.statusCode > 599) {
        e.statusCode = 400;
      }
      return next(e);
    }
    next();
  });
}

router.get('/', OrderController.getMyOrders);
router.post('/upload', uploadOrderFile, OrderController.uploadFile);
router.post('/', OrderController.createOrder);
router.get('/:id', OrderController.getOrderById);
router.put('/:id', OrderController.updateOrder);
router.delete('/:id', OrderController.deleteOrder);

export default router;
