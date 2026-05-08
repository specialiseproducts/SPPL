/**
 * Sales Forecast Controller
 *
 * Handles HTTP requests/responses for sales forecasting endpoints.
 */

import * as SalesForecastService from '../services/salesForecast.service.js';
import log from '../utils/logger.js';

export const getSalesForecasts = async (req, res, next) => {
  try {
    const forecasts = await SalesForecastService.getAllSalesForecasts(req.user, req.effectiveRole);

    res.status(200).json({
      success: true,
      data: forecasts,
    });
  } catch (error) {
    log.error('Get sales forecasts controller error:', error);
    next(error);
  }
};

export const createSalesForecast = async (req, res, next) => {
  try {
    const forecast = await SalesForecastService.createSalesForecast(req.body, req.user);

    res.status(201).json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    log.error('Create sales forecast controller error:', error);
    next(error);
  }
};

export const updateSalesForecast = async (req, res, next) => {
  try {
    const forecast = await SalesForecastService.updateSalesForecast(
      req.params.id,
      req.body,
      req.user,
      req.effectiveRole
    );

    res.status(200).json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    log.error('Update sales forecast controller error:', error);
    next(error);
  }
};

export const deleteSalesForecast = async (req, res, next) => {
  try {
    const result = await SalesForecastService.deleteSalesForecast(req.params.id, req.user, req.effectiveRole);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('Delete sales forecast controller error:', error);
    next(error);
  }
};


