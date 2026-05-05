/**
 * Sales Forecast Controller
 * 
 * Handles HTTP requests/responses for sales forecasting endpoints.
 */

import * as SalesForecastService from '../services/salesForecast.service.js';
import log from '../utils/logger.js';

/**
 * Get sales forecast by ID
 * GET /api/sales-forecasts/:id
 */
export const getSalesForecastById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const forecast = await SalesForecastService.getSalesForecastById(id);

    res.status(200).json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    log.error('Get sales forecast controller error:', error);
    next(error);
  }
};

/**
 * Get all sales forecasts
 * GET /api/sales-forecasts
 */
export const getSalesForecasts = async (req, res, next) => {
  try {
    const filters = req.query;
    const options = {
      limit: parseInt(req.query.limit) || 50,
      lastKey: req.query.lastKey,
    };

    const result = await SalesForecastService.getSalesForecasts(filters, options);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('Get sales forecasts controller error:', error);
    next(error);
  }
};

/**
 * Create new sales forecast
 * POST /api/sales-forecasts
 */
export const createSalesForecast = async (req, res, next) => {
  try {
    const forecastData = req.body;
    const userId = req.user?.id; // From auth middleware

    const forecast = await SalesForecastService.createSalesForecast(forecastData, userId);

    res.status(201).json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    log.error('Create sales forecast controller error:', error);
    next(error);
  }
};

/**
 * Update sales forecast
 * PUT /api/sales-forecasts/:id
 */
export const updateSalesForecast = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user?.id; // From auth middleware

    const forecast = await SalesForecastService.updateSalesForecast(id, updateData, userId);

    res.status(200).json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    log.error('Update sales forecast controller error:', error);
    next(error);
  }
};

/**
 * Delete sales forecast
 * DELETE /api/sales-forecasts/:id
 */
export const deleteSalesForecast = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // From auth middleware

    await SalesForecastService.deleteSalesForecast(id, userId);

    res.status(200).json({
      success: true,
      message: 'Sales forecast deleted successfully',
    });
  } catch (error) {
    log.error('Delete sales forecast controller error:', error);
    next(error);
  }
};


