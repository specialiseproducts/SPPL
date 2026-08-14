import { Card } from './ui/card';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { apiFetch } from '../services/api';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import type { UserMaster } from './UserCreationTab';
import PlanningPerformanceCard from './dailyPlanner/PlanningPerformanceCard';
import PlanningHistorySection from './dailyPlanner/PlanningHistorySection';
import NotificationPreferencesPanel from './notifications/NotificationPreferencesPanel';
import {
  useEmployeePlanningProfileQuery,
  useMyPlanningProfileQuery,
} from '../hooks/dailyPlanner/useDailyPlannerQueries';

type ProfileValue = string | undefined | null;

type ProfileRow = {
  label: string;
  value: ProfileValue;
};

type ProfileSection = {
  title: string;
  rows: ProfileRow[];
};

function profileValue(value?: string | null) {
  return value && String(value).trim()
    ? String(value)
    : 'Not Available';
}

function initials(name?: string) {
  if (!name) return 'NA';

  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() || '')
    .slice(0, 2)
    .join('');
}

interface ProfilePageProps {
  onBack?: () => void;
  employee?: UserMaster | null;
  isSelfProfile?: boolean;
}

export default function ProfilePage({ onBack, employee, isSelfProfile = true }: ProfilePageProps) {
  const { user, accessControl } = useAuth();
  const [photoFailed, setPhotoFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const profileEmployee = employee || null;
  const employeeCode = String(
    profileEmployee?.employeeCode ||
      profileEmployee?.employee_code ||
      user?.employeeCode ||
      '',
  ).trim();
  const selfPlanningQuery = useMyPlanningProfileQuery(isSelfProfile && !!user && !!employeeCode);
  const employeePlanningQuery = useEmployeePlanningProfileQuery(
    employeeCode,
    !isSelfProfile && !!user && !!employeeCode,
  );
  const planningProfileQuery = isSelfProfile ? selfPlanningQuery : employeePlanningQuery;

  if (!user) return null;

  const effectiveProfile = {
    firstName: profileEmployee?.firstName || profileEmployee?.first_name || user.firstName,
    lastName: profileEmployee?.lastName || profileEmployee?.last_name || user.lastName,
    employeeCode: profileEmployee?.employeeCode || profileEmployee?.employee_code || user.employeeCode,
    corporateId: profileEmployee?.corporateId || user.corporateId,
    designation: profileEmployee?.designation || user.designation,
    officialEmail: profileEmployee?.officialEmail || profileEmployee?.official_email || user.officialEmail,
    dateOfJoining: profileEmployee?.dateOfJoining || profileEmployee?.date_of_joining || user.dateOfJoining,
    dateOfExit: profileEmployee?.dateOfExit || profileEmployee?.date_of_exit || user.dateOfExit,
    dateOfBirth: profileEmployee?.dateOfBirth || profileEmployee?.date_of_birth || user.dateOfBirth,
    gender: profileEmployee?.gender || user.gender,
    location: profileEmployee?.location || user.location,
    biometricCode: profileEmployee?.biometricCode || profileEmployee?.biometric_code || user.biometricCode,
    biometricPassword: profileEmployee?.biometricPassword || profileEmployee?.biometric_password || user.biometricPassword,
    phoneNumber: profileEmployee?.phoneNumber || profileEmployee?.phone || user.phoneNumber,
    personalEmail: profileEmployee?.personalEmail || profileEmployee?.personal_email || user.personalEmail,
    panNo: profileEmployee?.panNo || profileEmployee?.pan_no || user.panNo,
    aadharNo: profileEmployee?.aadharNo || profileEmployee?.aadhar_no || user.aadharNo,
    passportNo: profileEmployee?.passportNo || profileEmployee?.passport_no || user.passportNo,
    uanNumber: profileEmployee?.uanNumber || profileEmployee?.uan_no || user.uanNumber,
    mediClaimNo: profileEmployee?.mediClaimNo || profileEmployee?.medi_claim_no || user.mediClaimNo,
    accountNo: profileEmployee?.accountNo || profileEmployee?.account_no || user.accountNo,
    bankName: profileEmployee?.bankName || profileEmployee?.bank_name || user.bankName,
    ifsc: profileEmployee?.ifsc || user.ifsc,
    address: profileEmployee?.address || user.address,
    permanentAddress: profileEmployee?.permanentAddress || profileEmployee?.permanent_address || user.permanentAddress,
    profilePhoto: profileEmployee?.profilePhotoUrl || user.profilePhoto,
    documentsUrl: profileEmployee?.documentsUrl || user.documentsUrl,
    pastExperienceUrl: profileEmployee?.pastExperienceUrl || user.pastExperienceUrl,
    // Readable password mapping for self profile (dev flow).
    // Priority follows backend exposure order and legacy aliases.
    password: isSelfProfile ? ((user as any).password || '') : '',
    temporaryPassword: isSelfProfile ? ((user as any).temporaryPassword || '') : '',
    plainPassword: isSelfProfile ? ((user as any).plainPassword || '') : '',
    generatedPassword: isSelfProfile ? ((user as any).generatedPassword || '') : '',
  };

  const readablePassword = String(
    effectiveProfile.password ||
      effectiveProfile.temporaryPassword ||
      effectiveProfile.plainPassword ||
      effectiveProfile.generatedPassword ||
      ''
  ).trim();
  const hasReadablePassword = Boolean(readablePassword);

  const fullName =
    [effectiveProfile.firstName, effectiveProfile.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() || effectiveProfile.employeeCode || 'Employee';

  const extractKey = (value?: string) => {
    if (!value) return '';
    try {
      const u = new URL(value);
      return u.pathname.replace(/^\/+/, '');
    } catch {
      return value.replace(/^\/+/, '');
    }
  };

  const openSecureFile = async (rawUrl?: string) => {
    const key = extractKey(rawUrl);
    if (!key) return;
    try {
      const data = await apiFetch(`/api/users/file-url?key=${encodeURIComponent(key)}`);
      if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Unable to open file');
    }
  };

  const sections: ProfileSection[] = [
    {
      title: 'Personal Information',
      rows: [
        { label: 'First Name', value: effectiveProfile.firstName },
        { label: 'Last Name', value: effectiveProfile.lastName },
        { label: 'Phone Number', value: effectiveProfile.phoneNumber },
        { label: 'Official Email', value: effectiveProfile.officialEmail },
        { label: 'Personal Email', value: effectiveProfile.personalEmail },
        { label: 'Date of Birth', value: effectiveProfile.dateOfBirth },
        { label: 'Gender', value: effectiveProfile.gender },
      ],
    },
    {
      title: 'Company Information',
      rows: [
        { label: 'Employee Code', value: effectiveProfile.employeeCode },
        { label: 'Corporate ID', value: effectiveProfile.corporateId },
        { label: 'Password', value: '••••••••••' },
        { label: 'Designation', value: effectiveProfile.designation },
        { label: 'Official Email', value: effectiveProfile.officialEmail },
        { label: 'Date of Joining', value: effectiveProfile.dateOfJoining },
        { label: 'Date of Exit', value: effectiveProfile.dateOfExit },
        { label: 'Location', value: effectiveProfile.location },
        { label: 'Biometric Code', value: effectiveProfile.biometricCode },
        { label: 'Biometric Password', value: effectiveProfile.biometricPassword },
        
      ],
    },
    {
      title: 'Government & HR',
      rows: [
        { label: 'PAN No.', value: effectiveProfile.panNo },
        { label: 'Aadhar No.', value: effectiveProfile.aadharNo },
        { label: 'Passport No.', value: effectiveProfile.passportNo },
        { label: 'UAN Number', value: effectiveProfile.uanNumber },
        { label: 'Medi Claim No.', value: effectiveProfile.mediClaimNo },
      ],
    },
    {
      title: 'Bank Details',
      rows: [
        { label: 'Account Number', value: effectiveProfile.accountNo },
        { label: 'Bank Name', value: effectiveProfile.bankName },
        { label: 'IFSC Code', value: effectiveProfile.ifsc },
      ],
    },
    {
      title: 'Address Details',
      rows: [
        { label: 'Current Address', value: effectiveProfile.address },
        { label: 'Permanent Address', value: effectiveProfile.permanentAddress },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {effectiveProfile.profilePhoto && !photoFailed ? (
              <img src={effectiveProfile.profilePhoto} alt={fullName} className="w-16 h-16 rounded-full object-cover border" onError={() => setPhotoFailed(true)} />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#007BFF] text-white flex items-center justify-center">{initials(fullName)}</div>
            )}
            <div>
              <h2 className="text-[#212529]">{fullName}</h2>
              <p className="text-gray-600">{profileValue(effectiveProfile.designation)} | {profileValue(effectiveProfile.employeeCode)}</p>
              <p className="text-sm text-gray-500">{profileValue(effectiveProfile.officialEmail)}</p>
            </div>
          </div>
          {onBack ? (
            <Button
              onClick={onBack}
              className="bg-[#007BFF] hover:bg-[#0056b3] text-white"
            >
              Back
            </Button>
          ) : null}
        </div>
      </Card>

      {sections.map((section) => (
        <Card key={section.title} className="p-6">
          <h3 className="text-[#212529] mb-4">{section.title}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.rows.map((row) => (
              <div key={row.label}>
                <p className="text-xs text-gray-500">{row.label}</p>
                {row.label === 'Password' ? (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-[#212529] leading-none">
                      {hasReadablePassword
                        ? (showPassword ? readablePassword : '••••••••••')
                        : 'Not Available'}
                    </p>
                    {hasReadablePassword ? (
                      <button
                        type="button"
                        className="text-gray-500 disabled:text-gray-300"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-[#212529]">{profileValue(row.value)}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}

      {isSelfProfile ? <NotificationPreferencesPanel /> : null}

      {employeeCode && !planningProfileQuery.isError ? (
        <PlanningPerformanceCard
          variant="profile"
          record={planningProfileQuery.data?.currentMonth}
          loading={planningProfileQuery.isLoading}
        />
      ) : null}

      {employeeCode && !planningProfileQuery.isError ? (
        <PlanningHistorySection
          employeeCode={isSelfProfile ? 'me' : employeeCode}
          enabled={!!employeeCode}
        />
      ) : null}

      <Card className="p-6">
        <h3 className="text-[#212529] mb-4">Access Control</h3>
        <div className="space-y-2">
          <div className="text-sm"><span className="text-gray-600">Global Role:</span> {profileValue(String(accessControl?.globalRole || user.role))}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(
              (accessControl?.moduleOverrides || {}) as Record<string, string>
            ).length > 0 ? Object.entries(
              (accessControl?.moduleOverrides || {}) as Record<string, string>
            ).map(([module, role]) => (
              <span key={module} className="px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-700">{module} {'->'} {String(role)}</span>
            )) : <span className="text-sm text-gray-500">No module overrides</span>}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-[#212529] mb-4">Documents</h3>
        <div className="space-y-3">
          <div className="flex gap-2 items-center"><span className="text-sm text-gray-600 w-44">Documents</span>{effectiveProfile.documentsUrl ? <Button variant="outline" className="h-8 px-3" onClick={() => openSecureFile(effectiveProfile.documentsUrl)}>View</Button> : <span>Not Available</span>}</div>
          <div className="flex gap-2 items-center"><span className="text-sm text-gray-600 w-44">Past Experience</span>{effectiveProfile.pastExperienceUrl ? <Button variant="outline" className="h-8 px-3" onClick={() => openSecureFile(effectiveProfile.pastExperienceUrl)}>View</Button> : <span>Not Available</span>}</div>
          <div className="flex gap-2 items-center"><span className="text-sm text-gray-600 w-44">Profile Photo</span>{effectiveProfile.profilePhoto ? <Button variant="outline" className="h-8 px-3" onClick={() => openSecureFile(effectiveProfile.profilePhoto)}>View</Button> : <span>Not Available</span>}</div>
        </div>
      </Card>
    </div>
  );
}

