import { useEffect, useState, type MutableRefObject } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import type { DailyPlannerProjectObservation } from '../../types/dailyPlanner';
import { fetchDailyPlannerProjectObservations } from '../../hooks/dailyPlanner/dailyPlannerApi';
import BulletPointList from './BulletPointList';

export type ProjectObservationsCache = Map<string, DailyPlannerProjectObservation[]>;

const DEBOUNCE_MS = 300;

function cacheKey(projectName: string): string {
  return projectName.trim().toLowerCase();
}

function formatSubmittedAt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

interface ProjectObservationsButtonProps {
  projectName: string;
  /** Shared per-modal cache (keyed by project name) to avoid repeated fetches. */
  cacheRef: MutableRefObject<ProjectObservationsCache>;
}

/** Factory: small "Obs." button shown next to Project Name when the project has observations. */
export default function ProjectObservationsButton({
  projectName,
  cacheRef,
}: ProjectObservationsButtonProps) {
  const [observations, setObservations] = useState<DailyPlannerProjectObservation[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const name = projectName.trim();
    if (!name) {
      setObservations([]);
      return undefined;
    }
    const key = cacheKey(name);
    const cached = cacheRef.current.get(key);
    if (cached) {
      setObservations(cached);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchDailyPlannerProjectObservations(name)
        .then((rows) => {
          cacheRef.current.set(key, rows);
          if (!cancelled) setObservations(rows);
        })
        .catch(() => {
          if (!cancelled) setObservations([]);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [projectName, cacheRef]);

  if (!projectName.trim() || observations.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        Obs.
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Observations — {projectName.trim()}</DialogTitle>
          </DialogHeader>
          <ul className="space-y-3">
            {observations.map((obs) => (
              <li key={obs.observationId} className="rounded-md border border-gray-200 p-3 text-sm">
                <BulletPointList text={obs.observationText} />
                <p className="mt-2 text-xs text-gray-500">
                  {obs.employeeName || obs.employeeCode || '—'} · {formatSubmittedAt(obs.submittedAt)}
                </p>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
