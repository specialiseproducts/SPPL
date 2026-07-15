import { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import type { ExpenseDocument } from '../../types/expenses';

const SIGNED_URL_ENDPOINT = '/api/users/file-url';

type PreviewPhase = 'idle' | 'loading' | 'ready' | 'no_attachment' | 'preview_failed';

function extractObjectKey(value?: string): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('http')) {
    return trimmed.replace(/^\/+/, '');
  }
  try {
    const u = new URL(trimmed);
    let path = u.pathname.replace(/^\/+/, '');
    if (u.hostname.startsWith('s3.') && path.includes('/')) {
      const segments = path.split('/');
      if (segments.length > 1) {
        return segments.slice(1).join('/');
      }
    }
    return path;
  } catch {
    return trimmed.replace(/^\/+/, '');
  }
}

function isPdfFile(fileName?: string, fileUrl?: string): boolean {
  const hay = `${fileName ?? ''} ${fileUrl ?? ''}`.toLowerCase();
  return hay.includes('.pdf');
}

function isImageFile(fileName?: string, fileUrl?: string): boolean {
  const hay = `${fileName ?? ''} ${fileUrl ?? ''}`.toLowerCase();
  return /\.(jpe?g|png|webp|gif|bmp)(\?|$|#)/i.test(hay);
}

async function fetchSignedPreviewUrl(fileUrl: string, expenseId: string): Promise<string> {
  const key = extractObjectKey(fileUrl);
  if (!key) {
    throw new Error('Missing file key for signed URL');
  }
  const params = new URLSearchParams({ key });
  if (expenseId) {
    params.set('expenseId', expenseId);
  }
  const data = await apiFetch(`${SIGNED_URL_ENDPOINT}?${params.toString()}`);
  if (!data?.success || !data?.url) {
    throw new Error(
      typeof data?.message === 'string' && data.message.trim()
        ? data.message
        : 'Failed to generate signed URL',
    );
  }
  return String(data.url);
}

interface ExpenseDocumentPreviewPanelProps {
  expenseId?: string;
  documents?: ExpenseDocument[];
  enabled?: boolean;
}

export default function ExpenseDocumentPreviewPanel({
  expenseId = '',
  documents = [],
  enabled = true,
}: ExpenseDocumentPreviewPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewPhase, setPreviewPhase] = useState<PreviewPhase>('idle');

  useEffect(() => {
    if (!enabled) {
      setPreviewUrl(null);
      setPreviewFileName('');
      setPreviewPhase('idle');
      return;
    }

    const document = documents.length > 0 ? documents[0] : null;
    if (!document?.fileUrl) {
      setPreviewUrl(null);
      setPreviewFileName('');
      setPreviewPhase('no_attachment');
      return;
    }

    let cancelled = false;

    const load = async () => {
      setPreviewPhase('loading');
      setPreviewFileName(document.fileName || 'document');

      try {
        const signed = await fetchSignedPreviewUrl(document.fileUrl, expenseId);
        if (!cancelled) {
          setPreviewUrl(signed);
          setPreviewPhase('ready');
        }
      } catch (signedErr) {
        console.error('Expense document signed URL failed:', signedErr);
        if (document.fileUrl.startsWith('http') && !cancelled) {
          setPreviewUrl(document.fileUrl);
          setPreviewPhase('ready');
        } else if (!cancelled) {
          setPreviewPhase('preview_failed');
          setPreviewUrl(null);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, expenseId, documents]);

  if (previewPhase === 'loading' || previewPhase === 'idle') {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm text-gray-500">
        Loading document…
      </div>
    );
  }

  if (previewPhase === 'ready' && previewUrl) {
    if (isPdfFile(previewFileName, previewUrl)) {
      return (
        <iframe
          title="Supporting Document"
          src={previewUrl}
          className="h-full min-h-0 w-full flex-1 rounded-md border border-gray-200"
        />
      );
    }
    if (isImageFile(previewFileName, previewUrl)) {
      return (
        <div className="flex h-full min-h-0 flex-1 items-center justify-center">
          <img
            src={previewUrl}
            alt="Supporting Document"
            className="max-h-full max-w-full object-contain"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            onError={() => {
              console.error('Expense image preview failed to render');
              setPreviewPhase('preview_failed');
              setPreviewUrl(null);
            }}
          />
        </div>
      );
    }
    return (
      <iframe
        title="Supporting Document"
        src={previewUrl}
        className="h-full min-h-0 w-full flex-1 rounded-md border border-gray-200"
      />
    );
  }

  if (previewPhase === 'preview_failed') {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-gray-500">
        Document could not be loaded.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm text-gray-500">
      No attached document available.
    </div>
  );
}
