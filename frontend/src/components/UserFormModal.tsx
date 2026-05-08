import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import type { UserMaster } from './UserCreationTab';

export const CORPORATE_ID_VALUE = 'SpecialisePdt';

export interface UserFormFiles {
  documents?: File | null;
  pastExperience?: File | null;
  profilePhoto?: File | null;
}

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (user: UserMaster, files?: UserFormFiles) => Promise<void> | void;
  initialData?: UserMaster;
  isEdit?: boolean;
}

const emptyForm: Partial<UserMaster> = {
  employee_code: '',
  name: '',
  first_name: '',
  last_name: '',
  designation: '',
  date_of_joining: '',
  date_of_exit: '',
  date_of_birth: '',
  gender: '',
  phone: '',
  official_email: '',
  personal_email: '',
  aadhar_no: '',
  pan_no: '',
  account_no: '',
  bank_name: '',
  ifsc: '',
  uan_no: '',
  emergency_contact: '',
  address: '',
  permanent_address: '',
  biometric_code: '',
  biometric_password: '',
  passport_no: '',
  medi_claim_no: '',
  location: '',
};

export default function UserFormModal({ isOpen, onClose, onSubmit, initialData, isEdit }: UserFormModalProps) {
  const [formData, setFormData] = useState<Partial<UserMaster>>(emptyForm);
  const [documentsFile, setDocumentsFile] = useState<File | null>(null);
  const [pastExperienceFile, setPastExperienceFile] = useState<File | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);

  useEffect(() => {
    if (initialData) {
      const rawName = (initialData.name || '').trim();
      const nameParts = rawName.split(/\s+/).filter(Boolean);
      const derivedFirst = nameParts[0] || '';
      const derivedLast = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      setFormData({
        ...emptyForm,
        ...initialData,
        employee_code: initialData.employee_code || initialData.employeeCode || '',
        first_name: initialData.first_name || initialData.firstName || derivedFirst,
        last_name: initialData.last_name || initialData.lastName || derivedLast,
        date_of_joining: initialData.date_of_joining || initialData.dateOfJoining || '',
        date_of_exit: initialData.date_of_exit || initialData.dateOfExit || '',
        date_of_birth: initialData.date_of_birth || initialData.dateOfBirth || '',
        gender: initialData.gender || '',
        phone: initialData.phone || initialData.phoneNumber || '',
        official_email: initialData.official_email || initialData.officialEmail || '',
        personal_email: initialData.personal_email || initialData.personalEmail || '',
        aadhar_no: initialData.aadhar_no || initialData.aadharNo || '',
        pan_no: initialData.pan_no || initialData.panNo || '',
        account_no: initialData.account_no || initialData.accountNo || '',
        bank_name: initialData.bank_name || initialData.bankName || '',
        uan_no: initialData.uan_no || initialData.uanNumber || '',
        emergency_contact: initialData.emergency_contact || initialData.emergencyContact || '',
        permanent_address: initialData.permanent_address || initialData.permanentAddress || '',
        biometric_code: initialData.biometric_code || initialData.biometricCode || '',
        biometric_password: initialData.biometric_password || initialData.biometricPassword || '',
        passport_no: initialData.passport_no || initialData.passportNo || '',
        medi_claim_no: initialData.medi_claim_no || initialData.mediClaimNo || '',
        location: initialData.location || '',
      });
    } else {
      setFormData({ ...emptyForm });
    }
    setDocumentsFile(null);
    setPastExperienceFile(null);
    setProfilePhotoFile(null);
  }, [initialData, isOpen]);

  const validateForm = (): boolean => {
    if (!formData.employee_code?.trim()) {
      toast.error('Employee Code is required');
      return false;
    }
    if (!formData.first_name?.trim()) {
      toast.error('First Name is required');
      return false;
    }
    if (!formData.last_name?.trim()) {
      toast.error('Last Name is required');
      return false;
    }
    if (!formData.date_of_joining) {
      toast.error('Date of Joining is required');
      return false;
    }
    if (!formData.phone?.trim()) {
      toast.error('Phone Number is required');
      return false;
    }
    if (!formData.official_email?.trim()) {
      toast.error('Official Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.official_email)) {
      toast.error('Invalid official email format');
      return false;
    }
    if (formData.personal_email && !emailRegex.test(formData.personal_email)) {
      toast.error('Invalid personal email format');
      return false;
    }

    if (formData.aadhar_no && !/^\d{12}$/.test(formData.aadhar_no)) {
      toast.error('Aadhar number must be exactly 12 digits');
      return false;
    }

    if (formData.pan_no && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan_no)) {
      toast.error('Invalid PAN format (e.g., ABCDE1234F)');
      return false;
    }

    if (formData.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifsc)) {
      toast.error('Invalid IFSC format (e.g., SBIN0001234)');
      return false;
    }

    if (formData.account_no && !/^\d{9,18}$/.test(formData.account_no)) {
      toast.error('Account number must be 9-18 digits');
      return false;
    }

    if (formData.date_of_exit && formData.date_of_joining) {
      const joining = new Date(formData.date_of_joining);
      const exit = new Date(formData.date_of_exit);
      if (exit < joining) {
        toast.error('Date of Exit cannot be earlier than Date of Joining');
        return false;
      }
    }

    if (formData.date_of_birth) {
      const dob = new Date(formData.date_of_birth);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (Number.isNaN(dob.getTime())) {
        toast.error('Date of Birth must be a valid date');
        return false;
      }
      if (dob > now) {
        toast.error('Date of Birth cannot be in the future');
        return false;
      }
    }

    if (formData.gender && formData.gender !== 'Male' && formData.gender !== 'Female') {
      toast.error('Gender must be Male or Female');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const payload: UserMaster = {
        ...(formData as UserMaster),
        name: `${formData.first_name || ''} ${formData.last_name || ''}`.trim(),
        firstName: formData.first_name,
        lastName: formData.last_name,
        corporateId: CORPORATE_ID_VALUE,
      };
      await onSubmit(payload, {
        documents: documentsFile,
        pastExperience: pastExperienceFile,
        profilePhoto: profilePhotoFile,
      });
      if (isEdit) {
        toast.success('✅ User Updated Successfully');
        onClose();
      }
    } catch (error) {
      console.error('Submit Error:', error);
    }
  };

  const updateField = (field: keyof UserMaster, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit User' : 'Create New User'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update user information and settings.' : 'Fill in the form below to create a new user account.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee_code">Employee Code *</Label>
              <Input
                id="employee_code"
                value={formData.employee_code}
                onChange={(e) => updateField('employee_code', e.target.value)}
                placeholder="E12345"
                required
                disabled={isEdit}
                maxLength={20}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="corporate_id">Corporate ID</Label>
              <Input id="corporate_id" value={CORPORATE_ID_VALUE} readOnly className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => updateField('first_name', e.target.value)}
                placeholder="Enter first name"
                required
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => updateField('last_name', e.target.value)}
                placeholder="Enter last name"
                required
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => updateField('date_of_birth', e.target.value)}
              />
              <p className="text-xs text-gray-500">Format: DD-MM-YYYY</p>
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <Select
                value={formData.gender || undefined}
                onValueChange={(v) => updateField('gender', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                value={formData.designation}
                onChange={(e) => updateField('designation', e.target.value)}
                placeholder="e.g., Software Engineer"
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_joining">Date of Joining *</Label>
              <Input
                id="date_of_joining"
                type="date"
                value={formData.date_of_joining}
                onChange={(e) => updateField('date_of_joining', e.target.value)}
                required
              />
              <p className="text-xs text-gray-500">Format: DD-MM-YYYY</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_exit">Date of Exit</Label>
              <Input
                id="date_of_exit"
                type="date"
                value={formData.date_of_exit}
                onChange={(e) => updateField('date_of_exit', e.target.value)}
              />
              <p className="text-xs text-gray-500">Optional - Format: DD-MM-YYYY</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+91-9876543210"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="official_email">Official Email Address *</Label>
              <Input
                id="official_email"
                type="email"
                value={formData.official_email}
                onChange={(e) => updateField('official_email', e.target.value)}
                placeholder="user@company.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personal_email">Personal Email Address</Label>
              <Input
                id="personal_email"
                type="email"
                value={formData.personal_email}
                onChange={(e) => updateField('personal_email', e.target.value)}
                placeholder="user.personal@gmail.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aadhar_no">Aadhar Card No.</Label>
              <Input
                id="aadhar_no"
                value={formData.aadhar_no}
                onChange={(e) => updateField('aadhar_no', e.target.value.replace(/\D/g, ''))}
                placeholder="123412341234"
                maxLength={12}
              />
              <p className="text-xs text-gray-500">12 digits only</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pan_no">PAN Card No.</Label>
              <Input
                id="pan_no"
                value={formData.pan_no}
                onChange={(e) => updateField('pan_no', e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                maxLength={10}
              />
              <p className="text-xs text-gray-500">Format: ABCDE1234F</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_no">Account No.</Label>
              <Input
                id="account_no"
                value={formData.account_no}
                onChange={(e) => updateField('account_no', e.target.value.replace(/\D/g, ''))}
                placeholder="0123456789012345"
                maxLength={18}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_name">Name of the Bank</Label>
              <Input
                id="bank_name"
                value={formData.bank_name}
                onChange={(e) => updateField('bank_name', e.target.value)}
                placeholder="State Bank of India"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ifsc">IFSC Code</Label>
              <Input
                id="ifsc"
                value={formData.ifsc}
                onChange={(e) => updateField('ifsc', e.target.value.toUpperCase())}
                placeholder="SBIN0001234"
                maxLength={11}
              />
              <p className="text-xs text-gray-500">Format: SBIN0001234</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="uan_no">UAN Number</Label>
              <Input
                id="uan_no"
                value={formData.uan_no}
                onChange={(e) => updateField('uan_no', e.target.value)}
                placeholder="100200300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergency_contact">Emergency Contact Number</Label>
              <Input
                id="emergency_contact"
                type="tel"
                value={formData.emergency_contact}
                onChange={(e) => updateField('emergency_contact', e.target.value)}
                placeholder="+91-9123456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="biometric_code">Biometric Code</Label>
              <Input
                id="biometric_code"
                value={formData.biometric_code}
                onChange={(e) => updateField('biometric_code', e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="biometric_password">Biometric Password</Label>
              <Input
                id="biometric_password"
                type="text"
                autoComplete="off"
                value={formData.biometric_password}
                onChange={(e) => updateField('biometric_password', e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passport_no">Passport No.</Label>
              <Input
                id="passport_no"
                value={formData.passport_no}
                onChange={(e) => updateField('passport_no', e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medi_claim_no">Medi Claim No.</Label>
              <Input
                id="medi_claim_no"
                value={formData.medi_claim_no}
                onChange={(e) => updateField('medi_claim_no', e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Select
                value={formData.location || undefined}
                onValueChange={(v) => updateField('location', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Office">Office</SelectItem>
                  <SelectItem value="Factory">Factory</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Current Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="Enter complete address"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permanent_address">Permanent Address</Label>
            <Textarea
              id="permanent_address"
              value={formData.permanent_address}
              onChange={(e) => updateField('permanent_address', e.target.value)}
              placeholder="Enter permanent address"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="documents">Documents (PDF, DOC, DOCX)</Label>
              <Input
                id="documents"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setDocumentsFile(e.target.files?.[0] || null)}
              />
              {isEdit && initialData?.documentsUrl && (
                <a
                  href={initialData.documentsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#007BFF] hover:underline"
                >
                  Current document
                </a>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="past_experience">Past Experience (PDF, JPG, PNG, XLS, XLSX, DOC, DOCX)</Label>
              <Input
                id="past_experience"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx"
                onChange={(e) => setPastExperienceFile(e.target.files?.[0] || null)}
              />
              {isEdit && initialData?.pastExperienceUrl && (
                <a
                  href={initialData.pastExperienceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#007BFF] hover:underline"
                >
                  Current file
                </a>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile_photo">Profile Photo (JPG, PNG)</Label>
              <Input
                id="profile_photo"
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={(e) => setProfilePhotoFile(e.target.files?.[0] || null)}
              />
              {isEdit && initialData?.profilePhotoUrl && (
                <a
                  href={initialData.profilePhotoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#007BFF] hover:underline"
                >
                  Current photo
                </a>
              )}
            </div>
          </div>

          {isEdit && formData.password && (
            <div className="space-y-2">
              <Label htmlFor="password_display">Login password (auto-generated)</Label>
              <Input id="password_display" value={formData.password} readOnly className="bg-muted font-mono text-sm" />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#007BFF] hover:bg-[#0056b3]">
              {isEdit ? 'Update User' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
