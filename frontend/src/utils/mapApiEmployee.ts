import type { EmployeeListDto } from '../types/employeeListDto';
import type { UserMaster } from '../types/userMaster';

/** Maps GET /api/employees list/detail JSON (camelCase DTO) to UserMaster for tables/forms. */
export function mapApiEmployee(emp: EmployeeListDto | Record<string, unknown>): UserMaster {
  const row = emp as Record<string, unknown>;
  const rawName = ((row.name as string) || '').trim();
  const rawParts = rawName.split(/\s+/).filter(Boolean);
  const derivedFirst = rawParts[0] || '';
  const derivedLast = rawParts.length > 1 ? rawParts[rawParts.length - 1] : '';
  const fullName =
    rawName ||
    `${(row.firstName as string) || (row.first_name as string) || ''} ${(row.lastName as string) || (row.last_name as string) || ''}`.trim();
  const official =
    (row.officialEmail as string) || (row.official_email as string) || (row.email as string) || '';
  return {
    employeeId: (row.employeeId as string) || (row.employeeCode as string) || (row.employee_code as string) || '',
    employee_code:
      (row.employeeCode as string) || (row.employee_code as string) || (row.employeeId as string) || '',
    employeeCode: (row.employeeCode as string) || (row.employee_code as string) || (row.employeeId as string) || '',
    first_name: (row.firstName as string) || (row.first_name as string) || derivedFirst,
    firstName: (row.firstName as string) || (row.first_name as string) || derivedFirst,
    last_name: (row.lastName as string) || (row.last_name as string) || derivedLast,
    lastName: (row.lastName as string) || (row.last_name as string) || derivedLast,
    name: fullName,
    employee_name: fullName,
    designation: (row.designation as string) || (row.role as string) || '',
    date_of_joining: (row.dateOfJoining as string) || (row.date_of_joining as string) || '',
    dateOfJoining: (row.dateOfJoining as string) || (row.date_of_joining as string) || '',
    date_of_exit: (row.dateOfExit as string) || (row.date_of_exit as string) || '',
    dateOfExit: (row.dateOfExit as string) || (row.date_of_exit as string) || '',
    date_of_birth: (row.dateOfBirth as string) || (row.date_of_birth as string) || '',
    dateOfBirth: (row.dateOfBirth as string) || (row.date_of_birth as string) || '',
    gender: (row.gender as string) || '',
    phone: (row.phoneNumber as string) || (row.phone as string) || '',
    phoneNumber: (row.phoneNumber as string) || (row.phone as string) || '',
    official_email: official,
    officialEmail: official,
    personal_email: (row.personalEmail as string) || (row.personal_email as string) || '',
    personalEmail: (row.personalEmail as string) || (row.personal_email as string) || '',
    aadhar_no: (row.aadharNo as string) || (row.aadhar_no as string) || '',
    aadharNo: (row.aadharNo as string) || (row.aadhar_no as string) || '',
    pan_no: (row.panNo as string) || (row.pan_no as string) || '',
    panNo: (row.panNo as string) || (row.pan_no as string) || '',
    account_no: (row.accountNo as string) || (row.account_no as string) || '',
    accountNo: (row.accountNo as string) || (row.account_no as string) || '',
    bank_name: (row.bankName as string) || (row.bank_name as string) || '',
    bankName: (row.bankName as string) || (row.bank_name as string) || '',
    ifsc: (row.ifsc as string) || '',
    uan_no: (row.uanNumber as string) || (row.uan_no as string) || '',
    uanNumber: (row.uanNumber as string) || (row.uan_no as string) || '',
    emergency_contact: (row.emergencyContact as string) || (row.emergency_contact as string) || '',
    emergencyContact: (row.emergencyContact as string) || (row.emergency_contact as string) || '',
    address: (row.address as string) || '',
    department: (row.department as string) || '',
    permanent_address: (row.permanentAddress as string) || (row.permanent_address as string) || '',
    permanentAddress: (row.permanentAddress as string) || (row.permanent_address as string) || '',
    biometric_code: (row.biometricCode as string) || (row.biometric_code as string) || '',
    biometricCode: (row.biometricCode as string) || (row.biometric_code as string) || '',
    biometric_password: (row.biometricPassword as string) || (row.biometric_password as string) || '',
    biometricPassword: (row.biometricPassword as string) || (row.biometric_password as string) || '',
    passport_no: (row.passportNo as string) || (row.passport_no as string) || '',
    passportNo: (row.passportNo as string) || (row.passport_no as string) || '',
    medi_claim_no: (row.mediClaimNo as string) || (row.medi_claim_no as string) || '',
    mediClaimNo: (row.mediClaimNo as string) || (row.medi_claim_no as string) || '',
    location: (row.location as string) || '',
    documentsUrl: (row.documentsUrl as string) || (row.documents_url as string) || '',
    pastExperienceUrl: (row.pastExperienceUrl as string) || (row.past_experience_url as string) || '',
    profilePhotoUrl:
      (row.profilePhotoUrl as string) || (row.profile_photo_url as string) || (row.profilePhoto as string) || '',
    corporateId: (row.corporateId as string) || (row.corporate_id as string) || '',
    imported: row.imported as boolean | undefined,
    password: '',
  };
}
