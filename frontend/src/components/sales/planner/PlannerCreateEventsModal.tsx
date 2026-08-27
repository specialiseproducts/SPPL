import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import type { PlannerEventDraft, PlannerOrganizationOption } from '../../../types/planner';
import { EMPTY_PLANNER_EVENT_DRAFT, PLANNER_MEETING_MODES } from '../../../types/planner';
import type { SalesHistoryRecord } from '../../../types/salesHistory';
import { createPlannerEvents } from '../../../hooks/sales/plannerApi';
import { fetchSalesHistory } from '../../../hooks/sales/salesHistoryApi';
import ContactPersonFields from './ContactPersonFields';
import {
  getWarrantyStatus,
  productLabel,
  type WarrantyStatusLabel,
} from './plannerWarrantyUtils';

/** Fixed widths so review sales-history columns never compress/overlap. */
const REVIEW_HEAD_STICKY = 'sticky top-0 bg-gray-50 whitespace-nowrap';
const REVIEW_CELL_CLIP = 'overflow-hidden text-sm';

const REVIEW_TABLE_MIN_WIDTH = 1300;
const REVIEW_DATE_W = 140;
const REVIEW_INVOICE_W = 170;
const REVIEW_PRINCIPLE_W = 180;
const REVIEW_PART_W = 160;
const REVIEW_DESC_W = 220;
const REVIEW_SERIAL_W = 160;
const REVIEW_WARRANTY_W = 120;
const REVIEW_STATUS_W = 150;

const REVIEW_STICKY_DATE: CSSProperties = {
  position: 'sticky',
  left: 0,
  width: REVIEW_DATE_W,
  minWidth: REVIEW_DATE_W,
  maxWidth: REVIEW_DATE_W,
};
const REVIEW_STICKY_INVOICE: CSSProperties = {
  position: 'sticky',
  left: REVIEW_DATE_W,
  width: REVIEW_INVOICE_W,
  minWidth: REVIEW_INVOICE_W,
  maxWidth: REVIEW_INVOICE_W,
};
const REVIEW_STICKY_PRINCIPLE: CSSProperties = {
  position: 'sticky',
  left: REVIEW_DATE_W + REVIEW_INVOICE_W,
  width: REVIEW_PRINCIPLE_W,
  minWidth: REVIEW_PRINCIPLE_W,
  maxWidth: REVIEW_PRINCIPLE_W,
};
const REVIEW_COL_PART: CSSProperties = {
  width: REVIEW_PART_W,
  minWidth: REVIEW_PART_W,
  maxWidth: REVIEW_PART_W,
};
const REVIEW_COL_DESC: CSSProperties = {
  width: REVIEW_DESC_W,
  minWidth: REVIEW_DESC_W,
  maxWidth: REVIEW_DESC_W,
};
const REVIEW_COL_SERIAL: CSSProperties = {
  width: REVIEW_SERIAL_W,
  minWidth: REVIEW_SERIAL_W,
  maxWidth: REVIEW_SERIAL_W,
};
const REVIEW_COL_WARRANTY: CSSProperties = {
  width: REVIEW_WARRANTY_W,
  minWidth: REVIEW_WARRANTY_W,
  maxWidth: REVIEW_WARRANTY_W,
};
const REVIEW_COL_STATUS: CSSProperties = {
  width: REVIEW_STATUS_W,
  minWidth: REVIEW_STATUS_W,
  maxWidth: REVIEW_STATUS_W,
};

interface PlannerCreateEventsModalProps {
  open: boolean;
  visitDate: string;
  organizations: PlannerOrganizationOption[];
  contactTitleOptions: string[];
  onClose: () => void;
  onCreated: () => void;
}

type Step = 'form' | 'review';

type ReviewRow = SalesHistoryRecord & {
  warrantyStatus: WarrantyStatusLabel;
};

function formatDisplayDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function displayCell(value: string | number | null | undefined): string {
  if (value === undefined || value === null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}

function TruncatedText({ value }: { value: string | number | null | undefined }) {
  const text = displayCell(value);
  return (
    <span className="block max-w-full truncate" title={text === '—' ? undefined : text}>
      {text}
    </span>
  );
}

function ViewField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="text-sm text-[#212529] break-words">{value}</div>
    </div>
  );
}

function ViewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-[#212529]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function warrantyBadge(status: WarrantyStatusLabel) {
  if (status === 'Within Warranty') {
    return (
      <Badge className="border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
        Within Warranty
      </Badge>
    );
  }
  if (status === 'Warranty Expired') {
    return (
      <Badge className="border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
        Warranty Expired
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700">
      Unable to determine
    </Badge>
  );
}

function matchCustomerRecords(
  records: SalesHistoryRecord[],
  organizationName: string,
): SalesHistoryRecord[] {
  const target = organizationName.trim().toLowerCase();
  if (!target) return [];
  return records.filter((row) => String(row.customerName || '').trim().toLowerCase() === target);
}

async function loadHistoryForOrganizations(
  organizationNames: string[],
): Promise<Map<string, SalesHistoryRecord[] | 'error'>> {
  const unique = Array.from(
    new Set(organizationNames.map((n) => n.trim()).filter(Boolean)),
  );
  const map = new Map<string, SalesHistoryRecord[] | 'error'>();

  await Promise.all(
    unique.map(async (name) => {
      try {
        const { data } = await fetchSalesHistory({ customer: name });
        map.set(name, matchCustomerRecords(data, name));
      } catch {
        map.set(name, 'error');
      }
    }),
  );

  return map;
}

export default function PlannerCreateEventsModal({
  open,
  visitDate,
  organizations,
  contactTitleOptions,
  onClose,
  onCreated,
}: PlannerCreateEventsModalProps) {
  const [blocks, setBlocks] = useState<PlannerEventDraft[]>([EMPTY_PLANNER_EVENT_DRAFT()]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [historyByOrg, setHistoryByOrg] = useState<Map<string, SalesHistoryRecord[] | 'error'>>(
    new Map(),
  );

  const activeOrgs = useMemo(
    () =>
      organizations
        .filter((o) => o.isActive)
        .sort((a, b) =>
          a.organizationName.localeCompare(b.organizationName, undefined, { sensitivity: 'base' }),
        ),
    [organizations],
  );

  useEffect(() => {
    if (open) {
      setBlocks([EMPTY_PLANNER_EVENT_DRAFT()]);
      setStep('form');
      setHistoryByOrg(new Map());
      setReviewLoading(false);
      setBusy(false);
    }
  }, [open, visitDate]);

  const updateBlock = (index: number, patch: Partial<PlannerEventDraft>) => {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  };

  const handleOrgChange = (index: number, orgSk: string) => {
    const org = activeOrgs.find((o) => o.sk === orgSk);
    if (!org) {
      updateBlock(index, {
        organizationId: '',
        organizationName: '',
        organizationAddress: '',
        contactAddress: '',
      });
      return;
    }
    updateBlock(index, {
      organizationId: org.sk,
      organizationName: org.organizationName,
      organizationAddress: org.address,
      contactAddress: org.address,
    });
  };

  const validateBlocks = (): boolean => {
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (!b.organizationId || !b.modeOfMeeting || !b.contactFullName.trim() || !b.purpose.trim()) {
        toast.error(`Please complete all required fields for event ${i + 1}`);
        return false;
      }
    }
    return true;
  };

  const handleReview = async () => {
    if (!validateBlocks()) return;
    setReviewLoading(true);
    try {
      const orgNames = blocks.map((b) => b.organizationName);
      const map = await loadHistoryForOrganizations(orgNames);
      setHistoryByOrg(map);
      setStep('review');
    } catch {
      setHistoryByOrg(new Map());
      setStep('review');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateBlocks()) return;
    setBusy(true);
    try {
      await createPlannerEvents(visitDate, blocks);
      toast.success(`${blocks.length} planner event(s) saved`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save events');
    } finally {
      setBusy(false);
    }
  };

  const reviewRowsByOrg = useMemo(() => {
    const result = new Map<string, ReviewRow[] | 'error'>();
    for (const [orgName, rows] of historyByOrg.entries()) {
      if (rows === 'error') {
        result.set(orgName, 'error');
        continue;
      }
      result.set(
        orgName,
        rows.map((row) => ({
          ...row,
          warrantyStatus: getWarrantyStatus(row.invoiceDate, row.warranty, visitDate),
        })),
      );
    }
    return result;
  }, [historyByOrg, visitDate]);

  const discussionGroups = useMemo(() => {
    const within: string[] = [];
    const expired: string[] = [];
    const seenWithin = new Set<string>();
    const seenExpired = new Set<string>();

    for (const rows of reviewRowsByOrg.values()) {
      if (rows === 'error') continue;
      for (const row of rows) {
        const label = productLabel(row);
        if (row.warrantyStatus === 'Within Warranty') {
          if (!seenWithin.has(label)) {
            seenWithin.add(label);
            within.push(label);
          }
        } else if (row.warrantyStatus === 'Warranty Expired') {
          if (!seenExpired.has(label)) {
            seenExpired.add(label);
            expired.push(label);
          }
        }
      }
    }

    return { within, expired };
  }, [reviewRowsByOrg]);

  const uniqueOrgNames = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const b of blocks) {
      const n = b.organizationName.trim();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      names.push(n);
    }
    return names;
  }, [blocks]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={
          step === 'review'
            ? 'max-h-[90vh] max-w-5xl overflow-x-hidden overflow-y-auto sm:max-w-5xl'
            : 'max-h-[90vh] max-w-2xl overflow-y-auto'
        }
      >
        <DialogHeader>
          <DialogTitle>{step === 'review' ? 'Review Event' : 'Create planner events'}</DialogTitle>
          <DialogDescription>
            {visitDate
              ? `Visit date: ${formatDisplayDate(visitDate)}`
              : 'Select a date on the calendar'}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' ? (
          <div className="space-y-6">
            {blocks.map((block, index) => (
              <div
                key={index}
                className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                {blocks.length > 1 ? (
                  <p className="text-sm font-medium text-muted-foreground">Event {index + 1}</p>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor={`pl-org-${index}`}>Customer Organization *</Label>
                  <select
                    id={`pl-org-${index}`}
                    className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                    value={block.organizationId}
                    onChange={(e) => handleOrgChange(index, e.target.value)}
                  >
                    <option value="">Select customer organization…</option>
                    {activeOrgs.map((o) => (
                      <option key={o.sk} value={o.sk}>
                        {o.organizationName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`pl-mode-${index}`}>Mode Of Meeting *</Label>
                  <select
                    id={`pl-mode-${index}`}
                    className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                    value={block.modeOfMeeting}
                    onChange={(e) =>
                      updateBlock(index, {
                        modeOfMeeting: e.target.value as PlannerEventDraft['modeOfMeeting'],
                      })
                    }
                  >
                    <option value="">Select mode…</option>
                    {PLANNER_MEETING_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <ContactPersonFields
                  idPrefix={`pl-${index}`}
                  contactTitleOptions={contactTitleOptions}
                  values={{
                    contactTitle: block.contactTitle,
                    contactFullName: block.contactFullName,
                    contactAddress: block.contactAddress,
                    contactNumber: block.contactNumber,
                    contactEmail: block.contactEmail,
                  }}
                  onChange={(patch) => updateBlock(index, patch)}
                />

                <div className="space-y-2">
                  <Label htmlFor={`pl-purpose-${index}`}>Purpose *</Label>
                  <Textarea
                    id={`pl-purpose-${index}`}
                    rows={3}
                    value={block.purpose}
                    onChange={(e) => updateBlock(index, { purpose: e.target.value })}
                    placeholder="Meeting objective / purpose"
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setBlocks((prev) => [...prev, EMPTY_PLANNER_EVENT_DRAFT()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <ViewSection title="Event Details">
              <div className="space-y-4">
                {blocks.map((block, index) => (
                  <div
                    key={index}
                    className={
                      blocks.length > 1
                        ? 'space-y-3 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0'
                        : 'space-y-3'
                    }
                  >
                    {blocks.length > 1 ? (
                      <p className="text-sm font-medium text-muted-foreground">Event {index + 1}</p>
                    ) : null}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <ViewField label="Customer Organization" value={displayCell(block.organizationName)} />
                      <ViewField label="Date" value={visitDate ? formatDisplayDate(visitDate) : '—'} />
                      <ViewField label="Mode of Meeting" value={displayCell(block.modeOfMeeting)} />
                      <ViewField
                        label="Contact Person"
                        value={displayCell(
                          [block.contactTitle, block.contactFullName].filter(Boolean).join(' '),
                        )}
                      />
                      <ViewField label="Phone Number" value={displayCell(block.contactNumber)} />
                      <ViewField label="Email" value={displayCell(block.contactEmail)} />
                      <ViewField label="Contact Address" value={displayCell(block.contactAddress)} />
                      <div className="sm:col-span-2">
                        <ViewField label="Purpose" value={displayCell(block.purpose)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ViewSection>

            {uniqueOrgNames.map((orgName) => {
              const rowsOrError = reviewRowsByOrg.get(orgName);
              const loadError = rowsOrError === 'error';
              const rows = loadError || !rowsOrError ? [] : rowsOrError;
              return (
                <ViewSection key={orgName} title={`Customer Sales History — ${orgName}`}>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Sales records associated with {orgName}.
                  </p>
                  {loadError ? (
                    <p className="text-sm text-muted-foreground">
                      Sales history could not be loaded. You may still submit this event.
                    </p>
                  ) : rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No sales history records were found for this customer organization.
                    </p>
                  ) : (
                    <div className="max-h-[280px] overflow-auto rounded-md border [&_[data-slot=table-container]]:overflow-visible">
                      <Table
                        style={{
                          tableLayout: 'fixed',
                          width: REVIEW_TABLE_MIN_WIDTH,
                          minWidth: REVIEW_TABLE_MIN_WIDTH,
                        }}
                      >
                        <TableHeader>
                          <TableRow className="bg-gray-50 hover:bg-gray-50">
                            <TableHead
                              className={`${REVIEW_HEAD_STICKY} z-40`}
                              style={{ ...REVIEW_STICKY_DATE, top: 0 }}
                            >
                              Invoice Date
                            </TableHead>
                            <TableHead
                              className={`${REVIEW_HEAD_STICKY} z-40`}
                              style={{ ...REVIEW_STICKY_INVOICE, top: 0 }}
                            >
                              Invoice Number
                            </TableHead>
                            <TableHead
                              className={`${REVIEW_HEAD_STICKY} z-40`}
                              style={{ ...REVIEW_STICKY_PRINCIPLE, top: 0 }}
                            >
                              Principle
                            </TableHead>
                            <TableHead
                              className={`${REVIEW_HEAD_STICKY} z-30`}
                              style={REVIEW_COL_PART}
                            >
                              Part Number
                            </TableHead>
                            <TableHead
                              className={`${REVIEW_HEAD_STICKY} z-30`}
                              style={REVIEW_COL_DESC}
                            >
                              Item Description
                            </TableHead>
                            <TableHead
                              className={`${REVIEW_HEAD_STICKY} z-30`}
                              style={REVIEW_COL_SERIAL}
                            >
                              Serial Number
                            </TableHead>
                            <TableHead
                              className={`${REVIEW_HEAD_STICKY} z-30`}
                              style={REVIEW_COL_WARRANTY}
                            >
                              Warranty
                            </TableHead>
                            <TableHead
                              className={`${REVIEW_HEAD_STICKY} z-30`}
                              style={REVIEW_COL_STATUS}
                            >
                              Warranty Status
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.recordId}>
                              <TableCell
                                className={`${REVIEW_CELL_CLIP} sticky z-10 bg-white`}
                                style={REVIEW_STICKY_DATE}
                              >
                                <TruncatedText
                                  value={row.invoiceDate ? formatDisplayDate(row.invoiceDate) : '—'}
                                />
                              </TableCell>
                              <TableCell
                                className={`${REVIEW_CELL_CLIP} sticky z-10 bg-white font-mono`}
                                style={REVIEW_STICKY_INVOICE}
                              >
                                <TruncatedText value={row.invoiceNumber} />
                              </TableCell>
                              <TableCell
                                className={`${REVIEW_CELL_CLIP} sticky z-10 bg-white`}
                                style={REVIEW_STICKY_PRINCIPLE}
                              >
                                <TruncatedText value={row.principal} />
                              </TableCell>
                              <TableCell
                                className={`${REVIEW_CELL_CLIP} font-mono`}
                                style={REVIEW_COL_PART}
                              >
                                <TruncatedText value={row.partNumber} />
                              </TableCell>
                              <TableCell className={REVIEW_CELL_CLIP} style={REVIEW_COL_DESC}>
                                <TruncatedText value={row.itemDescription} />
                              </TableCell>
                              <TableCell
                                className={`${REVIEW_CELL_CLIP} font-mono`}
                                style={REVIEW_COL_SERIAL}
                              >
                                <TruncatedText value={row.serialNumber} />
                              </TableCell>
                              <TableCell className={REVIEW_CELL_CLIP} style={REVIEW_COL_WARRANTY}>
                                <TruncatedText value={row.warranty} />
                              </TableCell>
                              <TableCell className={REVIEW_CELL_CLIP} style={REVIEW_COL_STATUS}>
                                {warrantyBadge(row.warrantyStatus)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </ViewSection>
              );
            })}

            <ViewSection title="Discussion Preparation">
              {discussionGroups.within.length === 0 && discussionGroups.expired.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No warranty-based discussion recommendations are available for this customer.
                </p>
              ) : (
                <div className="space-y-4">
                  {discussionGroups.within.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[#212529]">Within Warranty</p>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-[#212529]">
                        {discussionGroups.within.map((label) => (
                          <li key={`w-${label}`}>{label}</li>
                        ))}
                      </ul>
                      <p className="text-sm text-muted-foreground">
                        Recommended discussion: Enquire with the end user regarding whether the
                        equipment/product is working properly and whether they are experiencing any
                        issues, difficulties, or operational concerns.
                      </p>
                    </div>
                  ) : null}

                  {discussionGroups.expired.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[#212529]">Warranty Expired</p>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-[#212529]">
                        {discussionGroups.expired.map((label) => (
                          <li key={`e-${label}`}>{label}</li>
                        ))}
                      </ul>
                      <p className="text-sm text-muted-foreground">
                        Recommended discussion: Discuss AMC requirements and review the
                        equipment/product&apos;s performance with the customer.
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </ViewSection>
          </div>
        )}

        <DialogFooter>
          {step === 'form' ? (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={busy || reviewLoading}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleReview()} disabled={busy || reviewLoading}>
                {reviewLoading ? 'Preparing review…' : 'Review'}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('form')}
                disabled={busy}
              >
                Back
              </Button>
              <Button type="button" onClick={() => void handleSubmit()} disabled={busy}>
                Submit
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
