/**
 * Sales Forecast Service
 *
 * Business logic layer for sales forecasting operations.
 */

import * as SalesForecastsModel from '../models/SalesForecasts.js';
import { buildAuditFields } from '../utils/audit.js';
import { canAccessAllRecords, isOwnedByUser } from '../utils/accessControl.js';
import { withApprovalDefaults } from '../utils/approval.js';
import { buildSoftDeleteFields } from '../utils/softDelete.js';
import { logActivity } from '../utils/activityLogger.js';
import log from '../utils/logger.js';

export const createSalesForecast = async (forecastData, authUser = null) => {
  try {
    if (!forecastData?.quotationRef) {
      throw new Error('quotationRef is required');
    }
    if (!forecastData?.quotationDate) {
      throw new Error('quotationDate is required');
    }
    if (Number.isNaN(Number(forecastData?.unitPrice)) || Number.isNaN(Number(forecastData?.qty))) {
      throw new Error('unitPrice and qty must be numbers');
    }

    const auditFields = authUser ? buildAuditFields(authUser) : {};
    const payload = {
      ...withApprovalDefaults(forecastData),
      ...auditFields,
      createdAt: forecastData.createdAt || auditFields.created_at || undefined,
      updatedAt: auditFields.updated_at || undefined,
    };

    log.info('Creating sales forecast:', payload);
    const created = await SalesForecastsModel.createSalesForecast(payload);
    await logActivity({
      actorEmployeeCode: authUser?.employeeCode || '',
      actorName: authUser?.fullName || '',
      actorRole: authUser?.role || '',
      module: 'salesForecasting',
      actionType: 'CREATE',
      targetEntity: 'salesForecast',
      targetId: created.forecastId,
    });
    return created;
  } catch (error) {
    log.error('Error creating sales forecast:', error);
    throw error;
  }
};

export const getAllSalesForecasts = async (authUser = null, effectiveRole = 'User') => {
  try {
    log.info('Getting all sales forecasts');
    const rows = await SalesForecastsModel.getAllSalesForecasts();
    if (!authUser || canAccessAllRecords(effectiveRole)) {
      return rows;
    }
    return rows.filter((row) => isOwnedByUser(row, authUser));
  } catch (error) {
    log.error('Error getting sales forecasts:', error);
    throw error;
  }
};

export const updateSalesForecast = async (forecastId, updateData, authUser = null, effectiveRole = 'User') => {
  try {
    if (!forecastId) {
      throw new Error('forecastId is required');
    }
    if (updateData?.unitPrice !== undefined && Number.isNaN(Number(updateData.unitPrice))) {
      throw new Error('unitPrice must be a number');
    }
    if (updateData?.qty !== undefined && Number.isNaN(Number(updateData.qty))) {
      throw new Error('qty must be a number');
    }

    const rows = await SalesForecastsModel.getAllSalesForecasts();
    const existing = rows.find((row) => row.forecastId === forecastId);
    if (!existing) {
      throw new Error('Sales forecast not found');
    }
    if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(existing, authUser)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    log.info('Updating sales forecast:', forecastId);
    const updated = await SalesForecastsModel.updateSalesForecast(forecastId, updateData);
    await logActivity({
      actorEmployeeCode: authUser?.employeeCode || '',
      actorName: authUser?.fullName || '',
      actorRole: authUser?.role || '',
      module: 'salesForecasting',
      actionType: 'UPDATE',
      targetEntity: 'salesForecast',
      targetId: forecastId,
    });
    return updated;
  } catch (error) {
    log.error('Error updating sales forecast:', error);
    throw error;
  }
};

export const deleteSalesForecast = async (forecastId, authUser = null, effectiveRole = 'User') => {
  try {
    if (!forecastId) {
      throw new Error('forecastId is required');
    }

    const rows = await SalesForecastsModel.getAllSalesForecasts();
    const existing = rows.find((row) => row.forecastId === forecastId);
    if (!existing) {
      throw new Error('Sales forecast not found');
    }
    if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(existing, authUser)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    log.info('Deleting sales forecast:', forecastId);
    const deleted = await SalesForecastsModel.updateSalesForecast(forecastId, buildSoftDeleteFields(authUser));
    await logActivity({
      actorEmployeeCode: authUser?.employeeCode || '',
      actorName: authUser?.fullName || '',
      actorRole: authUser?.role || '',
      module: 'salesForecasting',
      actionType: 'DELETE',
      targetEntity: 'salesForecast',
      targetId: forecastId,
    });
    return deleted;
  } catch (error) {
    log.error('Error deleting sales forecast:', error);
    throw error;
  }
};


