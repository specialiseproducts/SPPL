import * as AccessService from '../services/accessControl.service.js';

export const getAll = async (req, res, next) => {
  try {
    const data = await AccessService.getAllAccessControl();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getByEmployeeCode = async (req, res, next) => {
  try {
    const data = await AccessService.getAccessControlByCode(req.params.employeeCode);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const data = await AccessService.createAccessControl(req.body, req.user);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const data = await AccessService.updateAccessControl(req.params.employeeCode, req.body, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const data = await AccessService.deleteAccessControl(req.params.employeeCode, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

