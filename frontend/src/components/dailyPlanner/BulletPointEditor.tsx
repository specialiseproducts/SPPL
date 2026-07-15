import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  formatBulletPoints,
  hasBulletContent,
  parseBulletPoints,
} from './bulletPointUtils';

export interface BulletPointEditorHandle {
  /** Trim, drop empty bullets, return formatted string for API storage. */
  getFormattedValue: () => string;
  hasContent: () => boolean;
  reset: () => void;
}

interface BulletPointEditorProps {
  label: string;
  defaultValue?: string;
  required?: boolean;
  id?: string;
}

function initialPoints(defaultValue?: string): string[] {
  const parsed = parseBulletPoints(defaultValue);
  return parsed.length > 0 ? parsed : [''];
}

const BulletPointEditor = forwardRef<BulletPointEditorHandle, BulletPointEditorProps>(
  function BulletPointEditor({ label, defaultValue = '', required, id }, ref) {
    const [points, setPoints] = useState<string[]>(() => initialPoints(defaultValue));
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
    const focusIndexRef = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      getFormattedValue: () => formatBulletPoints(points),
      hasContent: () => hasBulletContent(points),
      reset: () => {
        setPoints(['']);
        focusIndexRef.current = null;
      },
    }));

    useEffect(() => {
      if (focusIndexRef.current === null) return;
      const index = focusIndexRef.current;
      focusIndexRef.current = null;
      requestAnimationFrame(() => {
        const input =
          inputRefs.current[index] ??
          rowRefs.current[index]?.querySelector<HTMLInputElement>('input');
        input?.focus();
      });
    }, [points]);

    const setPoint = (index: number, text: string) => {
      setPoints((prev) => {
        const next = [...prev];
        next[index] = text;
        return next;
      });
    };

    const addPoint = () => {
      setPoints((prev) => {
        focusIndexRef.current = prev.length;
        return [...prev, ''];
      });
    };

    const removePoint = (index: number) => {
      setPoints((prev) => {
        if (prev.length <= 1) return [''];
        return prev.filter((_, i) => i !== index);
      });
    };

    return (
      <div className="space-y-2">
        <Label htmlFor={id}>
          {label}
          {required ? ' *' : ''}
        </Label>
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
          {points.map((point, index) => (
            <div
              key={index}
              ref={(el) => {
                rowRefs.current[index] = el;
              }}
              className="flex items-center gap-2"
            >
              <span className="shrink-0 text-sm font-medium text-gray-500">•</span>
              <Input
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                id={index === 0 ? id : undefined}
                value={point}
                onChange={(e) => setPoint(index, e.target.value)}
                placeholder="Enter point…"
                className="flex-1 bg-white"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-gray-400 hover:text-red-600"
                onClick={() => removePoint(index)}
                aria-label="Remove point"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 gap-1"
            onClick={addPoint}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Point
          </Button>
        </div>
      </div>
    );
  },
);

export default BulletPointEditor;
