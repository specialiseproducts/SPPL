/**
 * Employee Service
 *
 * Business logic layer for employee management operations.
 */

import * as EmployeeModel from '../models/EmployeeMaster.js';
import { generateEmployeePassword } from '../utils/userPassword.util.js';
import { buildAuditFields } from '../utils/audit.js';
import { canAccessAllRecords, isOwnedByUser } from '../utils/accessControl.js';
import { logActivity } from '../utils/activityLogger.js';
import { buildSoftDeleteFields } from '../utils/softDelete.js';
import { withApprovalDefaults } from '../utils/approval.js';
import log from '../utils/logger.js';

export const CORPORATE_ID = 'SpecialisePdt';

const LOCATION_VALUES = new Set(['Office', 'Factory']);
const GENDER_VALUES = new Set(['Male', 'Female']);

/**
 * Normalize incoming API / multipart body to DynamoDB-oriented fields (camelCase).
 */
export function normalizeEmployeePayload(raw = {}, { isUpdate = false } = {}) {
  const get = (camel, snake) => {
    const keys = [camel, snake].filter(Boolean);
    for (const k of keys) {
      if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
      const val = raw[k];
      if (val === undefined || val === null) continue;
      const s = String(val).trim();
      if (s === '') return isUpdate ? '' : undefined;
      return s;
    }
    return undefined;
  };

  const out = {};

  const employeeCode = get('employeeCode', 'employee_code');
  if (employeeCode !== undefined) out.employeeCode = employeeCode;

  const firstName = get('firstName', 'first_name');
  if (firstName !== undefined) out.firstName = firstName;

  const lastName = get('lastName', 'last_name');
  if (lastName !== undefined) out.lastName = lastName;

  const name = get('name');
  if (name !== undefined) out.name = name;
  if (!out.firstName && name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length > 0) out.firstName = parts[0];
    if (parts.length > 1) out.lastName = parts[parts.length - 1];
  }

  const designation = get('designation');
  if (designation !== undefined) out.designation = designation;

  const dateOfJoining = get('dateOfJoining', 'date_of_joining');
  if (dateOfJoining !== undefined) out.dateOfJoining = dateOfJoining;

  const dateOfExit = get('dateOfExit', 'date_of_exit');
  if (dateOfExit !== undefined) out.dateOfExit = dateOfExit;

  const dateOfBirth = get('dateOfBirth', 'date_of_birth');
  if (dateOfBirth !== undefined) {
    if (dateOfBirth === '') {
      if (isUpdate) out.dateOfBirth = '';
    } else {
      const dobDate = new Date(dateOfBirth);
      if (Number.isNaN(dobDate.getTime())) {
        throw new Error('dateOfBirth must be a valid date');
      }
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (dobDate > now) {
        throw new Error('dateOfBirth cannot be in the future');
      }
      out.dateOfBirth = dateOfBirth;
    }
  }

  const gender = get('gender');
  if (gender !== undefined) {
    if (gender === '') {
      if (isUpdate) out.gender = '';
    } else if (GENDER_VALUES.has(gender)) {
      out.gender = gender;
    } else {
      throw new Error('gender must be Male or Female when provided');
    }
  }

  const phoneNumber = get('phoneNumber', 'phone');
  if (phoneNumber !== undefined) out.phoneNumber = phoneNumber;

  const officialEmail = get('officialEmail', 'official_email');
  if (officialEmail !== undefined) out.officialEmail = officialEmail;

  const personalEmail = get('personalEmail', 'personal_email');
  if (personalEmail !== undefined) out.personalEmail = personalEmail;

  const aadharNo = get('aadharNo', 'aadhar_no');
  if (aadharNo !== undefined) out.aadharNo = aadharNo;

  const panNo = get('panNo', 'pan_no');
  if (panNo !== undefined) out.panNo = panNo;

  const accountNo = get('accountNo', 'account_no');
  if (accountNo !== undefined) out.accountNo = accountNo;

  const bankName = get('bankName', 'bank_name');
  if (bankName !== undefined) out.bankName = bankName;

  const ifsc = get('ifsc');
  if (ifsc !== undefined) out.ifsc = ifsc;

  const uanNumber = get('uanNumber', 'uan_no');
  if (uanNumber !== undefined) out.uanNumber = uanNumber;

  const emergencyContact = get('emergencyContact', 'emergency_contact');
  if (emergencyContact !== undefined) out.emergencyContact = emergencyContact;

  const address = get('address');
  if (address !== undefined) out.address = address;

  const biometricCode = get('biometricCode', 'biometric_code');
  if (biometricCode !== undefined) out.biometricCode = biometricCode;

  const biometricPassword = get('biometricPassword', 'biometric_password');
  if (biometricPassword !== undefined) out.biometricPassword = biometricPassword;

  const passportNo = get('passportNo', 'passport_no');
  if (passportNo !== undefined) out.passportNo = passportNo;

  const mediClaimNo = get('mediClaimNo', 'medi_claim_no');
  if (mediClaimNo !== undefined) out.mediClaimNo = mediClaimNo;

  const permanentAddress = get('permanentAddress', 'permanent_address');
  if (permanentAddress !== undefined) out.permanentAddress = permanentAddress;

  const loc = get('location');
  if (loc !== undefined) {
    if (loc === '') {
      if (isUpdate) out.location = '';
    } else if (LOCATION_VALUES.has(loc)) {
      out.location = loc;
    } else {
      throw new Error('location must be Office or Factory when provided');
    }
  }

  const documentsUrl = get('documentsUrl', 'documents_url');
  if (documentsUrl !== undefined) out.documentsUrl = documentsUrl;

  const pastExperienceUrl = get('pastExperienceUrl', 'past_experience_url');
  if (pastExperienceUrl !== undefined) out.pastExperienceUrl = pastExperienceUrl;

  const profilePhotoUrl = get('profilePhotoUrl', 'profile_photo_url');
  if (profilePhotoUrl !== undefined) out.profilePhotoUrl = profilePhotoUrl;

  return out;
}

export const getEmployeeById = async (employeeId, authUser = null, effectiveRole = 'User') => {
  try {
    if (!employeeId) {
      throw new Error('employeeId is required');
    }
    const decoded = decodeURIComponent(employeeId);
    log.info('Getting employee:', decoded);
    const item = await EmployeeModel.getEmployeeById(decoded);
    if (!item) {
      const err = new Error('Employee not found');
      err.statusCode = 404;
      throw err;
    }
    if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(item, authUser)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    return item;
  } catch (error) {
    log.error('Error getting employee:', error);
    throw error;
  }
};

export const getAllEmployees = async (filters = {}, options = {}, authUser = null, effectiveRole = 'User') => {
  try {
    log.info('Getting all employees');
    const result = await EmployeeModel.getAllEmployees(options);
    if (!authUser || canAccessAllRecords(effectiveRole)) {
      return result;
    }
    return {
      ...result,
      items: (result.items || []).filter((item) => isOwnedByUser(item, authUser)),
    };
  } catch (error) {
    log.error('Error getting employees:', error);
    throw error;
  }
};

export const createEmployee = async (employeeData, authUser) => {
  try {
    // TODO: TEMP DEV MODE — restore bcrypt before production.
    const normalized = normalizeEmployeePayload(employeeData, { isUpdate: false });

    if (!normalized.firstName) {
      throw new Error('firstName is required');
    }
    if (!normalized.lastName) {
      throw new Error('lastName is required');
    }
    if (!normalized.employeeCode) {
      throw new Error('employeeCode is required');
    }

    delete normalized.password;
    delete normalized.corporateId;
    delete normalized.employeeId;

    const password = generateEmployeePassword(
      normalized.firstName,
      normalized.lastName,
      normalized.biometricCode || ''
    );
    const payload = {
      ...withApprovalDefaults(normalized),
      ...(authUser ? buildAuditFields(authUser) : {}),
      name: `${normalized.firstName} ${normalized.lastName}`.trim(),
      corporateId: CORPORATE_ID,
      password,
      profilePhoto: normalized.profilePhotoUrl || '',
    };

    log.info('Creating employee:', normalized.employeeCode);
    const created = await EmployeeModel.createEmployee(payload);
    await logActivity({
      actorEmployeeCode: authUser?.employeeCode || '',
      actorName: authUser?.fullName || '',
      actorRole: authUser?.role || '',
      module: 'userManagement',
      actionType: 'CREATE',
      targetEntity: 'employee',
      targetId: created.employeeId,
      newValue: { employeeCode: created.employeeCode },
    });
    return { ...created, password };
  } catch (error) {
    log.error('Error creating employee:', error);
    throw error;
  }
};

export const updateEmployee = async (employeeId, updateData, userId, authUser = null, effectiveRole = 'User') => {
  try {
    if (!employeeId) {
      throw new Error('employeeId is required');
    }
    const decoded = decodeURIComponent(employeeId);
    const normalized = normalizeEmployeePayload(updateData, { isUpdate: true });
    const existing = await EmployeeModel.getEmployeeById(decoded);

    if (!existing) {
      throw new Error('Employee not found');
    }
    if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(existing, authUser)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    delete normalized.password;
    delete normalized.corporateId;
    delete normalized.employeeId;
    delete normalized.employeeCode;

    const mergedFirstName = normalized.firstName ?? existing?.firstName ?? '';
    const mergedLastName = normalized.lastName ?? existing?.lastName ?? '';
    const fullName = `${mergedFirstName} ${mergedLastName}`.trim();

    log.info('Updating employee:', decoded);
    const updated = await EmployeeModel.updateEmployee(decoded, {
      ...normalized,
      ...(fullName ? { name: fullName } : {}),
      corporateId: CORPORATE_ID,
      ...(normalized.profilePhotoUrl !== undefined ? { profilePhoto: normalized.profilePhotoUrl } : {}),
    });
    await logActivity({
      actorEmployeeCode: authUser?.employeeCode || '',
      actorName: authUser?.fullName || '',
      actorRole: authUser?.role || '',
      module: 'userManagement',
      actionType: 'UPDATE',
      targetEntity: 'employee',
      targetId: decoded,
    });
    return updated;
  } catch (error) {
    log.error('Error updating employee:', error);
    throw error;
  }
};

export const deleteEmployee = async (employeeId, userId, authUser = null, effectiveRole = 'User') => {
  try {
    if (!employeeId) {
      throw new Error('employeeId is required');
    }
    const decoded = decodeURIComponent(employeeId);
    const existing = await EmployeeModel.getEmployeeById(decoded);
    if (!existing) {
      throw new Error('Employee not found');
    }
    if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(existing, authUser)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
    log.info('Deleting employee:', decoded);
    const deleted = await EmployeeModel.updateEmployee(decoded, buildSoftDeleteFields(authUser));
    await logActivity({
      actorEmployeeCode: authUser?.employeeCode || '',
      actorName: authUser?.fullName || '',
      actorRole: authUser?.role || '',
      module: 'userManagement',
      actionType: 'DELETE',
      targetEntity: 'employee',
      targetId: decoded,
    });
    return deleted;
  } catch (error) {
    log.error('Error deleting employee:', error);
    throw error;
  }
};
