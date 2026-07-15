import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, ArrowRightLeft, UserPlus, ChevronDownIcon } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '../ui/utils';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import type { User } from '../../App';
import type { DailyPlannerTeamMapping } from '../../types/dailyPlanner';
import {
  assignTeamMapping,
  removeTeamMapping,
  transferTeamMapping,
} from '../../hooks/dailyPlanner/dailyPlannerApi';
import {
  useInvalidateDailyPlannerQueries,
  useTeamMappingsQuery,
} from '../../hooks/dailyPlanner/useDailyPlannerQueries';
import { useEmployeesListQuery } from '../../hooks/employees/useEmployeesQuery';

interface TeamManagementTabProps {
  user: User;
}

export default function TeamManagementTab({ user }: TeamManagementTabProps) {
  const mappingsQuery = useTeamMappingsQuery();
  const employeesQuery = useEmployeesListQuery();
  const invalidate = useInvalidateDailyPlannerQueries();
  const [assignOpen, setAssignOpen] = useState(false);
  const [transferMapping, setTransferMapping] = useState<DailyPlannerTeamMapping | null>(null);
  const [selectedEmployeeCodes, setSelectedEmployeeCodes] = useState<Set<string>>(new Set());
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const employeeSelectorRef = useRef<HTMLDivElement>(null);
  const [transferManagerCode, setTransferManagerCode] = useState('');
  const [busy, setBusy] = useState(false);

  const managerCode = String(user.employeeCode || user.id || '').trim();
  const managerName = String(user.name || '').trim() || managerCode;

  const employees = employeesQuery.data ?? [];
  const employeeOptions = useMemo(
    () =>
      employees
        .map((e) => {
          const code = String(e.employee_code || e.employeeCode || '').trim();
          const name = `${e.first_name || e.firstName || ''} ${e.last_name || e.lastName || ''}`.trim() || code;
          return { code, name };
        })
        .filter((e) => e.code)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );

  const nameByCode = useMemo(() => {
    const map = new Map<string, string>();
    employeeOptions.forEach((e) => map.set(e.code, e.name));
    return map;
  }, [employeeOptions]);

  const mappings = (mappingsQuery.data ?? []).filter((m) => m.status === 'Active');

  const existingEmployeeCodesForManager = useMemo(() => {
    return new Set(
      mappings.filter((m) => m.managerCode === managerCode).map((m) => m.employeeCode),
    );
  }, [mappings, managerCode]);

  const assignableEmployees = useMemo(
    () => employeeOptions.filter((e) => e.code !== managerCode),
    [employeeOptions, managerCode],
  );

  const refresh = () => invalidate();

  const openAssignModal = () => {
    setSelectedEmployeeCodes(new Set());
    setEmployeePickerOpen(false);
    setEmployeeSearchQuery('');
    setAssignOpen(true);
  };

  useEffect(() => {
    if (!employeePickerOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!employeeSelectorRef.current?.contains(event.target as Node)) {
        setEmployeePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [employeePickerOpen]);

  const filteredAssignableEmployees = useMemo(() => {
    const query = employeeSearchQuery.trim().toLowerCase();
    if (!query) return assignableEmployees;
    return assignableEmployees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(query) ||
        employee.code.toLowerCase().includes(query),
    );
  }, [assignableEmployees, employeeSearchQuery]);

  const employeeFieldDisplay = useMemo(() => {
    if (selectedEmployeeCodes.size === 0) return 'Select Employees';
    return [...selectedEmployeeCodes]
      .map((code) => nameByCode.get(code) || code)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .join(', ');
  }, [nameByCode, selectedEmployeeCodes]);

  const toggleEmployeeSelection = (code: string, checked: boolean) => {
    setSelectedEmployeeCodes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  };

  const handleAssign = async () => {
    const selected = [...selectedEmployeeCodes];
    if (selected.length === 0) {
      toast.error('Select at least one employee');
      return;
    }

    const toAssign = selected.filter((code) => !existingEmployeeCodesForManager.has(code));
    const skippedCount = selected.length - toAssign.length;

    if (toAssign.length === 0) {
      toast.error('All selected employees are already assigned to you');
      return;
    }

    setBusy(true);
    try {
      await Promise.all(
        toAssign.map((employeeCode) =>
          assignTeamMapping({
            managerCode,
            managerName,
            employeeCode,
            employeeName: nameByCode.get(employeeCode) || employeeCode,
          }),
        ),
      );

      if (skippedCount === 0) {
        toast.success(
          `${toAssign.length} employee${toAssign.length === 1 ? '' : 's'} assigned successfully.`,
        );
      } else {
        toast.success(
          `${toAssign.length} employee${toAssign.length === 1 ? '' : 's'} assigned. ${skippedCount} employee${skippedCount === 1 ? ' was' : 's were'} already assigned.`,
        );
      }

      setAssignOpen(false);
      setSelectedEmployeeCodes(new Set());
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (mappingId: string) => {
    setBusy(true);
    try {
      await removeTeamMapping(mappingId);
      toast.success('Mapping removed');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferMapping || !transferManagerCode) {
      toast.error('Select new manager');
      return;
    }
    setBusy(true);
    try {
      await transferTeamMapping(
        transferMapping.mappingId,
        transferManagerCode,
        nameByCode.get(transferManagerCode) || transferManagerCode,
      );
      toast.success('Mapping transferred');
      setTransferMapping(null);
      setTransferManagerCode('');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" className="bg-[#007BFF] hover:bg-[#0056b3]" onClick={openAssignModal}>
          <UserPlus className="mr-2 h-4 w-4" />
          Assign
        </Button>
      </div>

      <Card className="border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Reporting Manager</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No team mappings yet. Assign a manager to an employee to get started.
                </TableCell>
              </TableRow>
            ) : (
              mappings.map((mapping) => (
                <TableRow key={mapping.mappingId}>
                  <TableCell>{mapping.employeeName || mapping.employeeCode}</TableCell>
                  <TableCell>{mapping.managerName || mapping.managerCode}</TableCell>
                  <TableCell>{mapping.status}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Transfer"
                        disabled={busy}
                        onClick={() => {
                          setTransferMapping(mapping);
                          setTransferManagerCode('');
                        }}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Remove"
                        disabled={busy}
                        onClick={() => void handleRemove(mapping.mappingId)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open);
          if (!open) {
            setSelectedEmployeeCodes(new Set());
            setEmployeePickerOpen(false);
            setEmployeeSearchQuery('');
          }
        }}
      >
        <DialogContent className="max-w-md overflow-hidden">
          <DialogHeader><DialogTitle>Assign Team Mapping</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="reporting-manager-readonly">Reporting Manager</Label>
              <Input
                id="reporting-manager-readonly"
                value={managerName}
                readOnly
                disabled
                className="bg-gray-50"
              />
            </div>
            <div ref={employeeSelectorRef} className="space-y-1">
              <Label htmlFor="employee-multi-select-trigger">Employee</Label>
              <button
                id="employee-multi-select-trigger"
                type="button"
                aria-expanded={employeePickerOpen}
                aria-haspopup="listbox"
                className={cn(
                  'border-input flex min-h-9 w-full items-center justify-between gap-2 rounded-md border bg-input-background px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                )}
                onClick={() => setEmployeePickerOpen((open) => !open)}
              >
                <span
                  className={cn(
                    'min-w-0 flex-1 text-left leading-snug',
                    selectedEmployeeCodes.size === 0 && 'text-muted-foreground',
                    selectedEmployeeCodes.size > 0 && 'line-clamp-2',
                  )}
                >
                  {employeeFieldDisplay}
                </span>
                <ChevronDownIcon
                  className={cn(
                    'size-4 shrink-0 opacity-50 transition-transform',
                    employeePickerOpen && 'rotate-180',
                  )}
                />
              </button>
              {employeePickerOpen ? (
                <div className="rounded-md border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 p-2">
                    <Input
                      value={employeeSearchQuery}
                      onChange={(event) => setEmployeeSearchQuery(event.target.value)}
                      placeholder="Search employees…"
                      aria-label="Search employees"
                    />
                  </div>
                  <div
                    role="listbox"
                    aria-multiselectable="true"
                    className="p-2"
                    style={{
                      maxHeight: '300px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                    }}
                  >
                    <div className="space-y-1">
                      {filteredAssignableEmployees.length === 0 ? (
                        <p className="px-1 py-2 text-sm text-muted-foreground">
                          No matching employees.
                        </p>
                      ) : (
                        filteredAssignableEmployees.map((employee) => {
                          const alreadyAssigned = existingEmployeeCodesForManager.has(employee.code);
                          const checked = selectedEmployeeCodes.has(employee.code);
                          return (
                            <label
                              key={employee.code}
                              className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 hover:bg-gray-50"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) =>
                                  toggleEmployeeSelection(employee.code, value === true)
                                }
                              />
                              <span className="text-sm text-[#212529]">
                                {employee.name}
                                {alreadyAssigned ? (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    (already assigned)
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button type="button" disabled={busy} onClick={() => void handleAssign()}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!transferMapping} onOpenChange={(v) => !v && setTransferMapping(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Transfer Mapping</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Transfer {transferMapping?.employeeName} to a new reporting manager.
          </p>
          <div className="space-y-1">
            <Label>New Manager</Label>
            <Select value={transferManagerCode} onValueChange={setTransferManagerCode}>
              <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
              <SelectContent>
                {employeeOptions.map((e) => (
                  <SelectItem key={e.code} value={e.code}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTransferMapping(null)}>Cancel</Button>
            <Button type="button" disabled={busy} onClick={() => void handleTransfer()}>Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
