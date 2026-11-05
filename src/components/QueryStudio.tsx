import React, { useState, useEffect, useMemo } from 'react';
import { ProductOrderRow } from '../types/fms';
import {
  DEFAULT_QUERY_FORMULA,
  SPREADSHEET_ID,
  SOURCE_TAB_NAME,
  SOURCE_RANGE,
  QUERY_COLUMN_MAPPINGS,
  fetchLiveGoogleQueryData
} from '../utils/googleQueryFetcher';
import {
  FileSpreadsheet,
  Copy,
  Check,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  Zap,
  ArrowRight,
  Database,
  Layers,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  CheckCircle2,
  Calendar,
  Sparkles,
  Columns3
} from 'lucide-react';

interface QueryStudioProps {
  onLoadIntoSimulator: (rows: ProductOrderRow[]) => void;
  onNavigateToSimulator: () => void;
}

export const QueryStudio: React.FC<QueryStudioProps> = ({
  onLoadIntoSimulator,
  onNavigateToSimulator
}) => {
  const [queryFormula, setQueryFormula] = useState(DEFAULT_QUERY_FORMULA);
  const [copiedFormula, setCopiedFormula] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<ProductOrderRow[]>([]);
  const [dataOrigin, setDataOrigin] = useState<'live' | 'snapshot'>('snapshot');
  const [lastFetchedAt, setLastFetchedAt] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Table filtering and search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>('ALL');
  const [showColumnMap, setShowColumnMap] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(30);

  // Initial load
  useEffect(() => {
    handleExecuteQuery(false);
  }, []);

  const handleExecuteQuery = async (forceLive: boolean = true) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchLiveGoogleQueryData(SPREADSHEET_ID, SOURCE_TAB_NAME);
      setRows(res.rows);
      setDataOrigin(res.source);
      setLastFetchedAt(res.fetchedAt);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch query data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyFormula = () => {
    navigator.clipboard.writeText(queryFormula);
    setCopiedFormula(true);
    setTimeout(() => setCopiedFormula(false), 2500);
  };

  const handleExportCsv = () => {
    if (rows.length === 0) return;
    const headers = [
      'Col1: Timestamp',
      'Col2: Customer Name',
      'Col8: Order Date',
      'Col9: Unit',
      'Col10: Item Name',
      'Col11: Color',
      'Col12: Width',
      'Col13: Unit of item',
      'Col14: Qty',
      'Col15: Rate',
      'Col16: Discount',
      'Col17: Delivery Date',
      'Col18: Remark',
      'Col3: Customer Number',
      'Col4: Billing Address',
      'Col5: Delivery Address',
      'Col6: Sales Person Name',
      'Col7: Sales Person Contact',
      'Order Number'
    ];

    const csvLines = [headers.join(',')];
    rows.forEach(r => {
      csvLines.push([
        `"${r.timestamp || ''}"`,
        `"${(r.customerName || '').replace(/"/g, '""')}"`,
        `"${r.orderDate || ''}"`,
        `"${r.unit || ''}"`,
        `"${(r.itemName || '').replace(/"/g, '""')}"`,
        `"${r.color || ''}"`,
        `"${r.width || ''}"`,
        `"${r.unitOfItem || ''}"`,
        `${r.qty || 0}`,
        `${r.rate || 0}`,
        `${r.discount || 0}`,
        `"${r.deliveryDate || ''}"`,
        `"${(r.remark || '').replace(/"/g, '""')}"`,
        `"${r.customerNumber || ''}"`,
        `"${(r.billingAddress || '').replace(/"/g, '""')}"`,
        `"${(r.deliveryAddress || '').replace(/"/g, '""')}"`,
        `"${(r.salesPerson || '').replace(/"/g, '""')}"`,
        `"${r.salesPersonContact || ''}"`,
        `"${r.orderNo || ''}"`
      ].join(','));
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `QUERY_Orders_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2500);
  };

  const handlePushToSimulator = () => {
    if (rows.length === 0) return;
    onLoadIntoSimulator(rows);
    onNavigateToSimulator();
  };

  // Distinct units & sales persons for filters
  const distinctUnits = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => {
      if (r.unit) s.add(r.unit.trim());
    });
    return Array.from(s).sort();
  }, [rows]);

  const distinctSalesPersons = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => {
      if (r.salesPerson) s.add(r.salesPerson.trim());
    });
    return Array.from(s).sort();
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (selectedUnit !== 'ALL' && (r.unit || '').trim() !== selectedUnit) {
        return false;
      }
      if (selectedSalesPerson !== 'ALL' && (r.salesPerson || '').trim() !== selectedSalesPerson) {
        return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches =
          (r.customerName || '').toLowerCase().includes(q) ||
          (r.itemName || '').toLowerCase().includes(q) ||
          (r.color || '').toLowerCase().includes(q) ||
          (r.salesPerson || '').toLowerCase().includes(q) ||
          (r.customerNumber || '').toLowerCase().includes(q) ||
          (r.billingAddress || '').toLowerCase().includes(q) ||
          (r.orderNo || '').toLowerCase().includes(q) ||
          (r.remark || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [rows, selectedUnit, selectedSalesPerson, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    let totalQty = 0;
    const custSet = new Set<string>();
    const itemSet = new Set<string>();
    let assignedCount = 0;

    rows.forEach(r => {
      totalQty += Number(r.qty) || 0;
      if (r.customerName) custSet.add(r.customerName.trim());
      if (r.itemName) itemSet.add(r.itemName.trim());
      if (r.orderNo && r.orderNo.trim() !== '') assignedCount++;
    });

    return {
      totalRows: rows.length,
      totalQty,
      uniqueCustomers: custSet.size,
      uniqueItems: itemSet.size,
      assignedCount
    };
  }, [rows]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / (pageSize || 30)));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    if (pageSize === 0) return filteredRows;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safeCurrentPage, pageSize]);

  return (
    <div className="space-y-4">
      {/* 1. TOP HEADER & QUERY FORMULA BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Google Sheet =QUERY(IMPORTRANGE(...)) Live Studio
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Orders!A:R Transformation
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Connected to Spreadsheet ID: <code className="text-slate-800 font-mono font-semibold">{SPREADSHEET_ID}</code> (Tab: <code className="text-emerald-700 font-semibold">{SOURCE_TAB_NAME}</code>)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=0`}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>Open in Google Sheets</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={handlePushToSimulator}
              className="px-3.5 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Push these query rows into Spreadsheet Simulator & Product Automation"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Load Into Simulator ({rows.length.toLocaleString()})</span>
            </button>
          </div>
        </div>

        {/* GOOGLE SHEETS AUTHENTIC FORMULA BAR */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                fx
              </span>
              <span>Cell A1 Query Formula in Product Order Tab:</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className={`inline-flex items-center gap-1 font-semibold ${dataOrigin === 'live' ? 'text-emerald-700' : 'text-blue-700'}`}>
                <span className={`w-2 h-2 rounded-full ${dataOrigin === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
                {dataOrigin === 'live' ? 'Live Connected to Google Sheets' : 'Embedded High-Speed Snapshot'}
                {lastFetchedAt && ` (${lastFetchedAt})`}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="flex-1 relative font-mono text-xs">
              <textarea
                value={queryFormula}
                onChange={(e) => setQueryFormula(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-slate-900 text-emerald-300 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs leading-relaxed resize-none shadow-inner"
              />
            </div>

            <div className="flex sm:flex-col justify-between gap-1.5 shrink-0">
              <button
                onClick={() => handleExecuteQuery(true)}
                disabled={isLoading}
                className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Executing...' : 'Run Query (Sync)'}</span>
              </button>

              <button
                onClick={handleCopyFormula}
                className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedFormula ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                <span>{copiedFormula ? 'Copied Formula!' : 'Copy Formula'}</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>{copiedCsv ? 'Downloaded!' : 'Export CSV'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Total Query Rows</span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">
            {stats.totalRows.toLocaleString()}
          </span>
          <span className="text-[10px] text-emerald-700 font-medium">Orders!A:R Extracted</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Total Booked Qty</span>
          <span className="text-xl font-bold font-mono text-emerald-700 mt-0.5 block">
            {Math.round(stats.totalQty).toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400">Sum of Col 14 (Col I)</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Unique Buyers</span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">
            {stats.uniqueCustomers.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400">Col 2 (Col B) Customer Name</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Fabric Items</span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">
            {stats.uniqueItems.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400">Col 10 (Col E) Item Codes</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-slate-500 block">Assigned Order Nos</span>
          <span className="text-xl font-bold font-mono text-amber-700 mt-0.5 block">
            {stats.assignedCount.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400">Col 19 (Col S) Order Numbers</span>
        </div>
      </div>

      {/* 3. COLUMN MAPPING TOGGLE DRAWER */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <button
          onClick={() => setShowColumnMap(!showColumnMap)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Columns3 className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-bold text-slate-900">
              Interactive Query Column Mapping: How Orders!A:R Transposes to Product Order (18 Columns)
            </span>
          </div>
          <span className="text-xs text-emerald-700 font-semibold">
            {showColumnMap ? '▲ Hide Mapping Details' : '▼ View 18-Column Translation'}
          </span>
        </button>

        {showColumnMap && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
            <p className="text-xs text-slate-600">
              The query formula rearranges the original raw columns from the <code className="font-mono font-bold text-slate-800">Orders</code> sheet so that product details (Order Date, Unit, Item Name, Color, Width, Qty, Rate, Discount, Delivery Date) come before customer address and phone numbers:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {QUERY_COLUMN_MAPPINGS.map(map => {
                let badgeBg = 'bg-slate-100 text-slate-700 border-slate-300';
                if (map.category === 'product') badgeBg = 'bg-amber-100 text-amber-800 border-amber-300';
                if (map.category === 'customer') badgeBg = 'bg-sky-100 text-sky-800 border-sky-300';
                if (map.category === 'identity') badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                if (map.category === 'logistics') badgeBg = 'bg-indigo-100 text-indigo-800 border-indigo-300';

                return (
                  <div key={map.queryCol} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                        {map.queryCol}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badgeBg}`}>
                        Col {map.targetColLetter} (Index {map.targetColIndex})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400 font-mono">Orders!{map.sourceColLetter}:</span>
                      <span className="text-slate-500 line-through truncate max-w-[100px]">{map.sourceHeader}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="font-bold text-slate-900 truncate">{map.targetHeader}</span>
                    </div>

                    <p className="text-[10px] text-slate-500 line-clamp-1">{map.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. DATA TABLE TOOLBAR & FILTERS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by customer, item, color, sales person, phone, address..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Unit Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1">
            <span className="text-slate-500 font-medium text-[11px]">Unit:</span>
            <select
              value={selectedUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Units ({distinctUnits.length})</option>
              {distinctUnits.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Sales Person Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1">
            <span className="text-slate-500 font-medium text-[11px]">Sales Person:</span>
            <select
              value={selectedSalesPerson}
              onChange={(e) => {
                setSelectedSalesPerson(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Sales Persons ({distinctSalesPersons.length})</option>
              {distinctSalesPersons.map(sp => (
                <option key={sp} value={sp}>{sp}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 5. DATA TABLE: 18 COLUMNS + ROW INDEX */}
        <div className="overflow-x-auto overflow-y-auto max-h-[600px] border border-slate-200 rounded-xl fms-sheet-scroll select-text">
          <table className="w-full border-collapse text-xs text-left">
            <thead className="sticky top-0 z-30 select-none bg-slate-900 text-white font-mono text-[11px]">
              {/* Column strip 1: Query column tokens */}
              <tr className="bg-slate-950 text-slate-400 text-[10px] border-b border-slate-800">
                <th className="px-2 py-1 text-center w-10 sticky left-0 z-40 bg-slate-950 border-r border-slate-800">#</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-emerald-400">Col1</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-sky-400">Col2</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-emerald-400">Col8</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-amber-400">Col9</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-amber-400">Col10</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-amber-400">Col11</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-amber-400">Col12</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-amber-400">Col13</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-emerald-400">Col14</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-amber-400">Col15</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-amber-400">Col16</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-emerald-400">Col17</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-slate-400">Col18</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-sky-400">Col3</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-sky-400">Col4</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-sky-400">Col5</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-indigo-400">Col6</th>
                <th className="px-2.5 py-1 text-center border-r border-slate-800 text-indigo-400">Col7</th>
                <th className="px-2.5 py-1 text-center bg-emerald-950 text-emerald-300 font-bold">Col S (Order No)</th>
              </tr>

              {/* Column strip 2: Human column names */}
              <tr>
                <th className="px-2 py-2 text-center w-10 sticky left-0 z-40 bg-slate-900 border-r border-slate-700">#</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[130px]">Timestamp</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[170px]">Customer Name</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[100px]">Order Date</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[90px]">Unit</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[160px]">Item Name</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[80px]">Color</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[70px]">Width</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[80px]">Unit (Item)</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[80px] text-right">Qty</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[80px] text-right">Rate</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[80px] text-center">Discount</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[100px]">Delivery Date</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[150px]">Remark</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[110px]">Customer No</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[180px]">Billing Address</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[180px]">Delivery Address</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[130px]">Sales Person</th>
                <th className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap min-w-[120px]">Sales Contact</th>
                <th className="px-2.5 py-2 whitespace-nowrap min-w-[120px] bg-emerald-900 text-emerald-100 font-bold">Order Number</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={20} className="text-center py-12 text-slate-500">
                    <p className="font-semibold text-slate-700">No query rows found matching filter.</p>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, idx) => {
                  const rowIndex = (safeCurrentPage - 1) * (pageSize || 30) + idx + 1;
                  return (
                    <tr
                      key={r.orderId}
                      className={`hover:bg-sky-50/60 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                    >
                      <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-400 border-r border-slate-200 sticky left-0 z-20 bg-slate-50">
                        {rowIndex}
                      </td>

                      {/* Col 1: Timestamp */}
                      <td className="px-2.5 py-1.5 font-mono text-[11px] text-slate-600 border-r border-slate-200 whitespace-nowrap">
                        {r.timestamp}
                      </td>

                      {/* Col 2: Customer Name */}
                      <td className="px-2.5 py-1.5 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {r.customerName}
                      </td>

                      {/* Col 8: Order Date */}
                      <td className="px-2.5 py-1.5 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {r.orderDate}
                      </td>

                      {/* Col 9: Unit */}
                      <td className="px-2.5 py-1.5 font-semibold text-purple-900 border-r border-slate-200 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-[10px]">
                          {r.unit || '—'}
                        </span>
                      </td>

                      {/* Col 10: Item Name */}
                      <td className="px-2.5 py-1.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {r.itemName}
                      </td>

                      {/* Col 11: Color */}
                      <td className="px-2.5 py-1.5 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {r.color || '—'}
                      </td>

                      {/* Col 12: Width */}
                      <td className="px-2.5 py-1.5 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {r.width || '—'}
                      </td>

                      {/* Col 13: Unit of item */}
                      <td className="px-2.5 py-1.5 text-center font-mono text-slate-600 border-r border-slate-200 text-[10px]">
                        {r.unitOfItem || 'MTR'}
                      </td>

                      {/* Col 14: Qty */}
                      <td className="px-2.5 py-1.5 font-mono font-bold text-slate-900 text-right border-r border-slate-200">
                        {Number(r.qty).toLocaleString()}
                      </td>

                      {/* Col 15: Rate */}
                      <td className="px-2.5 py-1.5 font-mono text-slate-700 text-right border-r border-slate-200">
                        ₹{r.rate}
                      </td>

                      {/* Col 16: Discount */}
                      <td className="px-2.5 py-1.5 font-mono text-center text-slate-600 border-r border-slate-200">
                        {r.discount}%
                      </td>

                      {/* Col 17: Delivery Date */}
                      <td className="px-2.5 py-1.5 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {r.deliveryDate || '—'}
                      </td>

                      {/* Col 18: Remark */}
                      <td className="px-2.5 py-1.5 text-slate-600 border-r border-slate-200 max-w-[200px] truncate" title={r.remark}>
                        {r.remark || '—'}
                      </td>

                      {/* Col 3: Customer Number */}
                      <td className="px-2.5 py-1.5 font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {r.customerNumber || '—'}
                      </td>

                      {/* Col 4: Billing Address */}
                      <td className="px-2.5 py-1.5 text-slate-600 border-r border-slate-200 max-w-[200px] truncate" title={r.billingAddress}>
                        {r.billingAddress || '—'}
                      </td>

                      {/* Col 5: Delivery Address */}
                      <td className="px-2.5 py-1.5 text-slate-600 border-r border-slate-200 max-w-[200px] truncate" title={r.deliveryAddress}>
                        {r.deliveryAddress || '—'}
                      </td>

                      {/* Col 6: Sales Person Name */}
                      <td className="px-2.5 py-1.5 font-medium text-slate-800 border-r border-slate-200 whitespace-nowrap">
                        {r.salesPerson || '—'}
                      </td>

                      {/* Col 7: Sales Person Contact */}
                      <td className="px-2.5 py-1.5 font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {r.salesPersonContact || '—'}
                      </td>

                      {/* Col 19 / S: Order Number */}
                      <td className="px-2.5 py-1.5 font-mono font-bold text-slate-900 bg-emerald-50/50 whitespace-nowrap">
                        {r.orderNo ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px]">
                            {r.orderNo}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal italic text-[10px]">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 6. PAGINATION CONTROLS */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-1 text-xs text-slate-700">
          <div className="flex items-center gap-3">
            <span className="font-semibold">
              Showing {pageSize === 0 ? 1 : (safeCurrentPage - 1) * pageSize + 1}–
              {pageSize === 0 ? filteredRows.length : Math.min(safeCurrentPage * pageSize, filteredRows.length)} of{' '}
              <strong className="text-emerald-700 font-bold font-mono">{filteredRows.length.toLocaleString()}</strong> rows
              {filteredRows.length !== rows.length && (
                <span className="text-slate-500 font-normal ml-1">
                  (filtered from {rows.length.toLocaleString()} total)
                </span>
              )}
            </span>

            <div className="flex items-center gap-1.5 border-l border-slate-300 pl-3">
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
                className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-semibold text-slate-700 cursor-pointer"
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
                className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
