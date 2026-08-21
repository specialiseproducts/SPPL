/**
 * Authentication Service
 *
 * Business logic layer for authentication operations.
 */

import * as EmployeeModel from '../models/EmployeeMaster.js';
import * as UserAccessControlModel from '../models/UserAccessControl.js';
import { generateToken, verifyToken as verifyJwtToken } from '../utils/jwt.js';
import {
  comparePassword,
  hashPassword,
} from '../utils/password.js';
import { validateNewPasswordPolicy } from '../utils/passwordReset.js';
import { isDeveloper, isAdmin } from '../utils/accessControl.js';
import { logActivity } from '../utils/activityLogger.js';
import { generateEmployeePassword } from '../utils/userPassword.util.js';
import log from '../utils/logger.js';

const DEFAULT_ACCESS_CONTROL = {
  globalRole: 'User',
  moduleOverrides: {},
};

function buildAutoTemporaryPassword(employeeCode) {
  const code = String(employeeCode || '').replace(/\s+/g, '');
  return `Temp@${code}`;
}

async function ensureReadablePasswordField(employee) {
  if (!employee?.employeeId || !employee?.employeeCode) return employee;
  const hasTemporary = Boolean(String(employee.temporaryPassword || '').trim());
  const hasPlain = Boolean(String(employee.plainPassword || '').trim());
  if (hasTemporary || hasPlain) return employee;

  const generated = buildAutoTemporaryPassword(employee.employeeCode);
  await EmployeeModel.updateEmployee(employee.employeeId, {
    temporaryPassword: generated,
  });
  return {
    ...employee,
    temporaryPassword: generated,
  };
}

function sanitizeUser(employee) {
  // TODO: TEMP DEV MODE — restore bcrypt-safe response (remove password) before production.
  return {
    employeeCode: employee.employeeCode || '',
    firstName: employee.firstName || '',
    lastName: employee.lastName || '',
    officialEmail: employee.officialEmail || '',
    designation: employee.designation || '',
    profilePhoto: employee.profilePhotoUrl || employee.profilePhoto || '',
    corporateId: employee.corporateId || '',
    phoneNumber: employee.phoneNumber || '',
    personalEmail: employee.personalEmail || '',
    emergencyContact: employee.emergencyContact || '',
    dateOfJoining: employee.dateOfJoining || '',
    dateOfExit: employee.dateOfExit || '',
    dateOfBirth: employee.dateOfBirth || '',
    gender: employee.gender || '',
    location: employee.location || '',
    aadharNo: employee.aadharNo || '',
    panNo: employee.panNo || '',
    passportNo: employee.passportNo || '',
    uanNumber: employee.uanNumber || '',
    mediClaimNo: employee.mediClaimNo || '',
    biometricCode: employee.biometricCode || '',
    biometricPassword: employee.biometricPassword || '',
    accountNo: employee.accountNo || '',
    bankName: employee.bankName || '',
    ifsc: employee.ifsc || '',
    address: employee.address || '',
    permanentAddress: employee.permanentAddress || '',
    documentsUrl: employee.documentsUrl || '',
    pastExperienceUrl: employee.pastExperienceUrl || '',
    password: employee.password || '',
  };
}

async function getAccessControl(employeeCode) {
  const accessControl = await UserAccessControlModel.getByEmployeeCode(employeeCode);
  if (!accessControl) {
    return { ...DEFAULT_ACCESS_CONTROL };
  }
  return {
    globalRole: accessControl.globalRole || 'User',
    moduleOverrides: accessControl.moduleOverrides || {},
  };
}

function invalidCredentialsError() {
  const err = new Error('Invalid employee ID or password');
  err.statusCode = 401;
  return err;
}

/**
 * Authenticate employee (login)
 * @param {{employeeCode: string, password: string}} payload
 */
export const login = async ({ employeeCode, password }) => {
  try {
    // TODO: TEMP DEV MODE — restore bcrypt validation before production.
    log.info('Login attempt for employee:', employeeCode);

    const code = String(employeeCode || '').trim();
    if (!code || !password) {
      throw invalidCredentialsError();
    }

    const employee = await EmployeeModel.getEmployeeByCode(code);
    if (!employee) {
      log.warn('Login failed - employee not found:', code);
      throw invalidCredentialsError();
    }

    const storedPassword = employee.password || '';
    if (!storedPassword) {
      log.warn('Login failed - password missing for:', code);
      throw invalidCredentialsError();
    }

    const passwordValid = await comparePassword(password, storedPassword);

    if (!passwordValid) {
      log.warn('Login failed - invalid password for:', code);
      throw invalidCredentialsError();
    }

    const accessControl = await getAccessControl(code);
    const token = generateToken({
      employeeCode: code,
      role: accessControl.globalRole || 'User',
    });

    log.info('Login success for employee:', code);
    await logActivity({
      actorEmployeeCode: code,
      actorName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
      actorRole: accessControl.globalRole || 'User',
      module: 'auth',
      actionType: 'LOGIN',
      targetEntity: 'session',
      targetId: code,
      newValue: { success: true },
    });
    return {
      token,
      user: sanitizeUser(employee),
      accessControl,
    };
  } catch (error) {
    log.error('Login error:', error);
    throw error;
  }
};

export const getMe = async (employeeCode) => {
  try {
    const code = String(employeeCode || '').trim();
    if (!code) {
      const err = new Error('Invalid token');
      err.statusCode = 401;
      throw err;
    }

    const employee = await EmployeeModel.getEmployeeByCode(code);
    if (!employee) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const hydratedEmployee = await ensureReadablePasswordField(employee);
    const accessControl = await getAccessControl(code);
    return {
      user: sanitizeUser(hydratedEmployee),
      accessControl,
    };
  } catch (error) {
    log.error('Get me error:', error);
    throw error;
  }
};

export const verifyToken = async (token) => {
  try {
    return verifyJwtToken(token);
  } catch (error) {
    log.error('Token verification error:', error);
    throw error;
  }
};

export const changePassword = async ({ employeeCode, newPassword, confirmPassword }) => {
  // Identity comes from JWT (controller); never trust a client-supplied employee target.
  const code = String(employeeCode || '').trim();
  const employee = await EmployeeModel.getEmployeeByCode(code);
  if (!employee) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const policy = validateNewPasswordPolicy(newPassword, confirmPassword);
  if (!policy.ok) {
    const err = new Error(policy.message);
    err.statusCode = 400;
    err.code = 'PASSWORD_POLICY';
    throw err;
  }

  // Same persistence strategy as login / forgot-password reset.
  const storedPassword = await hashPassword(String(newPassword));
  const patch = { password: storedPassword };
  // Keep Profile "readable password" fields in sync when present (dev/self display).
  if (String(employee.temporaryPassword || '').trim()) {
    patch.temporaryPassword = storedPassword;
  }
  if (String(employee.plainPassword || '').trim()) {
    patch.plainPassword = storedPassword;
  }

  await EmployeeModel.updateEmployee(employee.employeeId, patch);
  await logActivity({
    actorEmployeeCode: employee.employeeCode,
    actorName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
    actorRole: 'User',
    module: 'auth',
    actionType: 'PASSWORD_CHANGE',
    targetEntity: 'employee',
    targetId: employee.employeeId,
  });
  return { success: true };
};

export const resetPasswordByPrivilegedUser = async ({
  actor,
  targetEmployeeCode,
}) => {
  // TODO: TEMP DEV MODE — restore bcrypt hashing before production.
  const actorRole = String(actor?.role || 'User');
  if (!isDeveloper(actorRole) && !isAdmin(actorRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  const target = await EmployeeModel.getEmployeeByCode(String(targetEmployeeCode || '').trim());
  if (!target) {
    const err = new Error('Target user not found');
    err.statusCode = 404;
    throw err;
  }
  const targetAccess = await getAccessControl(target.employeeCode);
  const targetRole = String(targetAccess.globalRole || 'User');
  if (isAdmin(actorRole) && isDeveloper(targetRole)) {
    const err = new Error('Admin cannot reset Developer password');
    err.statusCode = 403;
    throw err;
  }
  const temporaryPassword = generateEmployeePassword(
    target.firstName || '',
    target.lastName || '',
    target.biometricCode || ''
  );
  await EmployeeModel.updateEmployee(target.employeeId, {
    password: temporaryPassword,
  });
  await logActivity({
    actorEmployeeCode: actor.employeeCode,
    actorName: actor.fullName,
    actorRole,
    module: 'userManagement',
    actionType: 'PASSWORD_RESET',
    targetEntity: 'employee',
    targetId: target.employeeId,
    metadata: { targetEmployeeCode: target.employeeCode },
  });
  return { success: true, password: temporaryPassword };
};


