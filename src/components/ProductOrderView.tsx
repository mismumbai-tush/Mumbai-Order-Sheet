import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { ProductOrderRow } from '../types/fms';
import { productOrderColumns } from '../data/sampleOrders';
import {
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit3,
  Pin,
  EyeOff
} from 'lucide-react';

export type SearchBasisMode = 'customer_or_order' | 'customer' | 'order_no' | 'all';
export type ProductOrderSortOrder = 'newest' | 'pending' | 'sheet';
export type ProductOrderFreezeTarget = 'NONE' | '#' | 'A' | 'B' | 'C' | 'D' | 'E';
export type NewOrdersFilterMode = 'NONE' | 'LAST_MONTH_TODAY' | 'TODAY_YESTERDAY';

interface ProductOrderViewProps {
  orders: ProductOrderRow[];
  searchTerm?: string;
  setSearchTerm?: (val: string) => void;
  searchMode?: SearchBasisMode;
  visibleCols?: Record<string, boolean>;
  isFullWidth: boolean;
  onGenerateOrderNo: (orderId: string, customNo?: string) => void;
  onGenerateAllPending?: () => void;
  onDeleteRow?: (orderId: string) => void;
  onClearAllRows?: () => void;
  onOpenImportModal?: () => void;
  onUpdateRow?: (orderId: string, field: keyof ProductOrderRow, value: any) => void;
  onNavigateToAutomation: () => void;
  onAddNewRow?: (row: ProductOrderRow) => void;
  onFetchQueryLive?: () => void;
  isFetchingLive?: boolean;
  onOpenQueryStudio?: () => void;
  onPurgeDelhiAndLock?: () => void;
  lastSyncedAt?: string | null;
  webAppConfigured?: boolean;
  onOpenTwoWaySyncModal?: () => void;
  onOpenColumnManager?: () => void;
  onHideColumn?: (colLetter: string) => void;
  onShowAllColumns?: () => void;
  newOrdersFilterMode?: NewOrdersFilterMode;
  selectedYear?: string;
  selectedMonth?: string;
  sortOrder?: ProductOrderSortOrder;
  freezeUpTo?: ProductOrderFreezeTarget;
  currentPage?: number;
  setCurrentPage?: React.Dispatch<React.SetStateAction<number>>;
  pageSize?: number;
  setPageSize?: React.Dispatch<React.SetStateAction<number>>;
  highlightedOrderId?: string | null;
}

// Robust helper to parse order date and timestamp into year, month, day
const parseSingleDateStr = (raw: string, preferMDY: boolean): { year?: number; month?: number; day?: number } => {
  const str = (raw || '').trim();
  if (!str) return {};

  // 1. ISO format: YYYY-MM-DD (unambiguous)
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10)
    };
  }

  // 2. Slash/dash date pattern: A/B/YYYY (e.g. 11/3/2026 or 29/1/2026)
  const slashMatch = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    let yr = parseInt(slashMatch[3], 10);
    if (yr < 100) yr += 2000;

    if (p2 > 12 && p1 <= 12) {
      return { month: p1, day: p2, year: yr };
    }
    if (p1 > 12 && p2 <= 12) {
      return { day: p1, month: p2, year: yr };
    }
    return preferMDY
      ? { month: p1, day: p2, year: yr }
      : { day: p1, month: p2, year: yr };
  }

  return {};
};

export function parseOrderDateInfo(dateStr?: string, timestampStr?: string): { year?: number; month?: number; day?: number } {
  const fromOrderDate = dateStr ? parseSingleDateStr(dateStr, false) : {};
  if (fromOrderDate.year && fromOrderDate.month && fromOrderDate.day) {
    return fromOrderDate;
  }
  // Google Sheets form timestamps are usually US M/D/YYYY HH:mm:ss
  return timestampStr ? parseSingleDateStr(timestampStr, true) : {};
}

function toLocalMidnightDate(info: { year?: number; month?: number; day?: number }): Date | null {
  if (!info.year || !info.month || !info.day) return null;
  return new Date(info.year, info.month - 1, info.day, 0, 0, 0, 0);
}

export function extractAvailableYears(orders: ProductOrderRow[]): string[] {
  const yearsSet = new Set<string>();
  orders.forEach(row => {
    const info = parseOrderDateInfo(row.orderDate, row.timestamp);
    if (info.year && info.year >= 2020 && info.year <= 2035) {
      yearsSet.add(String(info.year));
    }
  });
  if (yearsSet.size === 0) {
    yearsSet.add(String(new Date().getFullYear()));
  }
  return Array.from(yearsSet).sort().reverse();
}

export interface CustomerOrderGroup {
  customerKey: string;
  customerName: string;
  rows: ProductOrderRow[];
  dayTag: 'TODAY' | 'KAL' | 'RECENT';
  latestDateTs: number;
  highestWeight: number;
  totalQty: number;
  salesPerson: string;
  latestDateLabel: string;
}

export function computeNewOrdersMetrics(orders: ProductOrderRow[]) {
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth() + 1;
  const todayD = now.getDate();

  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yestY = yest.getFullYear();
  const yestM = yest.getMonth() + 1;
  const yestD = yest.getDate();

  const lastMonthStart = new Date(todayY, todayM - 2, todayD, 0, 0, 0, 0);
  const todayEnd = new Date(todayY, todayM - 1, todayD, 23, 59, 59, 999);

  const rawBlankItems: Array<{ row: ProductOrderRow; weight: number }> = [];
  const customerMap = new Map<string, CustomerOrderGroup>();

  orders.forEach((row, idx) => {
    const hasBlankOrderNo = !row.orderNo || row.orderNo.trim() === '';
    if (!hasBlankOrderNo) return;

    const info = parseOrderDateInfo(row.orderDate, row.timestamp);
    const localDate = toLocalMidnightDate(info);
    if (!localDate) return;

    if (localDate >= lastMonthStart && localDate <= todayEnd) {
      const weight = row.sheetRowIndex ?? idx;
      rawBlankItems.push({ row, weight });

      const isToday = info.year === todayY && info.month === todayM && info.day === todayD;
      const isYest = info.year === yestY && info.month === yestM && info.day === yestD;
      const rowTag: 'TODAY' | 'KAL' | 'RECENT' = isToday ? 'TODAY' : isYest ? 'KAL' : 'RECENT';
      const dateTs = localDate.getTime();

      const displayCustomer = (row.customerName || 'Unknown Customer').trim();
      const customerKey = displayCustomer.toLowerCase();
      const existing = customerMap.get(customerKey);

      if (!existing) {
        customerMap.set(customerKey, {
          customerKey,
          customerName: displayCustomer,
          rows: [row],
          dayTag: rowTag,
          latestDateTs: dateTs,
          highestWeight: weight,
          totalQty: Number(row.qty) || 0,
          salesPerson: row.salesPerson || '',
          latestDateLabel: row.orderDate || row.timestamp?.split(' ')[0] || ''
        });
      } else {
        existing.rows.push(row);
        existing.totalQty += Number(row.qty) || 0;
        if (!existing.salesPerson && row.salesPerson) {
          existing.salesPerson = row.salesPerson;
        }
        if (rowTag === 'TODAY' || (rowTag === 'KAL' && existing.dayTag === 'RECENT')) {
          existing.dayTag = rowTag;
        }
        if (dateTs > existing.latestDateTs) {
          existing.latestDateTs = dateTs;
          existing.latestDateLabel = row.orderDate || row.timestamp?.split(' ')[0] || existing.latestDateLabel;
        }
        if (weight > existing.highestWeight) {
          existing.highestWeight = weight;
        }
      }
    }
  });

  const customerGroups = Array.from(customerMap.values()).sort((a, b) => {
    if (b.latestDateTs !== a.latestDateTs) return b.latestDateTs - a.latestDateTs;
    return b.highestWeight - a.highestWeight;
  });

  customerGroups.forEach(g => {
    g.rows.sort((a, b) => (b.sheetRowIndex ?? 0) - (a.sheetRowIndex ?? 0));
  });

  const todayYesterdayGroups = customerGroups.filter(
    g => g.dayTag === 'TODAY' || g.dayTag === 'KAL'
  );

  return {
    rawBlankItems,
    customerGroups,
    todayYesterdayGroups,
    totalNewCount: customerGroups.length,
    todayYesterdayCount: todayYesterdayGroups.length,
    totalRowCount: rawBlankItems.length,
    windowLabel: `${lastMonthStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – Today`
  };
}

export const ProductOrderView: React.FC<ProductOrderViewProps> = ({
  orders,
  searchTerm,
  searchMode = 'customer_or_order',
  visibleCols,
  isFullWidth,
  onGenerateOrderNo,
  onClearAllRows,
  onNavigateToAutomation,
  onHideColumn,
  newOrdersFilterMode = 'NONE',
  selectedYear = 'ALL',
  selectedMonth = 'ALL',
  sortOrder = 'newest',
  freezeUpTo = 'B',
  currentPage: propCurrentPage,
  setCurrentPage: propSetCurrentPage,
  pageSize: propPageSize,
  setPageSize: propSetPageSize,
  highlightedOrderId = null
}) => {
  const [inputOrderNos, setInputOrderNos] = useState<Record<string, string>>({});
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  const [localCurrentPage, setLocalCurrentPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState<number>(30);
  const currentPage = propCurrentPage ?? localCurrentPage;
  const setCurrentPage = propSetCurrentPage ?? setLocalCurrentPage;
  const pageSize = propPageSize ?? localPageSize;
  const setPageSize = propSetPageSize ?? setLocalPageSize;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchMode]);

  // Filtered rows based on: Search, Pending O.N, Year, Month, Today/Yesterday
  const filteredRows = useMemo(() => {
    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth() + 1;
    const todayD = now.getDate();

    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestY = yest.getFullYear();
    const yestM = yest.getMonth() + 1;
    const yestD = yest.getDate();

    const matched = orders.filter(row => {
      const hasBlankOrderNo = !row.orderNo || row.orderNo.trim() === '';

      const dateInfo = parseOrderDateInfo(row.orderDate, row.timestamp);
      const rowLocalDate = toLocalMidnightDate(dateInfo);

      // 1b. New Orders Notification Box filter (Blank Col S within Last Month -> Today OR Kal/Today)
      if (newOrdersFilterMode !== 'NONE') {
        if (!hasBlankOrderNo) return false;
        const isToday = dateInfo.year === todayY && dateInfo.month === todayM && dateInfo.day === todayD;
        const isYest = dateInfo.year === yestY && dateInfo.month === yestM && dateInfo.day === yestD;
        if (newOrdersFilterMode === 'TODAY_YESTERDAY') {
          if (!isToday && !isYest) return false;
        } else if (newOrdersFilterMode === 'LAST_MONTH_TODAY') {
          const lastMonthStart = new Date(todayY, todayM - 2, todayD, 0, 0, 0, 0);
          const todayEnd = new Date(todayY, todayM - 1, todayD, 23, 59, 59, 999);
          if (!rowLocalDate || rowLocalDate < lastMonthStart || rowLocalDate > todayEnd) {
            return false;
          }
        }
      }

      // 3. Year filter
      if (selectedYear !== 'ALL') {
        if (!dateInfo.year || String(dateInfo.year) !== selectedYear) {
          return false;
        }
      }

      // 4. Month filter
      if (selectedMonth !== 'ALL') {
        if (!dateInfo.month || String(dateInfo.month) !== selectedMonth) {
          return false;
        }
      }

      // 5. Search query (Customer Name / Order Number basis)
      if (searchTerm && searchTerm.trim() !== '') {
        const q = searchTerm.trim().toLowerCase();
        const matchCust = (row.customerName || '').toLowerCase().includes(q);
        const matchOrderNo = (row.orderNo || '').toLowerCase().includes(q);

        if (searchMode === 'customer') {
          if (!matchCust) return false;
        } else if (searchMode === 'order_no') {
          if (!matchOrderNo) return false;
        } else if (searchMode === 'customer_or_order') {
          if (!matchCust && !matchOrderNo) return false;
        } else {
          const matchRef = (row.referenceNo || '').toLowerCase().includes(q);
          const matchItem = (row.itemName || '').toLowerCase().includes(q);
          const matchSales = (row.salesPerson || '').toLowerCase().includes(q);
          const matchContact = (row.salesPersonContact || '').toLowerCase().includes(q);
          const matchPhone = (row.customerNumber || '').toLowerCase().includes(q);
          const matchRemark = (row.remark || '').toLowerCase().includes(q);
          if (!matchRef && !matchCust && !matchItem && !matchOrderNo && !matchSales && !matchContact && !matchPhone && !matchRemark) {
            return false;
          }
        }
      }
      return true;
    });

    const rowWeight = (r: ProductOrderRow, fallbackIdx: number) => r.sheetRowIndex ?? fallbackIdx;

    if (sortOrder === 'newest') {
      return matched
        .map((r, idx) => ({ r, w: rowWeight(r, idx) }))
        .sort((a, b) => b.w - a.w)
        .map(x => x.r);
    }

    if (sortOrder === 'pending') {
      return matched
        .map((r, idx) => ({
          r,
          w: rowWeight(r, idx),
          isPend: !r.orderNo || r.orderNo.trim() === '' ? 1 : 0
        }))
        .sort((a, b) => {
          if (a.isPend !== b.isPend) return b.isPend - a.isPend;
          return b.w - a.w;
        })
        .map(x => x.r);
    }

    return matched;
  }, [orders, newOrdersFilterMode, selectedYear, selectedMonth, searchTerm, searchMode, sortOrder]);

  // Safe pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / (pageSize || 30)));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    if (pageSize === 0) return filteredRows; // All
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safeCurrentPage, pageSize]);

  return (
    <div className="space-y-1.5 w-full max-w-full min-w-0">
      {/* Main Flat Table Grid (Columns A to S with Hide/Show & Overlap-Free Frozen Columns) */}
      <ProductOrderTableGrid
        paginatedRows={paginatedRows}
        filteredRowsCount={filteredRows.length}
        visibleCols={visibleCols}
        freezeUpTo={freezeUpTo}
        isFullWidth={isFullWidth}
        safeCurrentPage={safeCurrentPage}
        pageSize={pageSize}
        highlightedOrderId={highlightedOrderId}
        editingRowId={editingRowId}
        setEditingRowId={setEditingRowId}
        inputOrderNos={inputOrderNos}
        setInputOrderNos={setInputOrderNos}
        onGenerateOrderNo={onGenerateOrderNo}
        onNavigateToAutomation={onNavigateToAutomation}
        onHideColumn={onHideColumn}
      />

      {/* 5. Pagination Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-700">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-800">
            Showing {pageSize === 0 ? 1 : (safeCurrentPage - 1) * pageSize + 1}–
            {pageSize === 0 ? filteredRows.length : Math.min(safeCurrentPage * pageSize, filteredRows.length)} of{' '}
            <strong className="text-emerald-700 font-bold font-mono">{filteredRows.length.toLocaleString()}</strong> rows
            {filteredRows.length !== orders.length && (
              <span className="text-slate-500 font-normal ml-1">
                (filtered from {orders.length.toLocaleString()} total)
              </span>
            )}
          </span>

          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-slate-300">
            <span className="text-[11px] text-slate-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value={20}>20 rows</option>
              <option value={30}>30 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={250}>250 rows</option>
              <option value={500}>500 rows</option>
              <option value={0}>All (Full Sheet View)</option>
            </select>
          </div>
        </div>

        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-2 text-xs font-medium text-slate-600">
              Page <strong className="text-slate-900">{safeCurrentPage}</strong> of <strong>{totalPages}</strong>
            </span>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* MODAL: CLEAR ALL ROWS CONFIRMATION */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-gradient-to-r from-rose-900 to-red-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-300" />
                <h3 className="font-bold text-sm">Clear All Product Order Data?</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">
                Are you sure you want to completely delete all <span className="text-rose-600 font-bold">{orders.length.toLocaleString()}</span> rows from Product Order?
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] space-y-1">
                <p className="font-semibold text-rose-900">• Sheet will be set to a clean slate (0 rows).</p>
                <p>• You can then click "Import Sheet" to fetch your orders directly from Google Sheet ID <code>1xSSZ6DyQarQJOd8UpOfCV-tjdKL1oQq_IKuXJkcRv5Q</code> (Tab: Product Order).</p>
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearAllRows) onClearAllRows();
                  setShowClearConfirmModal(false);
                }}
                className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete All {orders.length.toLocaleString()} Rows</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

interface ProductOrderTableGridProps {
  paginatedRows: ProductOrderRow[];
  filteredRowsCount: number;
  visibleCols?: Record<string, boolean>;
  freezeUpTo: 'NONE' | '#' | 'A' | 'B' | 'C' | 'D' | 'E';
  isFullWidth: boolean;
  safeCurrentPage: number;
  pageSize: number;
  highlightedOrderId: string | null;
  editingRowId: string | null;
  setEditingRowId: (id: string | null) => void;
  inputOrderNos: Record<string, string>;
  setInputOrderNos: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onGenerateOrderNo: (orderId: string, customNo?: string) => void;
  onNavigateToAutomation: () => void;
  onHideColumn?: (colLetter: string) => void;
}

const FREEZE_SEQUENCE: Array<'#' | 'A' | 'B' | 'C' | 'D' | 'E'> = ['#', 'A', 'B', 'C', 'D', 'E'];

const ProductOrderTableGrid: React.FC<ProductOrderTableGridProps> = ({
  paginatedRows,
  filteredRowsCount,
  visibleCols,
  freezeUpTo,
  isFullWidth,
  safeCurrentPage,
  pageSize,
  highlightedOrderId,
  editingRowId,
  setEditingRowId,
  inputOrderNos,
  setInputOrderNos,
  onGenerateOrderNo,
  onNavigateToAutomation,
  onHideColumn
}) => {
  const visibleColumns = useMemo(
    () => productOrderColumns.filter(col => !visibleCols || visibleCols[col.colLetter] !== false),
    [visibleCols]
  );

  const frozenKeys = useMemo(() => {
    if (freezeUpTo === 'NONE') return [] as string[];
    const maxIdx = FREEZE_SEQUENCE.indexOf(freezeUpTo);
    const list: string[] = ['#'];
    visibleColumns.forEach(col => {
      const idx = FREEZE_SEQUENCE.indexOf(col.colLetter as any);
      if (idx !== -1 && idx <= maxIdx) {
        list.push(col.colLetter);
      }
    });
    return list;
  }, [freezeUpTo, visibleColumns]);

  const frozenSet = useMemo(() => new Set(frozenKeys), [frozenKeys]);
  const lastFrozenKey = frozenKeys.length > 0 ? frozenKeys[frozenKeys.length - 1] : null;

  const headerRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const [frozenLeftOffsets, setFrozenLeftOffsets] = useState<Record<string, number>>({ '#': 0 });

  useLayoutEffect(() => {
    if (frozenKeys.length === 0) {
      setFrozenLeftOffsets({});
      return;
    }

    const computeOffsets = () => {
      const next: Record<string, number> = {};
      let acc = 0;
      for (const key of frozenKeys) {
        next[key] = acc;
        const el = headerRefs.current[key];
        if (el) {
          acc += el.getBoundingClientRect().width;
        }
      }
      setFrozenLeftOffsets(prev => {
        const same =
          Object.keys(next).length === Object.keys(prev).length &&
          Object.keys(next).every(k => Math.abs((prev[k] ?? -1) - next[k]) < 0.5);
        return same ? prev : next;
      });
    };

    computeOffsets();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(computeOffsets) : null;
    if (ro) {
      frozenKeys.forEach(k => {
        const el = headerRefs.current[k];
        if (el) ro.observe(el);
      });
    }
    window.addEventListener('resize', computeOffsets);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', computeOffsets);
    };
  }, [frozenKeys, paginatedRows, isFullWidth]);

  const getStickyHeaderProps = (key: string, defaultStyle?: React.CSSProperties) => {
    if (!frozenSet.has(key)) {
      return { style: defaultStyle, extraClass: '' };
    }
    const leftVal = frozenLeftOffsets[key] ?? 0;
    const isLast = lastFrozenKey === key;
    return {
      style: { ...defaultStyle, left: `${leftVal}px` },
      extraClass: `sticky z-40 ${isLast ? 'border-r-2 border-r-slate-400 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.35)]' : ''}`
    };
  };

  const getStickyBodyCellProps = (key: string, solidBgClass: string) => {
    if (!frozenSet.has(key)) {
      return { style: undefined, extraClass: solidBgClass };
    }
    const leftVal = frozenLeftOffsets[key] ?? 0;
    const isLast = lastFrozenKey === key;
    return {
      style: { left: `${leftVal}px` },
      extraClass: `sticky z-20 ${solidBgClass} ${isLast ? 'border-r-2 border-r-slate-400 shadow-[4px_0_8px_-2px_rgba(15,23,42,0.18)]' : ''}`
    };
  };

  const renderCellContent = (colLetter: string, row: ProductOrderRow, hasOrderNo: boolean) => {
    switch (colLetter) {
      case 'A':
        return <span className="text-slate-600 font-mono whitespace-nowrap text-[11px]">{row.timestamp}</span>;
      case 'B':
        return (
          <div className="flex items-center gap-1 max-w-[140px] truncate font-bold text-slate-900 text-[11px]" title={row.customerName}>
            <span className="truncate">{row.customerName}</span>
            {row.customerPO && row.customerPO !== 'N/A' && (
              <span className="text-[10px] text-slate-400 font-normal shrink-0">({row.customerPO})</span>
            )}
          </div>
        );
      case 'C':
        return <span className="text-slate-700 whitespace-nowrap text-[11px]">{row.orderDate}</span>;
      case 'D':
        return (
          <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-semibold whitespace-nowrap">
            {row.unit || '—'}
          </span>
        );
      case 'E':
        return (
          <div className="max-w-[130px] truncate font-semibold text-slate-900 text-[11px]" title={row.itemName}>
            {row.itemName}
          </div>
        );
      case 'F':
        return <span className="text-slate-700 whitespace-nowrap text-[11px]">{row.color || '—'}</span>;
      case 'G':
        return <span className="text-slate-700 whitespace-nowrap text-[11px]">{row.width || '—'}</span>;
      case 'H':
        return <span className="font-mono text-slate-600 text-[10px] whitespace-nowrap block text-center">{row.unitOfItem || 'MTR'}</span>;
      case 'I':
        return <span className="font-mono font-bold text-slate-900 text-[11px] block text-right">{Number(row.qty).toLocaleString()}</span>;
      case 'J':
        return <span className="font-mono text-slate-700 text-[11px] block text-right">₹{row.rate}</span>;
      case 'K':
        return <span className="font-mono text-slate-600 text-[11px] block text-center">{row.discount}%</span>;
      case 'L':
        return <span className="text-slate-700 whitespace-nowrap text-[11px]">{row.deliveryDate || '—'}</span>;
      case 'M':
        return (
          <span className="max-w-[110px] truncate px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 block text-[10px]" title={row.remark}>
            {row.remark || '—'}
          </span>
        );
      case 'N':
        return <span className="font-mono text-slate-700 whitespace-nowrap text-[11px]">{row.customerNumber || '—'}</span>;
      case 'O':
        return (
          <span className="max-w-[110px] truncate px-1.5 py-0.2 rounded bg-sky-50 text-sky-900 border border-sky-200 block text-[10px]" title={row.billingAddress}>
            {row.billingAddress || '—'}
          </span>
        );
      case 'P':
        return (
          <span className="max-w-[110px] truncate px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 border border-amber-200 block text-[10px]" title={row.deliveryAddress}>
            {row.deliveryAddress || '—'}
          </span>
        );
      case 'Q':
        return <span className="text-slate-800 font-medium whitespace-nowrap text-[11px]">{row.salesPerson || '—'}</span>;
      case 'R':
        return <span className="font-mono text-slate-700 whitespace-nowrap text-[11px]">{row.salesPersonContact || '—'}</span>;
      case 'S':
        if (hasOrderNo && editingRowId !== row.orderId) {
          return (
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-slate-900 px-2 py-0.5 rounded bg-white border border-slate-300 shadow-2xs text-[11px]">
                {row.orderNo}
              </span>
              <button
                type="button"
                onClick={() => {
                  setInputOrderNos(prev => ({ ...prev, [row.orderId]: row.orderNo || '' }));
                  setEditingRowId(row.orderId);
                }}
                className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                title="Edit Order No & sync with Google Sheet"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <span
                onClick={onNavigateToAutomation}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded px-1.5 py-0.5 cursor-pointer hover:bg-emerald-200"
                title="Click to view in Product Automation"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Active</span>
                <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
              </span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="e.g. MMFSO2526-01752"
              value={inputOrderNos[row.orderId] ?? ''}
              onChange={(e) => setInputOrderNos({ ...inputOrderNos, [row.orderId]: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const manualVal = inputOrderNos[row.orderId];
                  onGenerateOrderNo(row.orderId, manualVal);
                  setEditingRowId(null);
                }
              }}
              className="w-36 px-1.5 py-0.5 text-[11px] bg-white border border-amber-300 rounded font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={() => {
                const manualVal = inputOrderNos[row.orderId];
                onGenerateOrderNo(row.orderId, manualVal);
                setEditingRowId(null);
              }}
              className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              title="Save Order No in App + Google Sheet & flow to Product Automation"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>{editingRowId === row.orderId ? 'Save' : 'Assign'}</span>
            </button>
            {editingRowId === row.orderId && (
              <button
                type="button"
                onClick={() => setEditingRowId(null)}
                className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Cancel edit"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`w-full max-w-full overflow-x-auto overflow-y-auto ${isFullWidth ? 'h-[calc(100vh-145px)] max-h-[88vh] min-h-[320px]' : 'h-[min(640px,calc(100vh-185px))] min-h-[320px]'} select-text relative fms-sheet-scroll border border-slate-300 rounded-lg shadow-inner bg-white`}>
      <table className="table-auto w-max min-w-full border-separate border-spacing-0 text-xs text-left">
        {/* Sticky Header Rows */}
        <thead className="sticky top-0 z-30 select-none font-mono text-[11px]">
          {/* Strip 1: Google Sheet Column Letters */}
          <tr className="bg-slate-900 text-slate-400 text-[10px]">
            {(() => {
              const sProps = getStickyHeaderProps('#', { minWidth: '40px', width: '40px' });
              return (
                <th
                  style={sProps.style}
                  className={`w-10 px-1.5 py-0.5 text-center bg-slate-950 text-slate-400 border-r border-b border-slate-800 ${sProps.extraClass}`}
                >
                  #
                </th>
              );
            })()}
            {visibleColumns.map((col) => {
              const isLockedQueryCol = col.colLetter !== 'S';
              let tint = 'bg-slate-900 text-slate-300 border-r border-b border-slate-800';
              if (col.colLetter === 'S') tint = 'bg-emerald-950 text-emerald-300 border-r border-b border-emerald-900 font-extrabold';
              else if (['A', 'B', 'C'].includes(col.colLetter)) tint = 'bg-sky-950 text-sky-300 border-r border-b border-sky-900';
              else if (['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].includes(col.colLetter)) tint = 'bg-amber-950 text-amber-300 border-r border-b border-amber-800 font-bold';
              else tint = 'bg-indigo-950 text-indigo-300 border-r border-b border-indigo-900';

              const sProps = getStickyHeaderProps(col.colLetter);

              return (
                <th
                  key={col.id}
                  style={sProps.style}
                  className={`px-1.5 py-0.5 text-center font-mono whitespace-nowrap group/col ${tint} ${sProps.extraClass}`}
                >
                  <span className="inline-flex items-center justify-center gap-1 w-full">
                    <span>Col {col.colLetter}</span>
                    {frozenSet.has(col.colLetter) && (
                      <Pin className="w-2.5 h-2.5 text-sky-300 inline" />
                    )}
                    {isLockedQueryCol ? (
                      <span className="text-[9px] text-amber-400 font-normal opacity-80" title="Locked: Streamed from =QUERY(...) formula">🔒</span>
                    ) : (
                      <span className="text-[9px] text-emerald-300 font-bold" title="Unlocked: Enter or Generate Order Number">🔓</span>
                    )}
                    {onHideColumn && visibleColumns.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onHideColumn(col.colLetter);
                        }}
                        className="ml-auto p-0.5 rounded opacity-55 hover:opacity-100 hover:bg-rose-600/80 text-slate-300 hover:text-white transition-all cursor-pointer"
                        title={`Hide Col ${col.colLetter} (${col.label})`}
                      >
                        <EyeOff className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>

          {/* Strip 2: Exact Column Names (Measured for Exact Frozen Offsets) */}
          <tr className="border-t border-slate-700">
            {(() => {
              const sProps = getStickyHeaderProps('#', { minWidth: '40px', width: '40px' });
              return (
                <th
                  ref={(el) => { headerRefs.current['#'] = el; }}
                  style={sProps.style}
                  className={`w-10 px-1.5 py-1 text-center bg-slate-900 text-slate-100 border-r border-b-2 border-b-slate-950 border-slate-800 font-bold ${sProps.extraClass}`}
                >
                  #
                </th>
              );
            })()}
            {visibleColumns.map((col) => {
              let bgHead = 'bg-slate-800 text-slate-100 border-r border-b-2 border-b-slate-950 border-slate-700 font-bold';
              if (col.colLetter === 'S') bgHead = 'bg-emerald-800 text-emerald-100 border-r border-b-2 border-b-slate-950 border-emerald-700 font-extrabold';
              else if (['A', 'B', 'C'].includes(col.colLetter)) bgHead = 'bg-sky-900 text-sky-100 border-r border-b-2 border-b-slate-950 border-sky-800 font-bold';
              else if (['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].includes(col.colLetter)) bgHead = 'bg-amber-800 text-amber-100 border-r border-b-2 border-b-slate-950 border-amber-700 font-extrabold';
              else bgHead = 'bg-indigo-900 text-indigo-100 border-r border-b-2 border-b-slate-950 border-indigo-800 font-bold';

              const sProps = getStickyHeaderProps(col.colLetter);

              return (
                <th
                  key={col.id}
                  ref={(el) => { headerRefs.current[col.colLetter] = el; }}
                  style={sProps.style}
                  className={`px-2 py-1 whitespace-nowrap ${bgHead} ${sProps.extraClass}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold">{col.label}</span>
                    {col.id === 'orderNo' ? (
                      <span className="text-[9px] px-1 bg-amber-400 text-slate-950 rounded font-extrabold">
                        TRIGGER 🔓
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-400 font-mono" title="Read-only query column">
                        🔒
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="font-sans">
          {filteredRowsCount === 0 ? (
            <tr>
              <td colSpan={visibleColumns.length + 1} className="text-center py-12 text-slate-500 bg-white">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No orders match the filter or search criteria in Product Order.</p>
                <p className="text-xs text-slate-400 mt-1">Try resetting the month/year filter, or click &quot;Sync Live Sheet&quot; to load your orders.</p>
              </td>
            </tr>
          ) : (
            paginatedRows.map((row, index) => {
              const hasOrderNo = Boolean(row.orderNo && row.orderNo.trim() !== '');
              const isHighlighted = highlightedOrderId === row.orderId;
              const rowIndex = (safeCurrentPage - 1) * (pageSize || 30) + index + 1;

              // 100% opaque solid background classes so scrolling cells NEVER show through frozen columns
              const solidCellBg = isHighlighted
                ? 'bg-amber-100'
                : !hasOrderNo
                  ? 'bg-[#fffbeb] group-hover:bg-[#fef3c7]'
                  : index % 2 === 0
                    ? 'bg-white group-hover:bg-[#f0f9ff]'
                    : 'bg-[#f8fafc] group-hover:bg-[#f0f9ff]';

              const solidHashBg = isHighlighted
                ? 'bg-amber-200'
                : 'bg-[#f1f5f9] group-hover:bg-[#e0f2fe]';

              const hashProps = getStickyBodyCellProps('#', solidHashBg);

              return (
                <tr
                  key={row.orderId}
                  id={`order-row-${row.orderId}`}
                  className={`group transition-colors ${isHighlighted ? 'font-semibold' : ''}`}
                >
                  {/* # Google Sheet Row Number Column */}
                  <td
                    style={hashProps.style}
                    className={`w-10 px-1.5 py-0.5 text-center font-mono font-bold text-slate-500 border-r border-b border-slate-200 text-[11px] ${hashProps.extraClass}`}
                    title={row.sheetRowIndex ? `Google Sheet Row #${row.sheetRowIndex}` : `Row ${rowIndex}`}
                  >
                    {row.sheetRowIndex || rowIndex}
                  </td>

                  {visibleColumns.map((col) => {
                    const cellBg = col.colLetter === 'S' && !isHighlighted
                      ? 'bg-[#ecfdf5] group-hover:bg-[#d1fae5]'
                      : solidCellBg;
                    const cProps = getStickyBodyCellProps(col.colLetter, cellBg);

                    return (
                      <td
                        key={col.id}
                        style={cProps.style}
                        className={`px-1.5 py-0.5 border-r border-b border-slate-200 whitespace-nowrap ${
                          col.colLetter === 'S' ? 'px-2 border-slate-300' : ''
                        } ${cProps.extraClass}`}
                      >
                        {renderCellContent(col.colLetter, row, hasOrderNo)}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

