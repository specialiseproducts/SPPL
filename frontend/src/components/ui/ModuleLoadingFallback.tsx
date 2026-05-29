import { Loader2 } from 'lucide-react';

export function ModuleLoadingFallback({ label = 'Loading module…' }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-gray-500">
      <Loader2 className="h-8 w-8 animate-spin text-[#007BFF]" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}
