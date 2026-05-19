import type { UserMaster } from '../types/userMaster';

export function mapApiEmployee(emp: Record<string, unknown>): UserMaster {
  const rawName = ((emp.name as string) || '').trim();
  const rawParts = rawName.split(/\s+/).filter(Boolean);
  const derivedFirst = rawParts[0] || '';
  const derivedLast = rawParts.length > 1 ? rawParts[rawParts.length - 1] : '';
  const fullName =
    rawName ||
    `${(emp.firstName as string) || (emp.first_name as string) || ''} ${(emp.lastName as string) || (emp.last_name as string) || ''}`.trim();
  return {
    employeeId: (emp.employeeId as string) || (emp.employeeCode as string) || (emp.employee_code as string) || '',
    employee_code:
      (emp.employeeCode as string) || (emp.employee_code as string) || (emp.employeeId as string) || '',
    employeeCode: (emp.employeeCode as string) || (emp.employee_code as string) || (emp.employeeId as string) || '',
    first_name: (emp.firstName as string) || (emp.first_name as string) || derivedFirst,
    firstName: (emp.firstName as string) || (emp.first_name as string) || derivedFirst,
    last_name: (emp.lastName as string) || (emp.last_name as string) || derivedLast,
    lastName: (emp.lastName as string) || (emp.last_name as string) || derivedLast,
    name: fullName,
    employee_name: fullName,
    designation: (emp.designation as string) || (emp.role as string) || '',
    date_of_joining: (emp.dateOfJoining as string) || (emp.date_of_joining as string) || '',
    dateOfJoining: (emp.dateOfJoining as string) || (emp.date_of_joining as string) || '',
    date_of_exit: (emp.dateOfExit as string) || (emp.date_of_exit as string) || '',
    dateOfExit: (emp.dateOfExit as string) || (emp.date_of_exit as string) || '',
    date_of_birth: (emp.dateOfBirth as string) || (emp.date_of_birth as string) || '',
    dateOfBirth: (emp.dateOfBirth as string) || (emp.date_of_birth as string) || '',
    gender: (emp.gender as string) || '',
    phone: (emp.phoneNumber as string) || (emp.phone as string) || '',
    phoneNumber: (emp.phoneNumber as string) || (emp.phone as string) || '',
    official_email: (emp.officialEmail as string) || (emp.official_email as string) || (emp.email as string) || '',
    officialEmail: (emp.officialEmail as string) || (emp.official_email as string) || (emp.email as string) || '',
    personal_email: (emp.personalEmail as string) || (emp.personal_email as string) || '',
    personalEmail: (emp.personalEmail as string) || (emp.personal_email as string) || '',
    aadhar_no: (emp.aadharNo as string) || (emp.aadhar_no as string) || '',
    aadharNo: (emp.aadharNo as string) || (emp.aadhar_no as string) || '',
    pan_no: (emp.panNo as string) || (emp.pan_no as string) || '',
    panNo: (emp.panNo as string) || (emp.pan_no as string) || '',
    account_no: (emp.accountNo as string) || (emp.account_no as string) || '',
    accountNo: (emp.accountNo as string) || (emp.account_no as string) || '',
    bank_name: (emp.bankName as string) || (emp.bank_name as string) || '',
    bankName: (emp.bankName as string) || (emp.bank_name as string) || '',
    ifsc: (emp.ifsc as string) || '',
    uan_no: (emp.uanNumber as string) || (emp.uan_no as string) || '',
    uanNumber: (emp.uanNumber as string) || (emp.uan_no as string) || '',
    emergency_contact: (emp.emergencyContact as string) || (emp.emergency_contact as string) || '',
    emergencyContact: (emp.emergencyContact as string) || (emp.emergency_contact as string) || '',
    address: (emp.address as string) || (emp.department as string) || '',
    department: (emp.department as string) || '',
    permanent_address: (emp.permanentAddress as string) || (emp.permanent_address as string) || '',
    permanentAddress: (emp.permanentAddress as string) || (emp.permanent_address as string) || '',
    biometric_code: (emp.biometricCode as string) || (emp.biometric_code as string) || '',
    biometricCode: (emp.biometricCode as string) || (emp.biometric_code as string) || '',
    biometric_password: (emp.biometricPassword as string) || (emp.biometric_password as string) || '',
    biometricPassword: (emp.biometricPassword as string) || (emp.biometric_password as string) || '',
    passport_no: (emp.passportNo as string) || (emp.passport_no as string) || '',
    passportNo: (emp.passportNo as string) || (emp.passport_no as string) || '',
    medi_claim_no: (emp.mediClaimNo as string) || (emp.medi_claim_no as string) || '',
    mediClaimNo: (emp.mediClaimNo as string) || (emp.medi_claim_no as string) || '',
    location: (emp.location as string) || '',
    documentsUrl: (emp.documentsUrl as string) || '',
    pastExperienceUrl: (emp.pastExperienceUrl as string) || '',
    profilePhotoUrl: (emp.profilePhotoUrl as string) || '',
    corporateId: (emp.corporateId as string) || '',
    password: '',
  };
}
