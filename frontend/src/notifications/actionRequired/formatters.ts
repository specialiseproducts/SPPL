const FIELD_LABELS: Record<string, string> = {
  unitPrice: 'Unit Price',
  quantity: 'Quantity',
  warranty: 'Warranty',
  decisionExpectedBy: 'Decision Expected By',
  principal: 'Principle',
  modelNumber: 'Model Number',
  productDescription: 'Product Description',
  probabilityLabel: 'Probability %',
  probabilityPercent: 'Probability %',
};

export function formatActionValues(values: Record<string, unknown> | undefined): string {
  const entries = Object.entries(values || {}).filter(([k]) => k !== 'probabilityPercent');
  if (entries.length === 0) return '—';
  return entries
    .map(([k, v]) => `${FIELD_LABELS[k] || k}: ${v == null || v === '' ? '—' : String(v)}`)
    .join('; ');
}

export function formatActionDateTime(iso: unknown): string {
  try {
    const d = new Date(String(iso || ''));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

export function alreadyProcessedErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (/already been processed|only pending|not pending|already/i.test(msg)) {
    return 'This request has already been processed.';
  }
  return msg || 'Request failed';
}
