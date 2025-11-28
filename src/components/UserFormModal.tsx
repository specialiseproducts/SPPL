import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import type { UserMaster } from './UserCreationTab';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (user: UserMaster) => void;
  initialData?: UserMaster;
  isEdit?: boolean;
}

export default function UserFormModal({ isOpen, onClose, onSubmit, initialData, isEdit }: UserFormModalProps) {
  const [formData, setFormData] = useState<Partial<UserMaster>>({
    employee_code: '',
    name: '',
    designation: '',
    date_of_joining: '',
    date_of_exit: '',
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
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        employee_code: '',
        name: '',
        designation: '',
        date_of_joining: '',
        date_of_exit: '',
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
        password: '',
      });
    }
  }, [initialData, isOpen]);

  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    for (let i = 3; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    setFormData(prev => ({ ...prev, password }));
    toast.success('Password generated successfully');
  };

  const validateForm = (): boolean => {
    // Required fields
    if (!formData.employee_code?.trim()) {
      toast.error('Employee Code is required');
      return false;
    }
    if (!formData.name?.trim()) {
      toast.error('Name is required');
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
    if (!isEdit && !formData.password?.trim()) {
      toast.error('Password is required');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.official_email)) {
      toast.error('Invalid official email format');
      return false;
    }
    if (formData.personal_email && !emailRegex.test(formData.personal_email)) {
      toast.error('Invalid personal email format');
      return false;
    }

    // Aadhar validation (12 digits)
    if (formData.aadhar_no && !/^\d{12}$/.test(formData.aadhar_no)) {
      toast.error('Aadhar number must be exactly 12 digits');
      return false;
    }

    // PAN validation
    if (formData.pan_no && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan_no)) {
      toast.error('Invalid PAN format (e.g., ABCDE1234F)');
      return false;
    }

    // IFSC validation
    if (formData.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifsc)) {
      toast.error('Invalid IFSC format (e.g., SBIN0001234)');
      return false;
    }

    // Account number validation (9-18 digits)
    if (formData.account_no && !/^\d{9,18}$/.test(formData.account_no)) {
      toast.error('Account number must be 9-18 digits');
      return false;
    }

    // Password validation (only for new users)
    if (!isEdit && formData.password) {
      if (formData.password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return false;
      }
      if (!/[A-Z]/.test(formData.password)) {
        toast.error('Password must contain at least one uppercase letter');
        return false;
      }
      if (!/[a-z]/.test(formData.password)) {
        toast.error('Password must contain at least one lowercase letter');
        return false;
      }
      if (!/[0-9]/.test(formData.password)) {
        toast.error('Password must contain at least one number');
        return false;
      }
    }

    // Date validation
    if (formData.date_of_exit && formData.date_of_joining) {
      const joining = new Date(formData.date_of_joining);
      const exit = new Date(formData.date_of_exit);
      if (exit < joining) {
        toast.error('Date of Exit cannot be earlier than Date of Joining');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    onSubmit(formData as UserMaster);
    toast.success(isEdit ? '✅ User Updated Successfully' : '✅ New User Created Successfully');
    onClose();
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
            {/* Employee Code */}
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

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Enter full name"
                required
                maxLength={100}
              />
            </div>

            {/* Designation */}
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

            {/* Date of Joining */}
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

            {/* Date of Exit */}
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

            {/* Phone Number */}
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

            {/* Official Email */}
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

            {/* Personal Email */}
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

            {/* Aadhar Card No */}
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

            {/* PAN Card No */}
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

            {/* Account No */}
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

            {/* Bank Name */}
            <div className="space-y-2">
              <Label htmlFor="bank_name">Name of the Bank</Label>
              <Input
                id="bank_name"
                value={formData.bank_name}
                onChange={(e) => updateField('bank_name', e.target.value)}
                placeholder="State Bank of India"
              />
            </div>

            {/* IFSC Code */}
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

            {/* UAN Number */}
            <div className="space-y-2">
              <Label htmlFor="uan_no">UAN Number</Label>
              <Input
                id="uan_no"
                value={formData.uan_no}
                onChange={(e) => updateField('uan_no', e.target.value)}
                placeholder="100200300"
              />
            </div>

            {/* Emergency Contact */}
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
          </div>

          {/* Address - Full Width */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="Enter complete address"
              rows={3}
            />
          </div>

          {/* Password */}
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={generatePassword}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Generate
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Minimum 8 characters, at least one uppercase, one lowercase, one number.
              </p>
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
