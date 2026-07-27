/**
 * Order Processing Controller
 *
 * HTTP request handlers for order processing endpoints.
 */

import * as OrderService from '../services/orderProcessing.service.js';
import log from '../utils/logger.js';

export const getMyOrders = async (req, res, next) => {
  try {
    const orders = await OrderService.getMyOrders(req.user);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    log.error('Get my orders error:', error);
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const order = await OrderService.getOrderById(req.params.id, req.user, req.effectiveRole);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    log.error('Get order by id error:', error);
    next(error);
  }
};

export const createOrder = async (req, res, next) => {
  try {
    const order = await OrderService.createOrder(req.body, req.user);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    log.error('Create order error:', error);
    next(error);
  }
};

export const updateOrder = async (req, res, next) => {
  try {
    const order = await OrderService.updateOrder(req.params.id, req.body, req.user, req.effectiveRole);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    log.error('Update order error:', error);
    next(error);
  }
};

export const deleteOrder = async (req, res, next) => {
  try {
    await OrderService.deleteOrder(req.params.id, req.user, req.effectiveRole);
    res.status(200).json({ success: true, message: 'Order deleted' });
  } catch (error) {
    log.error('Delete order error:', error);
    next(error);
  }
};

export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    res.status(200).json({
      success: true,
      data: {
        fileName: req.file.originalname,
        fileUrl: req.file.location || req.file.key,
      },
    });
  } catch (error) {
    log.error('Upload order file error:', error);
    next(error);
  }
};
