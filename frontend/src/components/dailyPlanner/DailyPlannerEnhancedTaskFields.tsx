import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const DOC_ACCEPT = '.doc,.docx,.pdf,.jpg,.jpeg,.png,.xls,.xlsx,.ppt,.pptx';

export interface EnhancedTaskFieldValues {
  needsDocument: 'Yes' | 'No';
  progressDone: number | null;
  documentFile: File | null;
}

interface DailyPlannerEnhancedTaskFieldsProps {
  values: EnhancedTaskFieldValues;
  onChange: (patch: Partial<EnhancedTaskFieldValues>) => void;
  /** When true, hide file picker (view-only / already uploaded). */
  readOnly?: boolean;
  showUpload?: boolean;
  idPrefix?: string;
  existingFileName?: string;
  /**
   * Progress Done (%) is only shown for project-based tasks.
   * When false/undefined, Progress Done is hidden and not required.
   */
  isProjectBased?: boolean;
}

/** Document + Progress Done fields for eligible Factory / Office SuperAdmin users. */
export default function DailyPlannerEnhancedTaskFields({
  values,
  onChange,
  readOnly = false,
  showUpload = true,
  idPrefix = 'enhanced',
  existingFileName,
  isProjectBased = false,
}: DailyPlannerEnhancedTaskFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-needs-doc`}>Do you need to upload document?</Label>
        <Select
          value={values.needsDocument}
          onValueChange={(v) =>
            onChange({
              needsDocument: v as 'Yes' | 'No',
              documentFile: v === 'No' ? null : values.documentFile,
            })
          }
          disabled={readOnly}
        >
          <SelectTrigger id={`${idPrefix}-needs-doc`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="No">No</SelectItem>
            <SelectItem value="Yes">Yes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showUpload && values.needsDocument === 'Yes' ? (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-file`}>Upload Document</Label>
          {existingFileName ? (
            <p className="text-xs text-green-700">Employee Document attached</p>
          ) : null}
          {!readOnly ? (
            <>
              <Input
                id={`${idPrefix}-file`}
                type="file"
                accept={DOC_ACCEPT}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  onChange({ documentFile: f });
                }}
              />
              <p className="text-xs text-gray-500">
                DOC, DOCX, PDF, JPG, JPEG, PNG, XLS, XLSX, PPT, PPTX
              </p>
              {values.documentFile ? (
                <p className="text-xs text-green-600">✓ {values.documentFile.name}</p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {isProjectBased ? (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-progress`}>Progress Done (%)</Label>
          <Input
            id={`${idPrefix}-progress`}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            disabled={readOnly}
            value={values.progressDone == null ? '' : String(values.progressDone)}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                onChange({ progressDone: null });
                return;
              }
              const n = Number(raw);
              if (!Number.isFinite(n)) return;
              onChange({ progressDone: Math.max(0, Math.min(100, Math.round(n))) });
            }}
            placeholder="0–100"
          />
        </div>
      ) : null}
    </div>
  );
}
