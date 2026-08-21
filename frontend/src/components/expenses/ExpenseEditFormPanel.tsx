import { useEffect, useMemo, useRef, useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { ExpenseDocument, ExpenseRecord } from '../../types/expenses';
import {
  EXPENSE_HEADS,
  getSubcategoriesForHead,
  isCanonicalExpenseHead,
} from '../../constants/expenseSubCategories';
import {
  isTravelCarOrBike,
  isHotelBookingSelf,
  computeTravelCarBikeRupeeAmount,
  formatTravelCarBikeAmountField,
  type ExpenseTravelRates,
} from '../../utils/expenseAmountCalculation';
import { parseTravelRatesApiData } from '../../utils/expenseTravelRatesFromApi';
import { apiFetch } from '../../services/api';
import { computeOutstationDuration, computeOutstationTravelAllowanceAmount } from '../../utils/expenseOutstation';

const SUB_CATEGORY_UNSET = '__unset__';
const FUEL_TYPE_UNSET = '__fuel_unset__';
const SUPPORTING_FILE_EXT = /\.(doc|docx|pdf|jpg|jpeg|png|xls|xlsx)$/i;

function toDateInputValue(raw: string | undefined): string {
  if (!raw?.trim()) return '';
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

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
  outStation: 'No' as 'Yes' | 'No',
  arrivalDate: '',
  arrivalTime: '',
  departureDate: '',
  departureTime: '',
};

interface ExpenseEditFormPanelProps {
  expense: ExpenseRecord;
  documents: ExpenseDocument[];
  enabled: boolean;
  currentUserName: string;
  onSubmit: (expense: ExpenseRecord) => void;
}

export default function ExpenseEditFormPanel({
  expense,
  documents,
  enabled,
  currentUserName,
  onSubmit,
}: ExpenseEditFormPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [travelRates, setTravelRates] = useState<ExpenseTravelRates | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const prevShowTravelRef = useRef<boolean | null>(null);

  const expenseHeadOptions = useMemo(() => {
    const base: string[] = [...EXPENSE_HEADS];
    const legacy = expense.expenseHead;
    if (legacy && !base.includes(legacy)) {
      base.push(legacy);
    }
    return base;
  }, [expense.expenseHead]);

  useEffect(() => {
    const head = expense.expenseHead;
    const savedSub = expense.subCategory?.trim() || '';
    const subCategory = savedSub || SUB_CATEGORY_UNSET;
    const sdRaw = expense.supportingDocument;
    const supportingDocument: 'Yes' | 'No' =
      sdRaw === 'Yes' || sdRaw === 'No'
        ? sdRaw
        : documents.length > 0
          ? 'Yes'
          : 'No';
    const ft = expense.fuelType?.trim();
    const fuelType = ft === 'Petrol/Diesel' || ft === 'Electric' ? ft : FUEL_TYPE_UNSET;

    setFormData({
      expenseHead: head,
      subCategory,
      location: expense.location || '',
      purpose: expense.purpose || '',
      serviceProvider: expense.serviceProvider,
      billNumber: expense.billNumber,
      date: toDateInputValue(expense.date),
      amount: expense.amount.toString(),
      monthYear: expense.monthYear,
      fromLocation: expense.fromLocation ?? '',
      toLocation: expense.toLocation ?? '',
      returnType: expense.returnType ?? '',
      kilometers:
        expense.kilometers !== undefined && expense.kilometers !== null
          ? String(expense.kilometers)
          : '',
      stayDateFrom: toDateInputValue(expense.stayDateFrom),
      stayDateTo: toDateInputValue(expense.stayDateTo),
      supportingDocument,
      fuelType,
      outStation: expense.outStation === 'Yes' ? 'Yes' : 'No',
      arrivalDate: toDateInputValue(expense.arrivalDate),
      arrivalTime: expense.arrivalTime ?? '',
      departureDate: toDateInputValue(expense.departureDate),
      departureTime: expense.departureTime ?? '',
    });
    setSelectedFile(expense.selectedFile ?? null);
    prevShowTravelRef.current = null;
  }, [expense, documents, enabled]);

  useEffect(() => {
    if (formData.supportingDocument === 'No') {
      setSelectedFile(null);
    }
  }, [formData.supportingDocument]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = (await apiFetch('/api/expenses/settings/travel-rates')) as {
          success?: boolean;
          data?: unknown;
        };
        if (cancelled) return;
        const parsed = parseTravelRatesApiData(res?.data);
        if (res?.success && parsed) {
          setTravelRates(parsed);
        }
      } catch {
        /* submit path validates when needed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const effectiveSubCategory =
    formData.subCategory === SUB_CATEGORY_UNSET ? '' : formData.subCategory.trim();
  const showTravelDetail =
    isTravelCarOrBike(formData.expenseHead, effectiveSubCategory) && Boolean(effectiveSubCategory);
  const isOutstationTravel = formData.expenseHead === 'Travel' && formData.outStation === 'Yes';
  const showHotelStay = isHotelBookingSelf(formData.expenseHead, effectiveSubCategory);
  const isAutoAmount = showTravelDetail && !isOutstationTravel;

  useEffect(() => {
    let src = '';
    if (isOutstationTravel) {
      src = (formData.arrivalDate || formData.departureDate || '').trim();
    } else if (showHotelStay) {
      src = (formData.stayDateFrom || formData.stayDateTo || '').trim();
    } else if (formData.date) {
      src = formData.date.trim();
    }
    if (!src) {
      setFormData((prev) => (prev.monthYear !== '' ? { ...prev, monthYear: '' } : prev));
      return;
    }
    const dateObj = new Date(src);
    if (Number.isNaN(dateObj.getTime())) return;
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const year = String(dateObj.getUTCFullYear());
    const nextMonthYear = `${month}-${year}`;
    setFormData((prev) => {
      if (prev.monthYear === nextMonthYear) return prev;
      return { ...prev, monthYear: nextMonthYear };
    });
  }, [
    isOutstationTravel,
    showHotelStay,
    formData.date,
    formData.stayDateFrom,
    formData.stayDateTo,
    formData.arrivalDate,
    formData.departureDate,
  ]);

  useEffect(() => {
    if (!isOutstationTravel) return;
    const duration = computeOutstationDuration(
      formData.arrivalDate,
      formData.arrivalTime,
      formData.departureDate,
      formData.departureTime,
    );
    const allowance = duration
      ? computeOutstationTravelAllowanceAmount(duration.durationHours)
      : null;
    const nextAmount = allowance != null ? String(allowance) : '';
    setFormData((prev) => (prev.amount === nextAmount ? prev : { ...prev, amount: nextAmount }));
  }, [
    isOutstationTravel,
    formData.arrivalDate,
    formData.arrivalTime,
    formData.departureDate,
    formData.departureTime,
  ]);

  useEffect(() => {
    if (!showHotelStay) return;
    setFormData((prev) => (prev.date ? { ...prev, date: '' } : prev));
  }, [showHotelStay]);

  useEffect(() => {
    if (!enabled || !travelRates || !showTravelDetail) return;

    const rawKm = formData.kilometers.trim();
    const kmParsed = rawKm === '' ? 0 : parseFloat(rawKm);
    const kmSafe = Number.isFinite(kmParsed) ? kmParsed : 0;
    const fuel = formData.fuelType !== FUEL_TYPE_UNSET ? formData.fuelType.trim() : '';

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
    enabled,
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

    if (isOutstationTravel) {
      if (!formData.arrivalDate || !formData.arrivalTime || !formData.departureDate || !formData.departureTime) {
        toast.error('Arrival and departure date/time are required');
        return;
      }
      const duration = computeOutstationDuration(
        formData.arrivalDate,
        formData.arrivalTime,
        formData.departureDate,
        formData.departureTime,
      );
      if (!duration) {
        toast.error('Departure datetime cannot be earlier than arrival datetime');
        return;
      }
    }

    if (!isOutstationTravel && !formData.location.trim()) {
      toast.error('Please enter location');
      return;
    }
    if (!isOutstationTravel && !formData.purpose.trim()) {
      toast.error('Please enter purpose');
      return;
    }
    if (!isOutstationTravel && !showTravelDetail && !formData.serviceProvider.trim()) {
      toast.error('Please enter service provider name');
      return;
    }
    if (!isOutstationTravel && !showTravelDetail && !formData.billNumber.trim()) {
      toast.error('Please enter bill number or "NA"');
      return;
    }
    if (!isOutstationTravel && !showHotelStay && !formData.date) {
      toast.error('Please select a date');
      return;
    }

    if (isCanonicalExpenseHead(formData.expenseHead) && !isOutstationTravel) {
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

    if (
      (isOutstationTravel || (!isOutstationTravel && !showTravelDetail)) &&
      formData.supportingDocument === 'Yes'
    ) {
      const attachedFile = selectedFile || expense.selectedFile || null;
      const hasNewFile = Boolean(attachedFile);
      const hasExistingDoc = documents.length > 0;
      if (!hasNewFile && !hasExistingDoc) {
        toast.error('Please attach a supporting document');
        return;
      }
      if (attachedFile && !SUPPORTING_FILE_EXT.test(attachedFile.name)) {
        toast.error('Invalid file type. Allowed: DOC, DOCX, PDF, JPG, JPEG, PNG, XLS, XLSX');
        return;
      }
    }

    if (!isOutstationTravel && showHotelStay) {
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
    if (isOutstationTravel) {
      const duration = computeOutstationDuration(
        formData.arrivalDate,
        formData.arrivalTime,
        formData.departureDate,
        formData.departureTime,
      );
      const allowance = duration
        ? computeOutstationTravelAllowanceAmount(duration.durationHours)
        : null;
      if (allowance == null) {
        toast.error('Unable to calculate Travel Allowance amount');
        return;
      }
      amountNum = allowance;
    } else if (isAutoAmount) {
      if (!travelRates) {
        toast.error('Travel rates could not be loaded. Please try again.');
        return;
      }
      const rawKm = formData.kilometers.trim();
      const kmParsed = rawKm === '' ? 0 : parseFloat(rawKm);
      const kmSafe = Number.isFinite(kmParsed) ? kmParsed : 0;
      const fuel = formData.fuelType !== FUEL_TYPE_UNSET ? formData.fuelType.trim() : '';
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

    const subCategoryResolved =
      formData.subCategory === SUB_CATEGORY_UNSET ? '' : formData.subCategory.trim();
    const submissionDate = isOutstationTravel
      ? formData.arrivalDate.trim()
      : showHotelStay
      ? (formData.stayDateFrom || formData.stayDateTo || '').trim()
      : formData.date.trim();
    const wantsSupportingFile =
      (isOutstationTravel || (!showTravelDetail && formData.supportingDocument === 'Yes')) &&
      formData.supportingDocument === 'Yes';
    const outstationDuration = isOutstationTravel
      ? computeOutstationDuration(
          formData.arrivalDate,
          formData.arrivalTime,
          formData.departureDate,
          formData.departureTime,
        )
      : null;

    const updated: ExpenseRecord = {
      expenseId: expense.expenseId,
      expenseHead: formData.expenseHead,
      subCategory: subCategoryResolved || undefined,
      location: isOutstationTravel ? '' : formData.location.trim(),
      purpose: isOutstationTravel ? '' : formData.purpose.trim(),
      serviceProvider: showTravelDetail || isOutstationTravel ? '' : formData.serviceProvider.trim(),
      billNumber: showTravelDetail || isOutstationTravel ? '' : formData.billNumber.trim(),
      date: submissionDate,
      amount: amountNum,
      employeeName: expense.employeeName || currentUserName,
      employeeId: expense.employeeId,
      employeeEmail: expense.employeeEmail,
      monthYear: formData.monthYear,
      createdAt: expense.createdAt,
      updatedAt: new Date().toISOString(),
      supportingDocument: showTravelDetail && !isOutstationTravel ? 'No' : formData.supportingDocument,
      selectedFile: wantsSupportingFile
        ? selectedFile || expense.selectedFile || undefined
        : undefined,
      documents: showTravelDetail && !isOutstationTravel
        ? []
        : !wantsSupportingFile
          ? []
          : selectedFile
            ? [{ fileName: selectedFile.name, fileUrl: `/uploads/expenses/${selectedFile.name}` }]
            : documents,
      auditStatus: expense.auditStatus,
      auditReason: expense.auditReason,
      ...(showTravelDetail && !isOutstationTravel
        ? {
            fromLocation: formData.fromLocation.trim(),
            toLocation: formData.toLocation.trim(),
            returnType: formData.returnType.trim(),
            kilometers: parseFloat(formData.kilometers) || 0,
            fuelType: formData.fuelType !== FUEL_TYPE_UNSET ? formData.fuelType : undefined,
          }
        : {}),
      ...(showHotelStay && !isOutstationTravel
        ? { stayDateFrom: formData.stayDateFrom, stayDateTo: formData.stayDateTo }
        : {}),
      ...(isOutstationTravel
        ? {
            outStation: 'Yes' as const,
            arrivalDate: formData.arrivalDate,
            arrivalTime: formData.arrivalTime,
            departureDate: formData.departureDate,
            departureTime: formData.departureTime,
            durationHours: outstationDuration?.durationHours,
            durationDays: outstationDuration?.durationDays,
            travelAllowanceAmount: amountNum,
          }
        : {
            outStation: formData.expenseHead === 'Travel' ? ('No' as const) : undefined,
          }),
    };

    onSubmit(updated);
  };

  const subCategoryOptions = useMemo(() => {
    const base = getSubcategoriesForHead(formData.expenseHead);
    const saved =
      formData.subCategory !== SUB_CATEGORY_UNSET
        ? formData.subCategory.trim()
        : expense.subCategory?.trim() || '';
    if (saved && !base.includes(saved)) {
      return [...base, saved];
    }
    return base;
  }, [formData.expenseHead, formData.subCategory, expense.subCategory]);

  const subCategoryDisabled =
    !formData.expenseHead || !isCanonicalExpenseHead(formData.expenseHead);

  return (
    <form id="expense-edit-form" onSubmit={handleSubmit} className="space-y-4">
      {expense.auditStatus === 'Rejected' ? (
        <div className="space-y-2 rounded-md border border-red-200 bg-red-50 px-3 py-3">
          <Label htmlFor="reject_remark">Reject Remark</Label>
          <p id="reject_remark" className="text-sm text-gray-800">
            {expense.auditReason?.trim() || 'No reason mentioned'}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                outStation: value === 'Travel' ? formData.outStation : ('No' as const),
                arrivalDate: '',
                arrivalTime: '',
                departureDate: '',
                departureTime: '',
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
          <Label htmlFor="sub_category">Sub Category{!subCategoryDisabled ? ' *' : ''}</Label>
          <Select
            value={formData.subCategory}
            onValueChange={(value) => {
              const wasTravelDetail = isTravelCarOrBike(formData.expenseHead, effectiveSubCategory);
              const willTravelDetail = isTravelCarOrBike(formData.expenseHead, value);
              const wasHotelSelf = isHotelBookingSelf(formData.expenseHead, effectiveSubCategory);
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
                      serviceProvider: '',
                      billNumber: '',
                      supportingDocument: 'No' as const,
                    }
                  : {}),
                ...(willTravelDetail && !wasTravelDetail
                  ? {
                      amount: '0',
                      fuelType: FUEL_TYPE_UNSET,
                      serviceProvider: '',
                      billNumber: '',
                      supportingDocument: 'No' as const,
                    }
                  : {}),
                ...(wasHotelSelf && !willHotelSelf ? { stayDateFrom: '', stayDateTo: '' } : {}),
                ...(willHotelSelf && !wasHotelSelf ? { date: '' } : {}),
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

        {formData.expenseHead === 'Travel' ? (
          <div className="space-y-2">
            <Label htmlFor="out_station">OutStation (more than 100km) *</Label>
            <Select
              value={formData.outStation}
              onValueChange={(value: 'Yes' | 'No') =>
                setFormData({
                  ...formData,
                  outStation: value,
                  amount: value === 'Yes' ? '0' : formData.amount,
                })
              }
            >
              <SelectTrigger id="out_station">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {isOutstationTravel ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="arrival_date">Arrival Date *</Label>
              <Input
                id="arrival_date"
                type="date"
                value={formData.arrivalDate}
                onChange={(e) => setFormData({ ...formData, arrivalDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arrival_time">Arrival Time *</Label>
              <Input
                id="arrival_time"
                type="time"
                value={formData.arrivalTime}
                onChange={(e) => setFormData({ ...formData, arrivalTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departure_date">Departure Date (last) *</Label>
              <Input
                id="departure_date"
                type="date"
                value={formData.departureDate}
                onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departure_time">Departure Time *</Label>
              <Input
                id="departure_time"
                type="time"
                value={formData.departureTime}
                onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outstation_supporting_doc_choice">Supporting Document *</Label>
              <Select
                value={formData.supportingDocument}
                onValueChange={(value: 'Yes' | 'No') =>
                  setFormData({ ...formData, supportingDocument: value })
                }
              >
                <SelectTrigger id="outstation_supporting_doc_choice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.supportingDocument === 'Yes' ? (
              <div className="min-h-[5.5rem] space-y-2 sm:col-span-2">
                <Label htmlFor="outstation_supporting_file">Upload supporting document *</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="outstation_supporting_file"
                    type="file"
                    accept=".doc,.docx,.pdf,.jpg,.jpeg,.png,.xls,.xlsx"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (f && !SUPPORTING_FILE_EXT.test(f.name)) {
                        toast.error(
                          'Invalid file type. Allowed: DOC, DOCX, PDF, JPG, JPEG, PNG, XLS, XLSX',
                        );
                        e.target.value = '';
                        setSelectedFile(null);
                        return;
                      }
                      setSelectedFile(f);
                    }}
                    className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-sm file:font-medium"
                  />
                  <Upload className="h-5 w-5 shrink-0 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500">DOC, DOCX, PDF, JPG, JPEG, PNG, XLS, XLSX</p>
                {selectedFile ? <p className="text-xs text-green-600">✓ {selectedFile.name}</p> : null}
                {documents.length > 0 && !selectedFile ? (
                  <p className="text-xs text-gray-600">Current: {documents[0]?.fileName || 'document'}</p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {!isOutstationTravel ? (
        <div className="space-y-2">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="amount">Amount (Rs) *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder={isOutstationTravel || isAutoAmount ? 'Auto calculated' : '0.00'}
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            disabled={isAutoAmount || isOutstationTravel}
            readOnly={isAutoAmount || isOutstationTravel}
            className={isAutoAmount || isOutstationTravel ? 'bg-gray-50' : ''}
          />
          {isAutoAmount ? (
            <p className="text-xs text-gray-500">Auto-calculated using configured travel rates.</p>
          ) : isOutstationTravel ? (
            <p className="text-xs text-gray-500">Auto-calculated as Total Hours × ₹20.</p>
          ) : null}
        </div>
      </div>

      {!isOutstationTravel ? (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      ) : null}

      {!isOutstationTravel ? (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      ) : null}

      {!isOutstationTravel ? (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      ) : null}

      {!isOutstationTravel ? (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      ) : null}

      {!isOutstationTravel ? (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="monthYear">Month-Year (Auto-detected)</Label>
          <Input id="monthYear" value={formData.monthYear} disabled className="bg-gray-50" />
        </div>
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
      ) : null}

      {!isOutstationTravel && formData.supportingDocument === 'Yes' ? (
        <div className="min-h-[5.5rem] space-y-2">
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
                    'Invalid file type. Allowed: DOC, DOCX, PDF, JPG, JPEG, PNG, XLS, XLSX',
                  );
                  e.target.value = '';
                  setSelectedFile(null);
                  return;
                }
                setSelectedFile(f);
              }}
              className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-sm file:font-medium"
            />
            <Upload className="h-5 w-5 shrink-0 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500">DOC, DOCX, PDF, JPG, JPEG, PNG, XLS, XLSX</p>
          {selectedFile ? <p className="text-xs text-green-600">✓ {selectedFile.name}</p> : null}
          {documents.length > 0 && !selectedFile ? (
            <p className="text-xs text-green-700">
              ✓ Existing document attached: {documents[0].fileName} (upload a new file only if you
              want to replace it)
            </p>
          ) : null}
        </div>
      ) : null}

      {expense.employeeName ? (
        <div className="space-y-2">
          <Label htmlFor="employee_name">Employee Name</Label>
          <Input
            id="employee_name"
            value={expense.employeeName}
            readOnly
            disabled
            className="bg-gray-50"
          />
        </div>
      ) : null}

      {expense.auditStatus ? (
        <div className="space-y-2">
          <Label htmlFor="audit_status">Audit Status</Label>
          <Input
            id="audit_status"
            value={expense.auditStatus}
            readOnly
            disabled
            className="bg-gray-50"
          />
        </div>
      ) : null}
    </form>
  );
}
