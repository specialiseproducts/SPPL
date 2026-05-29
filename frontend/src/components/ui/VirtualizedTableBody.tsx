import type { RefObject, ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TableBody, TableCell, TableRow } from './table';

const DEFAULT_ROW_HEIGHT = 52;

export interface VirtualizedTableBodyProps<T> {
  /** Scroll container wrapping the `<Table>` (overflow-auto parent). */
  parentRef: RefObject<HTMLDivElement | null>;
  rows: T[];
  colSpan: number;
  rowHeight?: number;
  isLoading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  getRowKey: (row: T, index: number) => string;
  getRowClassName?: (row: T, index: number) => string;
  /** Return `<TableCell>` elements for one row. */
  renderCells: (row: T, index: number) => ReactNode;
}

/** Virtualized `<TableBody>` — mounts only visible rows. */
export function VirtualizedTableBody<T>({
  parentRef,
  rows,
  colSpan,
  rowHeight = DEFAULT_ROW_HEIGHT,
  isLoading = false,
  loadingMessage = 'Loading…',
  emptyMessage = 'No records found.',
  getRowKey,
  getRowClassName,
  renderCells,
}: VirtualizedTableBodyProps<T>) {
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <TableBody>
      {isLoading ? (
        <TableRow>
          <TableCell colSpan={colSpan} className="py-14 text-center text-sm text-gray-500">
            {loadingMessage}
          </TableCell>
        </TableRow>
      ) : rows.length === 0 ? (
        <TableRow>
          <TableCell colSpan={colSpan} className="py-14 text-center text-sm text-gray-500">
            {emptyMessage}
          </TableCell>
        </TableRow>
      ) : (
        <>
          {paddingTop > 0 && (
            <TableRow aria-hidden>
              <TableCell colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 0 }} />
            </TableRow>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <TableRow
                key={getRowKey(row, virtualRow.index)}
                data-index={virtualRow.index}
                className={getRowClassName?.(row, virtualRow.index)}
              >
                {renderCells(row, virtualRow.index)}
              </TableRow>
            );
          })}
          {paddingBottom > 0 && (
            <TableRow aria-hidden>
              <TableCell colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 0 }} />
            </TableRow>
          )}
        </>
      )}
    </TableBody>
  );
}
