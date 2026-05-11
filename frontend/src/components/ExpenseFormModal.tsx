import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { ExpenseRecord } from './ExpensesTab';
import {
  EXPENSE_HEADS,
  getSubcategoriesForHead,
  isCanonicalExpenseHead,
} from '../constants/expenseSubCategories';
import {
  isTravelCarOrBike,
  isHotelBookingSelf,
  computeTravelCarBikeRupeeAmount,
  formatTravelCarBikeAmountField,
  type ExpenseTravelRates,
} from '../utils/expenseAmountCalculation';
import { apiFetch } from '../services/api';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expense: ExpenseRecord) => void | Promise<void>;
  isAdmin: boolean;
  /** Reserved for future employee-scoped defaults */
  currentEmployeeCode?: string;
  currentUserName: string;
  initialData?: ExpenseRecord;
  isEdit?: boolean;
}

/** Radix Select requires `value` to match an item; use sentinel for "not chosen yet". */
const SUB_CATEGORY_UNSET = '__unset__';
const FUEL_TYPE_UNSET = '__fuel_unset__';

const SUPPORTING_FILE_EXT = /\.(doc|docx|pdf|jpg|jpeg|png|xls|xlsx)$/i;

const emptyForm = {
  expenseHead: 'Travel',
  subCategory: SUB_CATEGORY_UNSET,
  location: '',
  purpose: '',
  serviceProvider: '',
  billNumber: '',
  date: '',
  amount: '',
  monthYear: '',
  fromLocation: '',
  toLocation: '',
  returnType: '',
  kilometers: '',
  stayDateFrom: '',
  stayDateTo: '',
  supportingDocument: 'No' as 'Yes' | 'No',
  fuelType: FUEL_TYPE_UNSET,
};

export default function ExpenseFormModal({
  isOpen,
  onClose,
  onSubmit,
  isAdmin: _privileged,
  currentUserName,
  currentEmployeeCode: _currentEmployeeCode,
  initialData,
  isEdit,
}: ExpenseFormModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [travelRates, setTravelRates] = useState<ExpenseTravelRates | null>(null);

  const expenseHeadOptions = useMemo(() => {
    const base: string[] = [...EXPENSE_HEADS];
    const legacy = initialData?.expenseHead;
    if (legacy && !base.includes(legacy)) {
      base.push(legacy);
    }
    return base;
  }, [initialData?.expenseHead]);

  const [formData, setFormData] = useState({ ...emptyForm });

  useEffect(() => {
    if (initialData) {
      const head = initialData.expenseHead;
      const savedSub = initialData.subCategory?.trim() || '';
      const options = getSubcategoriesForHead(head);
      const subCategory =
        savedSub && options.includes(savedSub) ? savedSub : SUB_CATEGORY_UNSET;
      const sdRaw = initialData.supportingDocument;
      const supportingDocument: 'Yes' | 'No' =
        sdRaw === 'Yes' || sdRaw === 'No'
          ? sdRaw
          : initialData.documents && initialData.documents.length > 0
            ? 'Yes'
            : 'No';
      const ft = initialData.fuelType?.trim();
      const fuelType =
        ft === 'Petrol/Diesel' || ft === 'Electric' ? ft : FUEL_TYPE_UNSET;

      setFormData({
        expenseHead: head,
        subCategory,
        location: initialData.location || '',
        purpose: initialData.purpose || '',
        serviceProvider: initialData.serviceProvider,
        billNumber: initialData.billNumber,
        date: initialData.date,
        amount: initialData.amount.toString(),
        monthYear: initialData.monthYear,
        fromLocation: initialData.fromLocation ?? '',
        toLocation: initialData.toLocation ?? '',
        returnType: initialData.returnType ?? '',
        kilometers:
          initialData.kilometers !== undefined && initialData.kilometers !== null
            ? String(initialData.kilometers)
            : '',
        stayDateFrom: initialData.stayDateFrom ?? '',
        stayDateTo: initialData.stayDateTo ?? '',
        supportingDocument,
        fuelType,
      });
    } else {
      setFormData({ ...emptyForm });
    }
    setSelectedFile(null);
  }, [initialData, isOpen]);

  useEffect(() => {
    if (formData.supportingDocument === 'No') {
      setSelectedFile(null);
    }
  }, [formData.supportingDocument]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = (await apiFetch('/api/expenses/settings/travel-rates')) as {
          success?: boolean;
          data?: {
            car?: { petrolDieselRate?: number; electricRate?: number };
            bike?: { petrolDieselRate?: number; electricRate?: number };
          };
        };
        if (cancelled) return;
        if (res?.success && res.data?.car && res.data?.bike) {
          setTravelRates({
            car: {
              petrolDieselRate: Number(res.data.car.petrolDieselRate) || 0,
              electricRate: Number(res.data.car.electricRate) || 0,
            },
            bike: {
              petrolDieselRate: Number(res.data.bike.petrolDieselRate) || 0,
              electricRate: Number(res.data.bike.electricRate) || 0,
            },
          });
        } else {
          setTravelRates({
            car: { petrolDieselRate: 0, electricRate: 0 },
            bike: { petrolDieselRate: 0, electricRate: 0 },
          });
        }
      } catch {
        if (!cancelled) {
          setTravelRates({
            car: { petrolDieselRate: 0, electricRate: 0 },
            bike: { petrolDieselRate: 0, electricRate: 0 },
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (formData.date) {
      const dateObj = new Date(formData.date);
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const year = String(dateObj.getUTCFullYear());
      setFormData((prev) => ({ ...prev, monthYear: `${month}-${year}` }));
    }
  }, [formData.date]);

  const effectiveSubCategory =
    formData.subCategory === SUB_CATEGORY_UNSET ? '' : formData.subCategory.trim();
  const showTravelDetail =
    isTravelCarOrBike(formData.expenseHead, effectiveSubCategory) && Boolean(effectiveSubCategory);
  const showHotelStay = isHotelBookingSelf(formData.expenseHead, effectiveSubCategory);
  const isAutoAmount = showTravelDetail;

  useEffect(() => {
    if (!isOpen || !travelRates || !showTravelDetail) return;

    const rawKm = formData.kilometers.trim();
    const kmParsed = rawKm === '' ? 0 : parseFloat(rawKm);
    const kmSafe = Number.isFinite(kmParsed) ? kmParsed : 0;
    const fuel =
      formData.fuelType !== FUEL_TYPE_UNSET ? formData.fuelType.trim() : '';

    const computed = computeTravelCarBikeRupeeAmount({
      expenseHead: formData.expenseHead,
      subCategory: effectiveSubCategory,
      kilometers: kmSafe,
      fuelType: fuel,
      rates: travelRates,
    });
    const nextAmount = formatTravelCarBikeAmountField(computed);

    setFormData((prev) => {
      if (prev.amount === nextAmount) return prev;
      return { ...prev, amount: nextAmount };
    });
  }, [
    isOpen,
    travelRates,
    showTravelDetail,
    formData.expenseHead,
    formData.subCategory,
    formData.kilometers,
    formData.fuelType,
    effectiveSubCategory,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.location.trim()) {
      toast.error('Please enter location');
      return;
    }
    if (!formData.purpose.trim()) {
      toast.error('Please enter purpose');
      return;
    }
    if (!formData.serviceProvider.trim()) {
      toast.error('Please enter service provider name');
      return;
    }
    if (!formData.billNumber.trim()) {
      toast.error('Please enter bill number or "NA"');
      return;
    }
    if (!formData.date) {
      toast.error('Please select a date');
      return;
    }

    if (isCanonicalExpenseHead(formData.expenseHead)) {
      const sub = formData.subCategory === SUB_CATEGORY_UNSET ? '' : formData.subCategory.trim();
      if (!sub) {
        toast.error('Please select a sub category');
        return;
      }
      if (!getSubcategoriesForHead(formData.expenseHead).includes(sub)) {
        toast.error('Sub category does not match expense head');
        return;
      }
    }

    if (showTravelDetail) {
      if (!formData.fromLocation.trim()) {
        toast.error('Please enter From');
        return;
      }
      if (!formData.toLocation.trim()) {
        toast.error('Please enter To');
        return;
      }
      if (!formData.returnType.trim()) {
        toast.error('Please enter Return');
        return;
      }
      if (!formData.kilometers.trim()) {
        toast.error('Please enter kilometers');
        return;
      }
      const km = parseFloat(formData.kilometers);
      if (Number.isNaN(km) || km < 0) {
        toast.error('Kilometers must be a valid non-negative number');
        return;
      }
      if (formData.fuelType === FUEL_TYPE_UNSET || !formData.fuelType.trim()) {
        toast.error('Please select fuel type');
        return;
      }
    }

    if (formData.supportingDocument === 'Yes') {
      const hasNewFile = Boolean(selectedFile);
      const hasExistingDoc =
        Boolean(isEdit && initialData?.documents && initialData.documents.length > 0);
      if (!hasNewFile && !hasExistingDoc) {
        toast.error('Please attach a supporting document');
        return;
      }
      if (selectedFile && !SUPPORTING_FILE_EXT.test(selectedFile.name)) {
        toast.error('Invalid file type. Allowed: DOC, DOCX, PDF, JPG, JPEG, PNG, XLS, XLSX');
        return;
      }
    }

    if (showHotelStay) {
      if (!formData.stayDateFrom) {
        toast.error('Please select date (from)');
        return;
      }
      if (!formData.stayDateTo) {
        toast.error('Please select date (to)');
        return;
      }
      if (new Date(formData.stayDateTo) < new Date(formData.stayDateFrom)) {
        toast.error('Date (to) cannot be earlier than date (from)');
        return;
      }
    }

    let amountNum: number;
    if (isAutoAmount) {
      if (!travelRates) {
        toast.error('Travel rates could not be loaded. Please try again.');
        return;
      }
      const rawKm = formData.kilometers.trim();
      const kmParsed = rawKm === '' ? 0 : parseFloat(rawKm);
      const kmSafe = Number.isFinite(kmParsed) ? kmParsed : 0;
      const fuel =
        formData.fuelType !== FUEL_TYPE_UNSET ? formData.fuelType.trim() : '';
      amountNum = computeTravelCarBikeRupeeAmount({
        expenseHead: formData.expenseHead,
        subCategory: effectiveSubCategory,
        kilometers: kmSafe,
        fuelType: fuel,
        rates: travelRates,
      });
      if (!Number.isFinite(amountNum) || amountNum < 0) {
        toast.error('Invalid calculated amount');
        return;
      }
    } else {
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }
      amountNum = parseFloat(formData.amount);
    }

    const employeeName =
      (isEdit && initialData?.employeeName) || currentUserName;

    const subCategoryResolved =
      formData.subCategory === SUB_CATEGORY_UNSET ? '' : formData.subCategory.trim();

    const wantsSupportingFile = formData.supportingDocument === 'Yes';

    const expense: ExpenseRecord = {
      expenseId: isEdit && initialData ? initialData.expenseId : '',
      expenseHead: formData.expenseHead,
      subCategory: subCategoryResolved || undefined,
      location: formData.location.trim(),
      purpose: formData.purpose.trim(),
      serviceProvider: formData.serviceProvider,
      billNumber: formData.billNumber,
      date: formData.date,
      amount: amountNum,
      employeeName,
      employeeId: initialData?.employeeId,
      employeeEmail: initialData?.employeeEmail,
      monthYear: formData.monthYear,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      supportingDocument: formData.supportingDocument,
      selectedFile: wantsSupportingFile ? selectedFile || undefined : undefined,
      documents: !wantsSupportingFile
        ? []
        : selectedFile
          ? [
              {
                fileName: selectedFile.name,
                fileUrl: `/uploads/expenses/${selectedFile.name}`,
              },
            ]
          : initialData?.documents || [],
      ...(showTravelDetail
        ? {
            fromLocation: formData.fromLocation.trim(),
            toLocation: formData.toLocation.trim(),
            returnType: formData.returnType.trim(),
            kilometers: parseFloat(formData.kilometers) || 0,
            fuelType:
              formData.fuelType !== FUEL_TYPE_UNSET
                ? formData.fuelType
                : undefined,
          }
        : {}),
      ...(showHotelStay
        ? {
            stayDateFrom: formData.stayDateFrom,
            stayDateTo: formData.stayDateTo,
          }
        : {}),
    };

    onSubmit(expense);

    if (!isEdit) {
      setFormData({ ...emptyForm });
      setSelectedFile(null);
    }
  };

  const subCategoryOptions = getSubcategoriesForHead(formData.expenseHead);
  const subCategoryDisabled =
    !formData.expenseHead || !isCanonicalExpenseHead(formData.expenseHead);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Expense Record' : 'Create New Expense Record'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update expense details below' : 'Fill in the expense details below'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expense_head">Expense Head *</Label>
              <Select
                value={formData.expenseHead}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    expenseHead: value,
                    subCategory: SUB_CATEGORY_UNSET,
                    fromLocation: '',
                    toLocation: '',
                    returnType: '',
                    kilometers: '',
                    stayDateFrom: '',
                    stayDateTo: '',
                    fuelType: FUEL_TYPE_UNSET,
                    amount: isTravelCarOrBike(value, '') ? '0' : formData.amount,
                  })
                }
              >
                <SelectTrigger id="expense_head">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expenseHeadOptions.map((head) => (
                    <SelectItem key={head} value={head}>
                      {head}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub_category">
                Sub Category{!subCategoryDisabled ? ' *' : ''}
              </Label>
              <Select
                value={formData.subCategory}
                onValueChange={(value) => {
                  const wasTravelDetail = isTravelCarOrBike(
                    formData.expenseHead,
                    effectiveSubCategory
                  );
                  const willTravelDetail = isTravelCarOrBike(formData.expenseHead, value);
                  const wasHotelSelf = isHotelBookingSelf(
                    formData.expenseHead,
                    effectiveSubCategory
                  );
                  const willHotelSelf = isHotelBookingSelf(formData.expenseHead, value);
                  setFormData({
                    ...formData,
                    subCategory: value,
                    ...(wasTravelDetail && !willTravelDetail
                      ? {
                          fromLocation: '',
                          toLocation: '',
                          returnType: '',
                          kilometers: '',
                          fuelType: FUEL_TYPE_UNSET,
                          amount: formData.amount === '0' ? '' : formData.amount,
                        }
                      : {}),
                    ...(willTravelDetail && !wasTravelDetail
                      ? { amount: '0', fuelType: FUEL_TYPE_UNSET }
                      : {}),
                    ...(wasHotelSelf && !willHotelSelf
                      ? { stayDateFrom: '', stayDateTo: '' }
                      : {}),
                  });
                }}
                disabled={subCategoryDisabled}
              >
                <SelectTrigger id="sub_category" className={subCategoryDisabled ? 'opacity-70' : ''}>
                  <SelectValue placeholder="Select Sub Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SUB_CATEGORY_UNSET} disabled className="text-muted-foreground">
                    Select sub category
                  </SelectItem>
                  {subCategoryOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (Rs) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder={isAutoAmount ? 'Auto calculated' : '0.00'}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                disabled={isAutoAmount}
                readOnly={isAutoAmount}
                className={isAutoAmount ? 'bg-gray-50' : ''}
              />
              {isAutoAmount && (
                <p className="text-xs text-gray-500">
                  Auto-calculated using configured travel rates.
                </p>
              )}
            </div>
          </div>

          {showTravelDetail && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="fuel_type">Fuel Type *</Label>
                <Select
                  value={formData.fuelType}
                  onValueChange={(value) => setFormData({ ...formData, fuelType: value })}
                >
                  <SelectTrigger id="fuel_type">
                    <SelectValue placeholder="Select fuel type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FUEL_TYPE_UNSET} disabled className="text-muted-foreground">
                      Select fuel type
                    </SelectItem>
                    <SelectItem value="Petrol/Diesel">Petrol/Diesel</SelectItem>
                    <SelectItem value="Electric">Electric</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_location">From *</Label>
                <Input
                  id="from_location"
                  value={formData.fromLocation}
                  onChange={(e) => setFormData({ ...formData, fromLocation: e.target.value })}
                  placeholder="Start location"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to_location">To *</Label>
                <Input
                  id="to_location"
                  value={formData.toLocation}
                  onChange={(e) => setFormData({ ...formData, toLocation: e.target.value })}
                  placeholder="Destination"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="return_type">Return *</Label>
                <Input
                  id="return_type"
                  value={formData.returnType}
                  onChange={(e) => setFormData({ ...formData, returnType: e.target.value })}
                  placeholder="e.g. Same day / Next day"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kilometers">Kilometers (km) *</Label>
                <Input
                  id="kilometers"
                  type="number"
                  step="0.01"
                  min={0}
                  value={formData.kilometers}
                  onChange={(e) => setFormData({ ...formData, kilometers: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {showHotelStay && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stay_from">Date (from) *</Label>
                <Input
                  id="stay_from"
                  type="date"
                  value={formData.stayDateFrom}
                  onChange={(e) => setFormData({ ...formData, stayDateFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stay_to">Date (to) *</Label>
                <Input
                  id="stay_to"
                  type="date"
                  value={formData.stayDateTo}
                  onChange={(e) => setFormData({ ...formData, stayDateTo: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                placeholder="Enter location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose *</Label>
              <Input
                id="purpose"
                placeholder="Enter purpose of expense"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service_provider">Service Provider Name *</Label>
              <Input
                id="service_provider"
                placeholder="Enter service provider"
                value={formData.serviceProvider}
                onChange={(e) => setFormData({ ...formData, serviceProvider: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bill_number">Bill Number *</Label>
              <Input
                id="bill_number"
                placeholder="Enter bill number or NA"
                value={formData.billNumber}
                onChange={(e) => setFormData({ ...formData, billNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthYear">Month-Year (Auto-detected)</Label>
              <Input id="monthYear" value={formData.monthYear} disabled className="bg-gray-50" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supporting_doc_choice">Supporting Document *</Label>
              <Select
                value={formData.supportingDocument}
                onValueChange={(value: 'Yes' | 'No') =>
                  setFormData({ ...formData, supportingDocument: value })
                }
              >
                <SelectTrigger id="supporting_doc_choice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.supportingDocument === 'Yes' && (
            <div className="space-y-2 min-h-[5.5rem]">
              <Label htmlFor="supporting_file">Upload supporting document *</Label>
              <div className="flex items-center gap-3">
                <input
                  id="supporting_file"
                  type="file"
                  accept=".doc,.docx,.pdf,.jpg,.jpeg,.png,.xls,.xlsx"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && !SUPPORTING_FILE_EXT.test(f.name)) {
                      toast.error(
                        'Invalid file type. Allowed: DOC, DOCX, PDF, JPG, JPEG, PNG, XLS, XLSX'
                      );
                      e.target.value = '';
                      setSelectedFile(null);
                      return;
                    }
                    setSelectedFile(f);
                  }}
                  className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-sm file:font-medium"
                />
                <Upload className="w-5 h-5 text-gray-400 shrink-0" />
              </div>
              <p className="text-xs text-gray-500">
                DOC, DOCX, PDF, JPG, JPEG, PNG, XLS, XLSX
              </p>
              {selectedFile && <p className="text-xs text-green-600">✓ {selectedFile.name}</p>}
              {isEdit &&
                initialData?.documents &&
                initialData.documents.length > 0 &&
                !selectedFile && (
                  <p className="text-xs text-gray-600">
                    Current: {initialData.documents[0].fileName} (upload a new file to replace)
                  </p>
                )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#007BFF] hover:bg-[#0056b3]">
              Save Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
