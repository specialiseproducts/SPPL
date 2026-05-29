import { useState, useEffect, useCallback, useMemo } from 'react';
import { UserPlus, Edit, Trash2, Download, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import UserFormModal, { type UserFormFiles } from './UserFormModal';
import ImportUsersModal from './ImportUsersModal';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import type { UserRole } from '../App';
import { apiFetch } from '../services/api';
import {
  useEmployeesDirectoryRows,
  useInvalidateEmployeesList,
} from '../hooks/employees/useEmployeesQuery';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { isQueryColdLoading } from '../utils/queryLoading';

const API_BASE = '/api/employees';
const SIGNED_URL_ENDPOINT = '/api/users/file-url';

import type { UserMaster } from '../types/userMaster';

export type { UserMaster } from '../types/userMaster';

interface UserCreationTabProps {
  onEmployeeCodeClick?: (employee: UserMaster) => void;
}

export function buildEmployeeFormData(user: UserMaster, files?: UserFormFiles): FormData {
  const fd = new FormData();
  const set = (key: string, val: string | undefined) => {
    if (val === undefined || val === null) return;
    fd.append(key, String(val));
  };

  set('employeeCode', user.employee_code || user.employeeCode);
  set('firstName', user.first_name || user.firstName);
  set('lastName', user.last_name || user.lastName);
  set('name', user.name);
  set('designation', user.designation);
  set('dateOfJoining', user.date_of_joining || user.dateOfJoining);
  set('dateOfExit', user.date_of_exit || user.dateOfExit);
  set('dateOfBirth', user.date_of_birth || user.dateOfBirth);
  set('gender', user.gender);
  set('phoneNumber', user.phone || user.phoneNumber);
  set('officialEmail', user.official_email || user.officialEmail);
  set('personalEmail', user.personal_email || user.personalEmail);
  set('aadharNo', user.aadhar_no || user.aadharNo);
  set('panNo', user.pan_no || user.panNo);
  set('accountNo', user.account_no || user.accountNo);
  set('bankName', user.bank_name || user.bankName);
  set('ifsc', user.ifsc);
  set('uanNumber', user.uan_no || user.uanNumber);
  set('emergencyContact', user.emergency_contact || user.emergencyContact);
  set('address', user.address);
  set('permanentAddress', user.permanent_address || user.permanentAddress);
  set('biometricCode', user.biometric_code || user.biometricCode);
  set('biometricPassword', user.biometric_password || user.biometricPassword);
  set('passportNo', user.passport_no || user.passportNo);
  set('mediClaimNo', user.medi_claim_no || user.mediClaimNo);
  set('location', user.location);
  set('documentsUrl', user.documentsUrl);
  set('pastExperienceUrl', user.pastExperienceUrl);
  set('profilePhotoUrl', user.profilePhotoUrl);

  if (files?.documents) fd.append('documents', files.documents);
  if (files?.pastExperience) fd.append('pastExperience', files.pastExperience);
  if (files?.profilePhoto) fd.append('profilePhoto', files.profilePhoto);

  return fd;
}

export default function UserCreationTab({ onEmployeeCodeClick }: UserCreationTabProps = {}) {
  const employeesQuery = useEmployeesDirectoryRows();
  const invalidateEmployeesList = useInvalidateEmployeesList();
  const employees = employeesQuery.employees;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserMaster | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<UserMaster | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [signedUrlCache, setSignedUrlCache] = useState<Record<string, string>>({});

  const extractObjectKey = useCallback((value?: string): string => {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (!trimmed) return '';
    try {
      const u = new URL(trimmed);
      return u.pathname.replace(/^\/+/, '');
    } catch {
      // Already a key (or a non-URL string)
      return trimmed.replace(/^\/+/, '');
    }
  }, []);

  const getSignedUrl = useCallback(
    async (key: string): Promise<string> => {
      const cleaned = extractObjectKey(key);
      if (!cleaned) throw new Error('Missing file key');
      if (signedUrlCache[cleaned]) return signedUrlCache[cleaned];
      const data = await apiFetch(`${SIGNED_URL_ENDPOINT}?key=${encodeURIComponent(cleaned)}`);
      if (!data?.success || !data?.url) {
        throw new Error(data?.message || 'Failed to get signed URL');
      }
      setSignedUrlCache(prev => ({ ...prev, [cleaned]: data.url }));
      return data.url as string;
    },
    [extractObjectKey, signedUrlCache]
  );

  const handleViewFile = useCallback(
    async (rawUrl?: string) => {
      try {
        if (!rawUrl) return;
        const key = extractObjectKey(rawUrl);
        if (!key) return;
        const signed = await getSignedUrl(key);
        window.open(signed, '_blank', 'noopener,noreferrer');
      } catch (e) {
        console.error(e);
        toast.error('Unable to open file');
      }
    },
    [extractObjectKey, getSignedUrl]
  );

  const SignedThumb = useMemo(() => {
    return function SignedThumbInner({ rawUrl }: { rawUrl?: string }) {
      const [src, setSrc] = useState<string>('');
      const key = extractObjectKey(rawUrl);

      useEffect(() => {
        let cancelled = false;
        (async () => {
          if (!key) {
            setSrc('');
            return;
          }
          try {
            const signed = await getSignedUrl(key);
            if (!cancelled) setSrc(signed);
          } catch {
            if (!cancelled) setSrc('');
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [key]);

      if (!src) return <span>-</span>;
      return <img src={src} alt="" className="h-8 w-8 rounded object-cover border" />;
    };
  }, [extractObjectKey, getSignedUrl]);

  useEffect(() => {
    if (employeesQuery.isError && employeesQuery.data === undefined) {
      console.error('API Error:', employeesQuery.error);
      toast.error('Failed to load employees');
    }
  }, [employeesQuery.isError, employeesQuery.error, employeesQuery.data]);

  const handleCreateUser = async (user: UserMaster, files?: UserFormFiles) => {
    const fd = buildEmployeeFormData(user, files);

    try {
      const data = await apiFetch(API_BASE, {
        method: 'POST',
        body: fd,
      });

      if (data.success) {
        const pw = data.data?.password;
        if (pw) {
          try {
            await navigator.clipboard?.writeText(pw);
          } catch {}
          toast.success(`User created. Temporary password: ${pw} (copied)`);
        } else {
          toast.success('User created successfully');
        }
        void invalidateEmployeesList();
        setIsModalOpen(false);
      } else {
        toast.error(data.message || 'Error creating employee');
        throw new Error(data.message || 'Error creating employee');
      }
    } catch (error) {
      console.error('Create Employee Error:', error);
      throw error;
    }
  };

  const handleUpdate = async (user: UserMaster, files?: UserFormFiles) => {
    try {
      const employeeId =
        selectedEmployee?.employeeId || selectedEmployee?.employeeCode || user.employeeId || user.employeeCode;
      if (!employeeId) {
        toast.error('Update failed: missing employee id');
        return;
      }

      const fd = buildEmployeeFormData(user, files);

      const data = await apiFetch(`${API_BASE}/${encodeURIComponent(employeeId)}`, {
        method: 'PUT',
        body: fd,
      });

      if (data.success) {
        toast.success('Employee updated');
        setEditMode(false);
        setSelectedEmployee(null);
        setEditingUser(null);
        void invalidateEmployeesList();
      } else {
        toast.error(data.message || 'Update failed');
      }
    } catch (err) {
      console.error('Update error:', err);
      toast.error('Update failed');
    }
  };

  const handleDelete = async (employeeId: string) => {
    try {
      const confirmDelete = window.confirm('Are you sure?');
      if (!confirmDelete) return;

      const data = await apiFetch(`${API_BASE}/${encodeURIComponent(employeeId)}`, {
        method: 'DELETE',
      });

      if (data.success) {
        toast.success('Employee deleted');
        void invalidateEmployeesList();
      } else {
        toast.error('Delete failed');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleImportUsers = async (importedUsers: UserMaster[]) => {
    let ok = 0;
    let failed = 0;
    for (const u of importedUsers) {
      try {
        const fd = buildEmployeeFormData(u);
        const data = await apiFetch(API_BASE, {
          method: 'POST',
          body: fd,
        });
        if (data.success) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }
    void invalidateEmployeesList();
    if (failed > 0) {
      toast.error(`Imported ${ok} user(s), ${failed} failed`);
    } else {
      toast.success(`Imported ${ok} user(s)`);
    }
  };

  const openEditModal = (displayRow: UserMaster) => {
    const id = displayRow.employeeId || displayRow.employeeCode || displayRow.employee_code;
    const raw = employees.find(
      e => (e.employeeId || e.employee_code || e.employeeCode) === id
    );
    if (!raw) return;
    setEditMode(true);
    setSelectedEmployee(raw);
    setEditingUser(raw);
  };

  const formattedEmployees = employees.map(emp => ({
    ...emp,
    employeeCode: emp.employeeCode || emp.employee_code || '-',
    firstName: emp.firstName || emp.first_name || '-',
    lastName: emp.lastName || emp.last_name || '-',
    name: emp.name || `${emp.firstName || emp.first_name || ''} ${emp.lastName || emp.last_name || ''}`.trim() || '-',
    designation: emp.designation || '-',
    dateOfJoining: emp.dateOfJoining || emp.date_of_joining || '-',
    dateOfExit: emp.dateOfExit || emp.date_of_exit || '-',
    dateOfBirth: emp.dateOfBirth || emp.date_of_birth || '-',
    gender: emp.gender || '-',
    phoneNumber: emp.phoneNumber || emp.phone || '-',
    officialEmail: emp.officialEmail || emp.official_email || '-',
    personalEmail: emp.personalEmail || emp.personal_email || '-',
    aadharNo: emp.aadharNo || emp.aadhar_no || '-',
    panNo: emp.panNo || emp.pan_no || '-',
    accountNo: emp.accountNo || emp.account_no || '-',
    bankName: emp.bankName || emp.bank_name || '-',
    ifsc: emp.ifsc || '-',
    uanNumber: emp.uanNumber || emp.uan_no || '-',
    emergencyContact: emp.emergencyContact || emp.emergency_contact || '-',
    address: emp.address || '-',
    permanentAddress: emp.permanentAddress || emp.permanent_address || '-',
    biometricCode: emp.biometricCode || emp.biometric_code || '-',
    biometricPassword: emp.biometricPassword || emp.biometric_password || '-',
    passportNo: emp.passportNo || emp.passport_no || '-',
    mediClaimNo: emp.mediClaimNo || emp.medi_claim_no || '-',
    location: emp.location || '-',
    corporateId: emp.corporateId || '-',
    password: 'Password Protected',
    documentsUrl: emp.documentsUrl || '',
    pastExperienceUrl: emp.pastExperienceUrl || '',
    profilePhotoUrl: emp.profilePhotoUrl || '',
    imported: emp.imported,
  }));

  const term = debouncedSearch.toLowerCase().trim();
  const filteredUsers = formattedEmployees.filter((user) => {
    if (!term) return true;
    const combined = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const hay = [
      user.name,
      user.firstName,
      user.lastName,
      combined,
      user.employeeCode,
      user.officialEmail,
      user.dateOfBirth,
      user.gender,
      user.biometricCode,
      user.passportNo,
      user.mediClaimNo,
      user.location,
      user.corporateId,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(term);
  });

  const isInitialLoading = isQueryColdLoading(employeesQuery);
  const showEmptyState =
    !isInitialLoading && !employeesQuery.isError && filteredUsers.length === 0;

  const exportEmployeesExcel = () => {
    const rows = employees.map(emp => ({
      'Employee Code': emp.employee_code || emp.employeeCode || '',
      'Corporate ID': emp.corporateId || 'SpecialisePdt',
      'First Name': emp.first_name || emp.firstName || '',
      'Last Name': emp.last_name || emp.lastName || '',
      Password: '',
      Designation: emp.designation || '',
      'Date of Joining': emp.date_of_joining || emp.dateOfJoining || '',
      'Date of Exit': emp.date_of_exit || emp.dateOfExit || '',
      'Date of Birth': emp.date_of_birth || emp.dateOfBirth || '',
      Gender: emp.gender || '',
      Phone: emp.phone || emp.phoneNumber || '',
      'Official Email': emp.official_email || emp.officialEmail || '',
      'Personal Email': emp.personal_email || emp.personalEmail || '',
      'Aadhar No': emp.aadhar_no || emp.aadharNo || '',
      'PAN No': emp.pan_no || emp.panNo || '',
      'Account No': emp.account_no || emp.accountNo || '',
      'Bank Name': emp.bank_name || emp.bankName || '',
      IFSC: emp.ifsc || '',
      'UAN No': emp.uan_no || emp.uanNumber || '',
      'Emergency Contact': emp.emergency_contact || emp.emergencyContact || '',
      'Current Address': emp.address || '',
      'Permanent Address': emp.permanent_address || emp.permanentAddress || '',
      'Biometric Code': emp.biometric_code || emp.biometricCode || '',
      'Biometric Password': emp.biometric_password || emp.biometricPassword || '',
      'Passport No': emp.passport_no || emp.passportNo || '',
      'Medi Claim No': emp.medi_claim_no || emp.mediClaimNo || '',
      Location: emp.location || '',
      'Documents URL': emp.documentsUrl || '',
      'Past Experience URL': emp.pastExperienceUrl || '',
      'Profile Photo URL': emp.profilePhotoUrl || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, `users_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Export started');
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportEmployeesExcel} className="gap-2">
            <Download className="w-4 h-4" />
            Export Data
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="bg-[#007BFF] hover:bg-[#0056b3] gap-2 text-center">
            <UserPlus className="w-4 h-4" />
            Create New User
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by first/last name, code, email, biometric, passport, medi claim, location, corporate ID"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Employee Code</TableHead>
              <TableHead>Corporate ID</TableHead>
              <TableHead>First Name</TableHead>
              <TableHead>Last Name</TableHead>
              <TableHead>Password</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Date of Joining</TableHead>
              <TableHead>Date of Exit</TableHead>
              <TableHead>Date of Birth</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Official Email</TableHead>
              <TableHead>Personal Email</TableHead>
              <TableHead>Aadhar No.</TableHead>
              <TableHead>PAN No.</TableHead>
              <TableHead>Account No.</TableHead>
              <TableHead>Bank Name</TableHead>
              <TableHead>IFSC</TableHead>
              <TableHead>UAN Number</TableHead>
              <TableHead>Emergency Contact</TableHead>
              <TableHead>Biometric Code</TableHead>
              <TableHead>Biometric Password</TableHead>
              <TableHead>Passport No.</TableHead>
              <TableHead>Medi Claim No.</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Current Address</TableHead>
              <TableHead>Permanent Address</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>Past Experience</TableHead>
              <TableHead>Photo</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isInitialLoading ? (
              <TableRow>
                <TableCell colSpan={30} className="text-center py-8 text-gray-500">
                  Loading employees…
                </TableCell>
              </TableRow>
            ) : showEmptyState ? (
              <TableRow>
                <TableCell colSpan={30} className="text-center py-8 text-gray-500">
                  No employees found
                </TableCell>
              </TableRow>
            ) : (
            filteredUsers.map((user, index) => (
              <TableRow
                key={`${user.employeeId || user.employeeCode}-${index}`}
                className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEmployeeCodeClick?.(user)}
                      className="text-[#007BFF] hover:underline"
                    >
                      {user.employeeCode}
                    </button>
                    {user.imported && (
                      <Badge variant="secondary" className="text-xs">
                        Imported
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{user.corporateId}</TableCell>
                <TableCell>{user.firstName || '-'}</TableCell>
                <TableCell>{user.lastName || '-'}</TableCell>
                <TableCell>
                  <span className="text-xs">Password Protected</span>
                </TableCell>
                <TableCell>{user.designation || '-'}</TableCell>
                <TableCell>{user.dateOfJoining}</TableCell>
                <TableCell>{user.dateOfExit || '-'}</TableCell>
                <TableCell>{user.dateOfBirth || '-'}</TableCell>
                <TableCell>{user.gender || '-'}</TableCell>
                <TableCell>{user.phoneNumber}</TableCell>
                <TableCell>{user.officialEmail}</TableCell>
                <TableCell>{user.personalEmail || '-'}</TableCell>
                <TableCell>{user.aadharNo || '-'}</TableCell>
                <TableCell>{user.panNo || '-'}</TableCell>
                <TableCell>{user.accountNo || '-'}</TableCell>
                <TableCell>{user.bankName || '-'}</TableCell>
                <TableCell>{user.ifsc || '-'}</TableCell>
                <TableCell>{user.uanNumber || '-'}</TableCell>
                <TableCell>{user.emergencyContact || '-'}</TableCell>
                <TableCell>{user.biometricCode || '-'}</TableCell>
                <TableCell>{user.biometricPassword || '-'}</TableCell>
                <TableCell>{user.passportNo || '-'}</TableCell>
                <TableCell>{user.mediClaimNo || '-'}</TableCell>
                <TableCell>{user.location || '-'}</TableCell>
                <TableCell>
                  {user.address && user.address !== '-' ? (
                    <div className="max-w-[200px] truncate" title={user.address}>
                      {user.address}
                    </div>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {user.permanentAddress && user.permanentAddress !== '-' ? (
                    <div className="max-w-[200px] truncate" title={user.permanentAddress}>
                      {user.permanentAddress}
                    </div>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {user.documentsUrl ? (
                    <button
                      type="button"
                      onClick={() => handleViewFile(user.documentsUrl)}
                      className="text-[#007BFF] hover:underline text-sm"
                    >
                      View
                    </button>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {user.pastExperienceUrl ? (
                    <button
                      type="button"
                      onClick={() => handleViewFile(user.pastExperienceUrl)}
                      className="text-[#007BFF] hover:underline text-sm"
                    >
                      View
                    </button>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {user.profilePhotoUrl ? <SignedThumb rawUrl={user.profilePhotoUrl} /> : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(user)}
                      className="text-[#007BFF] hover:text-[#0056b3]"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(user.employeeId || user.employeeCode)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
            )}
          </TableBody>
        </Table>
      </div>

      {employeesQuery.hasNextPage && (
        <div className="flex justify-end mt-3">
          <Button
            variant="outline"
            size="sm"
            disabled={employeesQuery.isFetchingNextPage}
            onClick={() => void employeesQuery.fetchNextPage()}
          >
            {employeesQuery.isFetchingNextPage ? 'Loading…' : 'Load more employees'}
          </Button>
        </div>
      )}

      <UserFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreateUser} />

      {editingUser && (
        <UserFormModal
          isOpen={true}
          onClose={() => {
            setEditingUser(null);
            setEditMode(false);
            setSelectedEmployee(null);
          }}
          onSubmit={handleUpdate}
          initialData={editingUser}
          isEdit={editMode}
        />
      )}

      <ImportUsersModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportUsers}
        existingEmployeeCodes={employees.map(u => u.employee_code)}
      />
    </Card>
  );
}
