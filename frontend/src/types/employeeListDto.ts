/**
 * Paginated list payload from GET /api/employees (see backend toEmployeeListDto).
 * CamelCase only — mapApiEmployee normalizes into UserMaster for UI.
 */
export interface EmployeeListDto {
  employeeId?: string;
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  designation?: string;
  department?: string;
  role?: string;
  location?: string;
  corporateId?: string;
  dateOfJoining?: string;
  dateOfExit?: string;
  dateOfBirth?: string;
  gender?: string;
  phoneNumber?: string;
  officialEmail?: string;
  personalEmail?: string;
  aadharNo?: string;
  panNo?: string;
  accountNo?: string;
  bankName?: string;
  ifsc?: string;
  uanNumber?: string;
  emergencyContact?: string;
  address?: string;
  permanentAddress?: string;
  biometricCode?: string;
  biometricPassword?: string;
  passportNo?: string;
  mediClaimNo?: string;
  documentsUrl?: string;
  pastExperienceUrl?: string;
  profilePhotoUrl?: string;
  approval_status?: string;
  is_deleted?: boolean;
  imported?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
