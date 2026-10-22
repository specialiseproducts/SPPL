import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const DOC_ACCEPT = '.doc,.docx,.pdf,.jpg,.jpeg,.png,.xls,.xlsx,.ppt,.pptx';

export interface EnhancedTaskFieldValues {
  needsDocument: 'Yes' | 'No';
  progressDone: number | null;
  documentFile: File | null;
  /** When more than one file is chosen, all files are listed here (documentFile = first). */
  documentFiles?: File[];
}

/** Files to upload: prefers documentFiles, falls back to the single documentFile. */
export function resolveDocumentFiles(
  values: Pick<EnhancedTaskFieldValues, 'documentFile' | 'documentFiles'>,
): File[] {
  if (values.documentFiles && values.documentFiles.length > 0) return values.documentFiles;
  return values.documentFile ? [values.documentFile] : [];
}

/** Single File for one selection, File[] when multiple (combined into one PDF on the server). */
export function resolveDocumentUploadPayload(
  values: Pick<EnhancedTaskFieldValues, 'documentFile' | 'documentFiles'>,
): File | File[] | null {
  const files = resolveDocumentFiles(values);
  if (files.length === 0) return null;
  return files.length === 1 ? files[0] : files;
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
  /** Factory v2: always show Progress Done regardless of project-based flag. */
  alwaysShowProgressDone?: boolean;
  /** Progress Done is derived (e.g. from procedure steps) — show it but do not allow edits. */
  progressReadOnly?: boolean;
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
  alwaysShowProgressDone = false,
  progressReadOnly = false,
}: DailyPlannerEnhancedTaskFieldsProps) {
  const showProgress = alwaysShowProgressDone || isProjectBased;
  const selectedFiles = resolveDocumentFiles(values);
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
              documentFiles: v === 'No' ? [] : values.documentFiles,
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
                multiple
                accept={DOC_ACCEPT}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  onChange({
                    documentFile: files[0] ?? null,
                    // Keep the full selection (including a single file) so upload + labels stay in sync.
                    documentFiles: files,
                  });
                }}
              />
              <p className="text-xs text-gray-500">
                DOC, DOCX, PDF, JPG, JPEG, PNG, XLS, XLSX, PPT, PPTX. You can select multiple files
                (PDF, JPG, PNG); they are combined into one PDF on upload.
              </p>
              {selectedFiles.length > 0 ? (
                <ul className="space-y-0.5">
                  {selectedFiles.map((f) => (
                    <li
                      key={`${f.name}-${f.size}-${f.lastModified}`}
                      className="truncate text-xs text-green-600"
                      title={f.name}
                    >
                      ✓ {f.name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {showProgress ? (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-progress`}>Progress Done (%)</Label>
          <Input
            id={`${idPrefix}-progress`}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            disabled={readOnly || progressReadOnly}
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
