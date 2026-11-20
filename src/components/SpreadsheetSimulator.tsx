import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GroupedOrder, ProductOrderRow, OrderItem } from '../types/fms';
import { initialRawResponses, initialExistingDispatch, fmsColumnMapping, productOrderColumns } from '../data/sampleOrders';
import { ProductOrderView, SearchBasisMode } from './ProductOrderView';
import {
  saveOrdersToStorage,
  loadOrdersFromStorage,
  saveAutomationOrdersToStorage,
  loadAutomationOrdersFromStorage,
  clearOrdersFromStorage,
  purgeAllLegacyStorageAndCaches,
  hasDelhiDummyData
} from '../utils/orderStorage';
import staticQueryOrders from '../data/ordersQueryData.json';
import {
  AUTOMATION_SPREADSHEET_ID,
  AUTOMATION_TAB_NAME,
  QUERY_SPREADSHEET_ID,
  SOURCE_TAB_NAME as QUERY_SOURCE_TAB_NAME,
  WEB_APP_URL_STORAGE_KEY,
  DEFAULT_WEB_APP_URL,
  fetchLiveGoogleQueryData,
  fetchBothLiveGoogleSheets,
  pushOrderUpdateToGoogleSheet
} from '../utils/googleQueryFetcher';
import { generateTwoWayWebAppCode, defaultGasConfig } from '../utils/gasGenerator';
import {
  RotateCcw,
  PlusCircle,
  Play,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Layers,
  SplitSquareVertical,
  Edit3,
  AlertTriangle,
  FileCode2,
  ExternalLink,
  MessageSquare,
  Copy,
  Check,
  X,
  Download,
  Filter,
  Search,
  Plus,
  Trash2,
  Table,
  Archive,
  FileSpreadsheet,
  Zap,
  CheckSquare,
  Clock,
  ArrowUpDown,
  Eye,
  EyeOff,
  Columns,
  CloudUpload,
  Database,
  Flame,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Upload,
  Lock,
  Pin,
  FileText,
  Github,
  Maximize2,
  Minimize2,
  Loader2,
  Link2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Radio
} from 'lucide-react';

const LOCAL_STORAGE_KEY = 'ginza_fms_query_orders_v16_locked';
const LOCAL_STORAGE_DISPATCH_KEY = 'ginza_fms_sheet_dispatch_v16';
const LOCAL_STORAGE_COL_VISIBILITY = 'ginza_fms_col_visibility_v11';
const LOCAL_STORAGE_COL_VISIBILITY_BY_TAB = 'ginza_fms_col_visibility_by_tab_v1';
const LOCAL_STORAGE_FIREBASE_CONFIG = 'ginza_fms_firebase_cfg_v9';
const LOCAL_STORAGE_FREEZE_CONFIG = 'ginza_fms_freeze_cfg_v9';
const LOCAL_STORAGE_CONFIRM_KEY = 'ginza_fms_confirm_msg_v9';
const LOCAL_STORAGE_DISPATCH_WA_KEY = 'ginza_fms_dispatch_wa_v11';
const LOCAL_STORAGE_COL_W_KEY = 'ginza_fms_col_w_v11';
const LOCAL_STORAGE_COL_X_KEY = 'ginza_fms_col_x_v11';
const LOCAL_STORAGE_COL_AE_KEY = 'ginza_fms_col_ae_v11';
const LOCAL_STORAGE_COL_AF_KEY = 'ginza_fms_col_af_v11';
const LOCAL_STORAGE_COL_AG_KEY = 'ginza_fms_col_ag_v11';
const LOCAL_STORAGE_COL_AH_KEY = 'ginza_fms_col_ah_v11';
const LOCAL_STORAGE_COL_AI_KEY = 'ginza_fms_col_ai_v11';
const LOCAL_STORAGE_COL_AJ_KEY = 'ginza_fms_col_aj_v11';
const LOCAL_STORAGE_COL_AL_KEY = 'ginza_fms_col_al_v11';

// Helper: Check if an item/order is Completed (Closed) in Col AM
export const isItemComplete = (status?: string): boolean => {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s === 'closed' || s === 'complete' || s === 'completed' || s === 'done';
};

// Build consistent orderGroupKey across Product Order & Product Automation
const buildOrderGroupKey = (row: ProductOrderRow): string => {
  if (row.orderGroupKey) return row.orderGroupKey;
  return [
    row.orderNo || row.customerPO || '',
    row.customerName || '',
    row.orderDate || ''
  ].map(v => v.trim()).join('_');
};

interface SpreadsheetSimulatorProps {
  isFullWidth?: boolean;
  setIsFullWidth?: (val: boolean) => void;
  onOpenQueryStudio?: () => void;
}

export const SpreadsheetSimulator: React.FC<SpreadsheetSimulatorProps> = ({
  isFullWidth = true,
  setIsFullWidth,
  onOpenQueryStudio
}) => {
  const [isFetchingQueryLive, setIsFetchingQueryLive] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [liveSyncSource, setLiveSyncSource] = useState<'live' | 'snapshot' | 'cached'>('cached');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(WEB_APP_URL_STORAGE_KEY);
      if (saved && saved.trim() !== '') {
        return saved.trim();
      }
      localStorage.setItem(WEB_APP_URL_STORAGE_KEY, DEFAULT_WEB_APP_URL);
      return DEFAULT_WEB_APP_URL;
    } catch {
      return DEFAULT_WEB_APP_URL;
    }
  });
  const [showTwoWaySyncModal, setShowTwoWaySyncModal] = useState(false);
  const [copiedWebAppScript, setCopiedWebAppScript] = useState(false);
  const [testingWebApp, setTestingWebApp] = useState(false);

  // Dataset 1: "Product Order" tab (Cols A to S, gid=0)
  const [rawResponses, setRawResponses] = useState<ProductOrderRow[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && !hasDelhiDummyData(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse saved orders', e);
    }
    return (staticQueryOrders as any[])?.length > 0
      ? (staticQueryOrders as any)
      : initialRawResponses;
  });

  // Dataset 2: "Product Automation" + "Closed Orders" tabs (Cols A to AQ, gid=1541274744)
  const [automationRows, setAutomationRows] = useState<ProductOrderRow[]>([]);

  const rawResponsesRef = useRef(rawResponses);
  rawResponsesRef.current = rawResponses;
  const automationRowsRef = useRef(automationRows);
  automationRowsRef.current = automationRows;

  // Hydrate operational columns (W..AN, U Dispatch) from Product Automation sheet rows
  const hydrateFromAutomationRows = (rows: ProductOrderRow[], resetStale = false) => {
    const nextW: Record<string, string> = {};
    const nextX: Record<string, string> = {};
    const nextAC: Record<string, string> = {};
    const nextAE: Record<string, boolean> = {};
    const nextAF: Record<string, string> = {};
    const nextAG: Record<string, string> = {};
    const nextAH: Record<string, boolean> = {};
    const nextAI: Record<string, string> = {};
    const nextAJ: Record<string, string> = {};
    const nextAL: Record<string, string> = {};
    const nextAN: Record<string, string> = {};
    const nextDispatch: Record<string, number> = {};

    rows.forEach(row => {
      const gk = buildOrderGroupKey(row);
      if (row.accountStatus) nextW[gk] = row.accountStatus;
      if (row.operationalRemark) nextX[gk] = row.operationalRemark;
      if (row.confirmationMsg) nextAC[gk] = row.confirmationMsg;
      if (row.followUp1 !== undefined) nextAE[gk] = Boolean(row.followUp1);
      if (row.followUp1Timestamp) nextAF[gk] = row.followUp1Timestamp;
      if (row.followUp1Remark) nextAG[gk] = row.followUp1Remark;
      if (row.followUp2 !== undefined) nextAH[gk] = Boolean(row.followUp2);
      if (row.followUp2Timestamp) nextAI[gk] = row.followUp2Timestamp;
      if (row.followUp2Remark) nextAJ[gk] = row.followUp2Remark;
      if (row.lrNumber) nextAL[gk] = row.lrNumber;
      if (row.deliveredWhatsappMsg) nextAN[gk] = row.deliveredWhatsappMsg;

      const itemKey = `${gk}___${(row.itemName || '').trim()}___${(row.color || '').trim()}___${(row.width || '').trim()}`;
      if (row.dispatchQty !== undefined && row.dispatchQty > 0) {
        nextDispatch[itemKey] = row.dispatchQty;
      }
    });

    if (resetStale) {
      if (Object.keys(nextW).length > 0) setColWStatuses(prev => ({ ...prev, ...nextW }));
      if (Object.keys(nextX).length > 0) setColXRemarks(prev => ({ ...prev, ...nextX }));
      if (Object.keys(nextAC).length > 0) setAcStatuses(prev => ({ ...prev, ...nextAC }));
      if (Object.keys(nextAE).length > 0) setColAEChecks(prev => ({ ...prev, ...nextAE }));
      if (Object.keys(nextAF).length > 0) setColAFTimestamps(prev => ({ ...prev, ...nextAF }));
      if (Object.keys(nextAG).length > 0) setColAGRemarks(prev => ({ ...prev, ...nextAG }));
      if (Object.keys(nextAH).length > 0) setColAHChecks(prev => ({ ...prev, ...nextAH }));
      if (Object.keys(nextAI).length > 0) setColAITimestamps(prev => ({ ...prev, ...nextAI }));
      if (Object.keys(nextAJ).length > 0) setColAJRemarks(prev => ({ ...prev, ...nextAJ }));
      if (Object.keys(nextAL).length > 0) setLrNumbers(prev => ({ ...prev, ...nextAL }));
      if (Object.keys(nextAN).length > 0) setAnStatuses(prev => ({ ...prev, ...nextAN }));
      setDispatchRecords(prev => ({ ...prev, ...nextDispatch }));
    }
  };

  // Sync BOTH "Product Order" & "Product Automation" live from Google Sheet
  const handleSyncBothLiveSheets = async (silent = false) => {
    setIsFetchingQueryLive(true);
    if (!silent) {
      setSyncFeedbackTone('success');
      setSyncFeedback(`⚡ Syncing live Google Sheets ("Product Order" & "Product Automation")...`);
    }
    try {
      const res = await fetchBothLiveGoogleSheets(AUTOMATION_SPREADSHEET_ID);

      // 1. Merge Product Order (preserve locally assigned Order No where sheet Col S is still blank)
      if (res.productOrderRows && res.productOrderRows.length > 0) {
        const localAssignedMap = new Map<string, { orderNo: string; orderNoTimestamp?: string }>();
        rawResponsesRef.current.forEach(r => {
          if (r.orderNo && r.orderNo.trim() !== '') {
            const fp = `${(r.timestamp || '').trim()}___${(r.customerName || '').trim().toLowerCase()}___${(r.itemName || '').trim().toLowerCase()}___${(r.color || '').trim().toLowerCase()}___${Number(r.qty) || 0}`;
            localAssignedMap.set(fp, { orderNo: r.orderNo, orderNoTimestamp: r.orderNoTimestamp });
          }
        });

        const mergedPO = res.productOrderRows.map(remoteRow => {
          if (!remoteRow.orderNo || remoteRow.orderNo.trim() === '') {
            const fp = `${(remoteRow.timestamp || '').trim()}___${(remoteRow.customerName || '').trim().toLowerCase()}___${(remoteRow.itemName || '').trim().toLowerCase()}___${(remoteRow.color || '').trim().toLowerCase()}___${Number(remoteRow.qty) || 0}`;
            const localMatch = localAssignedMap.get(fp);
            if (localMatch) {
              return {
                ...remoteRow,
                orderNo: localMatch.orderNo,
                orderNoTimestamp: localMatch.orderNoTimestamp || remoteRow.orderNoTimestamp
              };
            }
          }
          return remoteRow;
        });

        setRawResponses(mergedPO);
        saveOrdersToStorage(mergedPO);
      }

      // 2. Merge Product Automation (keep newly assigned local orders not yet copied to PA sheet)
      if (res.automationRows && res.automationRows.length > 0) {
        const remoteOrderNos = new Set(
          res.automationRows
            .map(r => (r.orderNo || '').trim().toLowerCase())
            .filter(Boolean)
        );
        const localOnlyOrders = automationRowsRef.current.filter(
          r => r.orderNo && r.orderNo.trim() !== '' && !remoteOrderNos.has(r.orderNo.trim().toLowerCase())
        );

        const mergedPA = [...res.automationRows, ...localOnlyOrders];
        setAutomationRows(mergedPA);
        saveAutomationOrdersToStorage(mergedPA);
        hydrateFromAutomationRows(res.automationRows, true);
      }

      setLastSyncedAt(res.fetchedAt);
      setLiveSyncSource(res.source);

      if (!silent) {
        const openCount = res.automationRows.filter(r => !isItemComplete(r.statusAN)).length;
        const completeCount = res.automationRows.filter(r => isItemComplete(r.statusAN)).length;
        setSyncFeedbackTone('success');
        setSyncFeedback(
          `✓ Live Google Sheet synced at ${res.fetchedAt} | Product Order: ${res.productOrderRows.length.toLocaleString()} rows | Automation Open: ${openCount} | Closed (AM Complete): ${completeCount}`
        );
      }
    } catch (err: any) {
      console.error('Failed to sync live sheets:', err);
      if (!silent) {
        setSyncFeedbackTone('warning');
        setSyncFeedback(`Live sync warning: ${err?.message || 'Check network connection'}`);
      }
    } finally {
      setIsFetchingQueryLive(false);
      if (!silent) {
        setTimeout(() => setSyncFeedback(null), 5000);
      }
    }
  };

  // Load cached IndexedDB datasets on mount & immediately pull fresh live Google Sheets
  useEffect(() => {
    purgeAllLegacyStorageAndCaches();

    loadOrdersFromStorage().then((saved) => {
      if (saved && Array.isArray(saved) && saved.length > 0 && !hasDelhiDummyData(saved)) {
        setRawResponses(saved);
      }
    });

    loadAutomationOrdersFromStorage().then((savedAuto) => {
      if (savedAuto && Array.isArray(savedAuto) && savedAuto.length > 0) {
        setAutomationRows(savedAuto);
        hydrateFromAutomationRows(savedAuto, true);
      }
    });

    // Auto-fetch live Google Sheet ("Product Order" + "Product Automation") immediately
    handleSyncBothLiveSheets(true);
  }, []);

  // Periodic background centralization sync every 60s
  useEffect(() => {
    if (!autoSyncEnabled) return;
    const interval = setInterval(() => {
      handleSyncBothLiveSheets(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [autoSyncEnabled]);

  // Purge legacy Delhi dummy data, re-fetch live Google Sheet
  const handlePurgeDelhiAndLockQuery = async () => {
    setIsFetchingQueryLive(true);
    setSyncFeedback('🧹 Purging old cache & pulling genuine live Google Sheet Mumbai orders...');
    try {
      await clearOrdersFromStorage();
      await purgeAllLegacyStorageAndCaches();
      await handleSyncBothLiveSheets(false);
    } catch (e: any) {
      console.error(e);
      setSyncFeedback('Reset complete.');
    } finally {
      setIsFetchingQueryLive(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  // Single-tab or full live refresh handler
  const handleSyncGoogleQueryLive = async (targetTab?: string) => {
    if (!targetTab) {
      await handleSyncBothLiveSheets(false);
      return;
    }
    setIsFetchingQueryLive(true);
    setSyncFeedback(`⚡ Fetching Google Sheet "${targetTab}"...`);
    try {
      const res = await fetchLiveGoogleQueryData(AUTOMATION_SPREADSHEET_ID, targetTab);
      if (res.rows && res.rows.length > 0) {
        if (targetTab.toLowerCase().includes('product order')) {
          setRawResponses(res.rows);
          await saveOrdersToStorage(res.rows);
        } else {
          setAutomationRows(res.rows);
          await saveAutomationOrdersToStorage(res.rows);
          hydrateFromAutomationRows(res.rows, true);
        }
        setLastSyncedAt(res.fetchedAt);
        setLiveSyncSource(res.source);
        setSyncFeedback(`✓ Synced ${res.rows.length.toLocaleString()} rows from "${res.sheetTab}" at ${res.fetchedAt}!`);
      }
    } catch (err: any) {
      console.error('Failed to sync live query:', err);
      setSyncFeedback(`Query sync warning: ${err.message || 'Check network connection'}`);
    } finally {
      setIsFetchingQueryLive(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  // State for user-entered dispatch quantities in Col Y
  const [dispatchRecords, setDispatchRecords] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_DISPATCH_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse saved dispatch', e);
    }
    return initialExistingDispatch;
  });

  // Per-Tab Column Visibility state (Independent Hide/Show for Product Order, Product Automation, and Closed Orders)
  const buildDefaultProductOrderVisibility = (): Record<string, boolean> => {
    const map: Record<string, boolean> = {};
    productOrderColumns.forEach(c => { map[c.colLetter] = true; });
    return map;
  };
  const buildDefaultAutomationVisibility = (): Record<string, boolean> => {
    const map: Record<string, boolean> = {};
    fmsColumnMapping.forEach(c => { map[c.sheetCol] = true; });
    return map;
  };
  const [visibleColsByTab, setVisibleColsByTab] = useState<Record<'product_order' | 'automation' | 'closed', Record<string, boolean>>>(() => {
    const defaultPO = buildDefaultProductOrderVisibility();
    const defaultAuto = buildDefaultAutomationVisibility();
    try {
      const savedByTab = localStorage.getItem(LOCAL_STORAGE_COL_VISIBILITY_BY_TAB);
      if (savedByTab) {
        const parsed = JSON.parse(savedByTab);
        return {
          product_order: { ...defaultPO, ...(parsed.product_order || {}) },
          automation: { ...defaultAuto, ...(parsed.automation || {}) },
          closed: { ...defaultAuto, ...(parsed.closed || {}) }
        };
      }
      const legacySaved = localStorage.getItem(LOCAL_STORAGE_COL_VISIBILITY);
      if (legacySaved) {
        const parsedLegacy = JSON.parse(legacySaved);
        const migratedAuto = { ...defaultAuto, ...parsedLegacy };
        return {
          product_order: defaultPO,
          automation: migratedAuto,
          closed: { ...defaultAuto }
        };
      }
    } catch (e) {}
    return {
      product_order: defaultPO,
      automation: defaultAuto,
      closed: { ...defaultAuto }
    };
  });

  // Freeze Configuration: freezeColumns (0, 1: #, 2: # + PO, 3: # + PO + Name), freezeRows (1: Header, 0: None)
  const [freezeColumns, setFreezeColumns] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_FREEZE_CONFIG);
      if (saved) return JSON.parse(saved).cols ?? 2;
    } catch (e) {}
    return 2; // Default: Freeze # and Customer PO for easy scrolling
  });

  const [freezeRows, setFreezeRows] = useState<number>(1);
  const [showFreezeMenu, setShowFreezeMenu] = useState(false);

  // Tab-scoped Column Dropdown Filter State: Record<tab, Record<colLetter, string[]>>
  const [colFiltersByTab, setColFiltersByTab] = useState<Record<'product_order' | 'automation' | 'closed', Record<string, string[]>>>({
    product_order: {},
    automation: {},
    closed: {}
  });

  // Tab-scoped Active Sorting: Record<tab, { column: string; direction: 'asc' | 'desc' } | null>
  const [sortConfigByTab, setSortConfigByTab] = useState<Record<'product_order' | 'automation' | 'closed', { column: string; direction: 'asc' | 'desc' } | null>>({
    product_order: null,
    automation: null,
    closed: null
  });

  // Active popover filter menu
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);

  // Column Visibility Manager modal
  const [showColManager, setShowColManager] = useState(false);
  const [colSearchQuery, setColSearchQuery] = useState('');

  // Excel / CSV / Google Sheet Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTabMode, setImportTabMode] = useState<'sheet' | 'paste' | 'file'>('sheet');
  const [importSheetId, setImportSheetId] = useState('1xSSZ6DyQarQJOd8UpOfCV-tjdKL1oQq_IKuXJkcRv5Q');
  const [importTabName, setImportTabName] = useState('Product Order');
  const [autoSyncToFirebase, setAutoSyncToFirebase] = useState(true);
  const [importReplaceMode, setImportReplaceMode] = useState(true);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pastedDataText, setPastedDataText] = useState('');

  // Vercel / GitHub Deployment Modal
  const [showVercelGuide, setShowVercelGuide] = useState(false);

  // Firebase Live Sync & Historical Upload Modal
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [firebaseUrl, setFirebaseUrl] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_FIREBASE_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.url) return parsed.url;
      }
    } catch (e) {}
    return 'https://project-vishal-team-default-rtdb.firebaseio.com';
  });
  const [firebaseSecret, setFirebaseSecret] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_FIREBASE_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.secret !== undefined) return parsed.secret;
      }
    } catch (e) {}
    return 'iIElINFgR124ssaG3QWjExz2lT72cRh5g502oP6J';
  });
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Col AC: Confirmation Msg Status / WhatsApp Sent ("Message Sent" vs "Pending")
  const [acStatuses, setAcStatuses] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CONFIRM_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  // Compatibility alias
  const aeStatuses = acStatuses;
  const setAeStatuses = setAcStatuses;

  // Col AN: Delivered Whatspp Msg / WhatsApp Sent ("Message Sent" vs "Pending")
  const [anStatuses, setAnStatuses] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_DISPATCH_WA_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  // Compatibility alias
  const aoStatuses = anStatuses;
  const setAoStatuses = setAnStatuses;

  // Col AL: LR- Number state
  const [lrNumbers, setLrNumbers] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_COL_AL_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  // Col W: Status (Manual User Text Edit with Auto-Save)
  const [colWStatuses, setColWStatuses] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_COL_W_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  const colAAStatuses = colWStatuses;

  // Col X: Remark (Manual User Text Edit with Auto-Save)
  const [colXRemarks, setColXRemarks] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_COL_X_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  const colABRemarks = colXRemarks;

  // Col AE: Follow-up 1 Checkbox (true/false)
  const [colAEChecks, setColAEChecks] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_COL_AE_KEY) || localStorage.getItem('ginza_fms_col_ag_v10');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  const colAGChecks = colAEChecks;

  // Col AF: Follow-up 1 Timestamp (Auto populated when Col AE checked)
  const [colAFTimestamps, setColAFTimestamps] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_COL_AF_KEY) || localStorage.getItem('ginza_fms_col_ah_v10');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  const colAHTimestamps = colAFTimestamps;

  // Col AG: Follow-up 1 Remark (Manual User Text Edit with Auto-Save) - Editable!
  const [colAGRemarks, setColAGRemarks] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_COL_AG_KEY) || localStorage.getItem('ginza_fms_col_ai_v10');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  const colAIRemarks = colAGRemarks;

  // Col AH: Follow-up 2 Checkbox (true/false)
  const [colAHChecks, setColAHChecks] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_COL_AH_KEY) || localStorage.getItem('ginza_fms_col_aj_v10');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  const colAJChecks = colAHChecks;

  // Col AI: Follow-up 2 Timestamp (Auto populated when Col AH checked)
  const [colAITimestamps, setColAITimestamps] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_COL_AI_KEY) || localStorage.getItem('ginza_fms_col_ak_v10');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  const colAKTimestamps = colAITimestamps;

  // Col AJ: Follow-up 2 Remark (Manual User Text Edit with Auto-Save) - Editable!
  const [colAJRemarks, setColAJRemarks] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_COL_AJ_KEY) || localStorage.getItem('ginza_fms_col_al_v10');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  const colALRemarks = colAJRemarks;

  // Active Sheet tab: 'product_order' (28-Col Raw Flat Sheet), 'automation' (Product Automation: Active Orders), 'closed' (Closed Orders Archive)
  const [activeSheetTab, setActiveSheetTab] = useState<'product_order' | 'automation' | 'closed'>('product_order');

  // Status Filter in Toolbar
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Open' | 'In-Progress' | 'Closed' | 'Complete'>('ALL');

  // View mode: 'merged' (Customer A-E & N-X Vertically Merged) vs 'unmerged' (Flat row-wise)
  const [viewMode, setViewMode] = useState<'merged' | 'unmerged'>('merged');

  // Synced top horizontal scrollbar refs for Product Automation & Closed Orders
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef<'top' | 'table' | null>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(2800);

  const handleTopScroll = () => {
    if (isSyncingScrollRef.current === 'table') return;
    if (topScrollRef.current && tableScrollRef.current) {
      isSyncingScrollRef.current = 'top';
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = null;
      });
    }
  };

  const handleTableScroll = () => {
    if (isSyncingScrollRef.current === 'top') return;
    if (topScrollRef.current && tableScrollRef.current) {
      isSyncingScrollRef.current = 'table';
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = null;
      });
    }
  };

  // Tab-scoped search filter & search basis (each tab has its own independent search term & Customer/Order No mode)
  const [searchTermsByTab, setSearchTermsByTab] = useState<Record<'product_order' | 'automation' | 'closed', string>>({
    product_order: '',
    automation: '',
    closed: ''
  });
  const [searchModesByTab, setSearchModesByTab] = useState<Record<'product_order' | 'automation' | 'closed', SearchBasisMode>>({
    product_order: 'customer_or_order',
    automation: 'customer_or_order',
    closed: 'customer_or_order'
  });

  // Derived active-tab views & updaters so every filter/column setting stays strictly within the active tab
  const visibleCols = visibleColsByTab[activeSheetTab];
  const setVisibleCols: React.Dispatch<React.SetStateAction<Record<string, boolean>>> = (updater) => {
    setVisibleColsByTab(prev => {
      const current = prev[activeSheetTab];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [activeSheetTab]: next };
    });
  };

  const colFilters = colFiltersByTab[activeSheetTab];
  const setColFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>> = (updater) => {
    setColFiltersByTab(prev => {
      const current = prev[activeSheetTab];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [activeSheetTab]: next };
    });
  };

  const sortConfig = sortConfigByTab[activeSheetTab];
  const setSortConfig: React.Dispatch<React.SetStateAction<{ column: string; direction: 'asc' | 'desc' } | null>> = (updater) => {
    setSortConfigByTab(prev => {
      const current = prev[activeSheetTab];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [activeSheetTab]: next };
    });
  };

  const searchTerm = searchTermsByTab[activeSheetTab];
  const setSearchTerm = (val: string) => {
    setSearchTermsByTab(prev => ({ ...prev, [activeSheetTab]: val }));
  };

  const searchMode = searchModesByTab[activeSheetTab];
  const setSearchMode = (mode: SearchBasisMode) => {
    setSearchModesByTab(prev => ({ ...prev, [activeSheetTab]: mode }));
  };

  // Status message for simulation feedback
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [syncFeedbackTone, setSyncFeedbackTone] = useState<'success' | 'warning' | 'error'>('success');

  // Modal for previewing WhatsApp dispatch link (Col AO -> AP)
  const [whatsAppModalOrder, setWhatsAppModalOrder] = useState<GroupedOrder | null>(null);
  const [copiedWhatsAppMsg, setCopiedWhatsAppMsg] = useState(false);

  // Modal for previewing Instant Confirmation WhatsApp (Col AE -> AF)
  const [confirmWhatsAppModalOrder, setConfirmWhatsAppModalOrder] = useState<GroupedOrder | null>(null);
  const [copiedConfirmMsg, setCopiedConfirmMsg] = useState(false);

  // Modal for New Order entry
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);

  // Modal for adding item to existing order
  const [addingItemToOrder, setAddingItemToOrder] = useState<GroupedOrder | null>(null);

  // Quick edit modal for Order No (Col X)
  const [editingOrderNo, setEditingOrderNo] = useState<{ key: string; po: string; value: string } | null>(null);

  // Debounced safe saving to IndexedDB for both Product Order & Product Automation
  useEffect(() => {
    const timer = setTimeout(() => {
      saveOrdersToStorage(rawResponses);
      try {
        if (rawResponses.length <= 1500) {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(rawResponses));
        }
      } catch (e) {}
    }, 600);
    return () => clearTimeout(timer);
  }, [rawResponses]);

  useEffect(() => {
    if (automationRows.length === 0) return;
    const timer = setTimeout(() => {
      saveAutomationOrdersToStorage(automationRows);
    }, 600);
    return () => clearTimeout(timer);
  }, [automationRows]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_DISPATCH_KEY, JSON.stringify(dispatchRecords));
      } catch (e) {}
    }, 600);
    return () => clearTimeout(timer);
  }, [dispatchRecords]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_COL_VISIBILITY_BY_TAB, JSON.stringify(visibleColsByTab));
      localStorage.setItem(LOCAL_STORAGE_COL_VISIBILITY, JSON.stringify(visibleColsByTab.automation));
    } catch (e) {}
  }, [visibleColsByTab]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_FREEZE_CONFIG, JSON.stringify({ cols: freezeColumns, rows: freezeRows }));
    } catch (e) {}
  }, [freezeColumns, freezeRows]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_CONFIRM_KEY, JSON.stringify(acStatuses));
        localStorage.setItem(LOCAL_STORAGE_DISPATCH_WA_KEY, JSON.stringify(anStatuses));
        localStorage.setItem(LOCAL_STORAGE_COL_W_KEY, JSON.stringify(colWStatuses));
        localStorage.setItem(LOCAL_STORAGE_COL_X_KEY, JSON.stringify(colXRemarks));
        localStorage.setItem(LOCAL_STORAGE_COL_AE_KEY, JSON.stringify(colAEChecks));
        localStorage.setItem(LOCAL_STORAGE_COL_AF_KEY, JSON.stringify(colAFTimestamps));
        localStorage.setItem(LOCAL_STORAGE_COL_AG_KEY, JSON.stringify(colAGRemarks));
        localStorage.setItem(LOCAL_STORAGE_COL_AH_KEY, JSON.stringify(colAHChecks));
        localStorage.setItem(LOCAL_STORAGE_COL_AI_KEY, JSON.stringify(colAITimestamps));
        localStorage.setItem(LOCAL_STORAGE_COL_AJ_KEY, JSON.stringify(colAJRemarks));
        localStorage.setItem(LOCAL_STORAGE_COL_AL_KEY, JSON.stringify(lrNumbers));
      } catch (e) {}
    }, 600);
    return () => clearTimeout(timer);
  }, [
    acStatuses,
    anStatuses,
    colWStatuses,
    colXRemarks,
    colAEChecks,
    colAFTimestamps,
    colAGRemarks,
    colAHChecks,
    colAITimestamps,
    colAJRemarks,
    lrNumbers
  ]);

  // Group Product Automation rows into distinct orders (sorted newest Google Sheet rows first)
  const groupedOrders: GroupedOrder[] = useMemo(() => {
    const sourceForAutomation = automationRows.length > 0
      ? automationRows
      : rawResponses.filter(r => r.orderNo && r.orderNo.trim() !== '');

    const map: Record<string, GroupedOrder & { _maxRow?: number }> = {};

    sourceForAutomation.forEach((row, idx) => {
      const orderKey = buildOrderGroupKey(row);
      const rowWeight = row.sheetRowIndex ?? idx;

      if (!map[orderKey]) {
        map[orderKey] = {
          orderKey,
          referenceNo: row.referenceNo || '',
          timestamp: row.timestamp,
          customerPO: row.customerPO,
          customerName: row.customerName,
          customerEmail: row.customerEmail || row.customerMailId,
          customerMailId: row.customerMailId || row.customerEmail,
          orderDate: row.orderDate,
          items: [],
          remark: row.remark || '',
          customerNumber: row.customerNumber,
          billingAddress: row.billingAddress,
          deliveryAddress: row.deliveryAddress,
          transporterName: row.transporterName,
          salesPerson: row.salesPerson,
          salesPersonContact: row.salesPersonContact,
          accountStatus: row.accountStatus,
          branch: row.branch,
          approvalStatus: row.approvalStatus,
          branchHeadName: row.branchHeadName || 'Vinay Chhajer',
          branchHeadEmail: row.branchHeadEmail || 'vinay.chhajer@ginzalimited.com',
          orderNo: row.orderNo || '',
          orderNoTimestamp: row.orderNoTimestamp || '',
          statusAN: (isItemComplete(row.statusAN) ? 'Complete' : row.statusAN) as any || 'Open',
          _maxRow: rowWeight
        };
      } else {
        if (!map[orderKey].orderNo && row.orderNo) {
          map[orderKey].orderNo = row.orderNo;
          map[orderKey].orderNoTimestamp = row.orderNoTimestamp;
        }
        if (isItemComplete(row.statusAN)) {
          map[orderKey].statusAN = 'Complete';
        }
        if ((map[orderKey]._maxRow ?? 0) < rowWeight) {
          map[orderKey]._maxRow = rowWeight;
        }
      }

      const itemKey = `${orderKey}___${(row.itemName || '').trim()}___${(row.color || '').trim()}___${(row.width || '').trim()}`;
      const dispatch = dispatchRecords[itemKey] !== undefined ? dispatchRecords[itemKey] : (Number(row.dispatchQty) || 0);
      const balance = Number((row.qty - dispatch).toFixed(4));

      map[orderKey].items.push({
        id: row.orderId,
        unit: row.unit,
        itemName: row.itemName,
        color: row.color,
        width: row.width,
        unitOfItem: row.unitOfItem,
        qty: row.qty,
        rate: row.rate,
        discount: row.discount,
        deliveryDate: row.deliveryDate,
        dispatchQty: dispatch,
        balanceQty: balance,
        statusAN: (isItemComplete(row.statusAN) ? 'Complete' : (row.statusAN as any)) || 'Open'
      });
    });

    // Show newest Google Sheet orders on Page 1 first
    return Object.values(map).sort((a, b) => (b._maxRow ?? 0) - (a._maxRow ?? 0));
  }, [automationRows, rawResponses, dispatchRecords]);

  // Handle Status AM Dropdown Change: 'Open' | 'In-Progress' | 'Complete'
  const handleItemStatusChange = async (orderId: string, newStatus: 'Open' | 'In-Progress' | 'Closed' | 'Complete') => {
    const canonicalStatus: 'Open' | 'In-Progress' | 'Complete' = isItemComplete(newStatus)
      ? 'Complete'
      : newStatus === 'In-Progress'
      ? 'In-Progress'
      : 'Open';

    const targetRow = automationRows.find(r => r.orderId === orderId) || rawResponses.find(r => r.orderId === orderId);
    const targetOrderKey = targetRow ? buildOrderGroupKey(targetRow) : '';
    const affectedClient = targetRow?.customerName || targetRow?.itemName || orderId;

    const updater = (list: ProductOrderRow[]) =>
      list.map(row => {
        const rowOrderKey = buildOrderGroupKey(row);
        if (canonicalStatus === 'Complete' && targetOrderKey && rowOrderKey === targetOrderKey) {
          return { ...row, statusAN: 'Complete' as const };
        }
        if (row.orderId === orderId || (targetOrderKey && rowOrderKey === targetOrderKey)) {
          return { ...row, statusAN: canonicalStatus };
        }
        return row;
      });

    setAutomationRows(updater);
    setRawResponses(updater);

    let sheetNote = '';
    if (webAppUrl && targetRow) {
      const writeRes = await pushOrderUpdateToGoogleSheet(webAppUrl, {
        action: 'updateStatusAM',
        sheetRowIndex: targetRow.sheetRowIndex,
        timestamp: targetRow.timestamp,
        customerName: targetRow.customerName,
        itemName: targetRow.itemName,
        orderNo: targetRow.orderNo,
        statusAM: canonicalStatus
      });
      sheetNote = writeRes.ok ? ' | Google Sheet Col AM updated ✓' : ` | Sheet sync: ${writeRes.message}`;
    }

    setSyncFeedback(
      `Order "${affectedClient}" Col AM set to "${canonicalStatus}". ${
        canonicalStatus === 'Complete'
          ? 'Moved automatically to "Closed Orders (Complete)"!'
          : 'Active in "Product Automation (Open)".'
      }${sheetNote}`
    );
    setTimeout(() => setSyncFeedback(null), 4500);
  };

  // Debounce timers for pushing Col U Dispatch Qty to Google Sheet
  const dispatchPushTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Handle changing Dispatch Qty in Col U
  const handleDispatchChange = (orderKey: string, item: { id?: string; itemName: string; color: string; width: string }, newQtyStr: string) => {
    const val = newQtyStr === '' ? 0 : (Number(newQtyStr) || 0);
    const itemKey = `${orderKey}___${item.itemName.trim()}___${item.color.trim()}___${item.width.trim()}`;

    setDispatchRecords(prev => ({
      ...prev,
      [itemKey]: val
    }));

    setAutomationRows(prev =>
      prev.map(r => {
        if (r.orderId === item.id || buildOrderGroupKey(r) === orderKey && r.itemName.trim() === item.itemName.trim()) {
          return {
            ...r,
            dispatchQty: val,
            balanceQty: Number((r.qty - val).toFixed(4))
          };
        }
        return r;
      })
    );

    if (webAppUrl) {
      const targetRow = automationRowsRef.current.find(r => r.orderId === item.id || buildOrderGroupKey(r) === orderKey);
      if (targetRow) {
        if (dispatchPushTimersRef.current[itemKey]) {
          clearTimeout(dispatchPushTimersRef.current[itemKey]);
        }
        dispatchPushTimersRef.current[itemKey] = setTimeout(() => {
          pushOrderUpdateToGoogleSheet(webAppUrl, {
            action: 'updateDispatchQty',
            sheetRowIndex: targetRow.sheetRowIndex,
            timestamp: targetRow.timestamp,
            customerName: targetRow.customerName,
            itemName: item.itemName,
            orderNo: targetRow.orderNo,
            dispatchQty: val
          });
        }, 900);
      }
    }
  };

  // Delete an entire order
  const handleDeleteOrder = (orderKey: string, poName: string) => {
    if (!window.confirm(`Are you sure you want to delete order "${poName}"?`)) return;
    setAutomationRows(prev => prev.filter(row => buildOrderGroupKey(row) !== orderKey));
    setRawResponses(prev => prev.filter(row => buildOrderGroupKey(row) !== orderKey));
    setSyncFeedback(`Order ${poName} deleted successfully.`);
    setTimeout(() => setSyncFeedback(null), 3500);
  };

  // Delete single item row
  const handleDeleteItem = (itemOrderId: string) => {
    setAutomationRows(prev => prev.filter(row => row.orderId !== itemOrderId));
    setRawResponses(prev => prev.filter(row => row.orderId !== itemOrderId));
    setSyncFeedback(`Item row removed.`);
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // Clear / Delete all rows from Product Order tab (Wipes table to 0 rows for clean 1:1 fresh upload)
  const handleClearAllProductOrders = async () => {
    setRawResponses([]);
    await clearOrdersFromStorage();
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (e) {}
    setSyncFeedback('✓ All rows deleted from Product Order tab. Ready for clean 1:1 fresh upload!');
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  // Clear all active orders from Product Automation tab (Unassigns SO# or wipes active items)
  const handleClearProductAutomation = () => {
    if (window.confirm("Are you sure you want to clear the Product Automation tab? Active Order Numbers will be unassigned so you can upload fresh automation data.")) {
      setRawResponses(prev =>
        prev.map(row => ({
          ...row,
          orderNo: '',
          orderNoTimestamp: '',
          statusAN: 'Open'
        }))
      );
      setSyncFeedback("✓ Product Automation cleared! Orders unassigned and returned to pending in Product Order.");
      setTimeout(() => setSyncFeedback(null), 4500);
    }
  };

  // Full Clean Reset for New Project (Wipes all data to 0 rows for clean slate)
  const handleFullProjectClean = async () => {
    if (window.confirm("Full Clean Reset: Do you want to wipe all records (0 rows) to set up your new project with Google Sheet 1xSSZ6DyQarQJOd8UpOfCV-tjdKL1oQq_IKuXJkcRv5Q & Firebase project-vishal-team?")) {
      setRawResponses([]);
      await clearOrdersFromStorage();
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem(LOCAL_STORAGE_DISPATCH_KEY);
      } catch (e) {}
      setImportSheetId('1xSSZ6DyQarQJOd8UpOfCV-tjdKL1oQq_IKuXJkcRv5Q');
      setImportTabName('Product Order');
      setFirebaseUrl('https://project-vishal-team-default-rtdb.firebaseio.com');
      setSyncFeedback("✓ Full Project Clean complete (0 rows). Ready to connect your new Google Sheet & Firebase!");
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  // Add Item to existing order
  const handleAddItemToExistingOrder = (order: GroupedOrder, newItemData: Partial<OrderItem>) => {
    const newId = `ORD-${Date.now().toString().slice(-4)}`;
    const newRow: ProductOrderRow = {
      orderId: newId,
      timestamp: order.timestamp,
      customerPO: order.customerPO,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      orderDate: order.orderDate,
      unit: newItemData.unit || 'WARP(UDHANA)',
      itemName: newItemData.itemName || 'L-4014/NS',
      color: newItemData.color || 'White',
      width: newItemData.width || '56"',
      unitOfItem: newItemData.unitOfItem || 'MTR',
      qty: Number(newItemData.qty) || 100,
      rate: Number(newItemData.rate) || 150,
      discount: Number(newItemData.discount) || 0,
      deliveryDate: newItemData.deliveryDate || '15/11/2026',
      remark: order.remark,
      customerNumber: order.customerNumber,
      billingAddress: order.billingAddress,
      deliveryAddress: order.deliveryAddress,
      transporterName: order.transporterName,
      salesPerson: order.salesPerson,
      accountStatus: order.accountStatus,
      branch: order.branch,
      approvalStatus: order.approvalStatus,
      branchHeadName: '',
      orderNo: order.orderNo,
      statusAN: order.statusAN || 'Open'
    };

    setRawResponses(prev => [...prev, newRow]);
    setAddingItemToOrder(null);
    setSyncFeedback(`Added item "${newItemData.itemName}" to order ${order.customerPO}! Merged block expanded.`);
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  // Save new multi-item order from modal
  const handleCreateNewOrder = (orderData: {
    customerPO: string;
    customerName: string;
    customerEmail: string;
    customerNumber: string;
    orderDate: string;
    billingAddress: string;
    deliveryAddress: string;
    transporterName: string;
    salesPerson: string;
    orderNo: string;
    remark: string;
    statusAN: 'Open' | 'In-Progress' | 'Closed';
    items: Array<{
      unit: string;
      itemName: string;
      color: string;
      width: string;
      unitOfItem: string;
      qty: number;
      rate: number;
      discount: number;
      deliveryDate: string;
    }>;
  }) => {
    const nowStr = new Date().toLocaleString('en-IN');
    const newRows: ProductOrderRow[] = orderData.items.map((it, idx) => ({
      orderId: `ORD-${Date.now()}-${idx + 1}`,
      timestamp: nowStr,
      customerPO: orderData.customerPO,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      orderDate: orderData.orderDate || new Date().toISOString().split('T')[0],
      unit: it.unit || 'WARP(UDHANA)',
      itemName: it.itemName,
      color: it.color,
      width: it.width,
      unitOfItem: it.unitOfItem,
      qty: Number(it.qty) || 0,
      rate: Number(it.rate) || 0,
      discount: Number(it.discount) || 0,
      deliveryDate: it.deliveryDate,
      remark: orderData.remark,
      customerNumber: orderData.customerNumber,
      billingAddress: orderData.billingAddress,
      deliveryAddress: orderData.deliveryAddress,
      transporterName: orderData.transporterName,
      salesPerson: orderData.salesPerson,
      accountStatus: 'Approved',
      branch: 'Mumbai Central',
      approvalStatus: 'APPROVED',
      branchHeadName: orderData.salesPerson,
      orderNo: orderData.orderNo,
      statusAN: orderData.statusAN
    }));

    setRawResponses(prev => [...newRows, ...prev]);
    setShowNewOrderModal(false);
    setSyncFeedback(`New Order "${orderData.customerPO}" added with ${orderData.items.length} items!`);
    setTimeout(() => setSyncFeedback(null), 4500);
  };

  // Reset to default sample data
  const handleReset = () => {
    if (window.confirm("Do you want to reset the sheet data to default sample records?")) {
      setRawResponses(initialRawResponses);
      setDispatchRecords(initialExistingDispatch);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(LOCAL_STORAGE_DISPATCH_KEY);
      setSyncFeedback("Reset to default sample data.");
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  // Generate or assign Order No for a row in Product Order sheet + sync to Product Automation + Google Sheet
  const handleGenerateOrderNo = async (orderId: string, customNo?: string) => {
    const generatedNo = (customNo && customNo.trim() !== '')
      ? customNo.trim()
      : `MMFSO2526-0${Math.floor(1750 + Math.random() * 50)}`;
    const nowStr = new Date().toLocaleString('en-IN');
    const targetRow = rawResponses.find(r => r.orderId === orderId);
    const affectedItem = targetRow?.itemName || orderId;
    const newGroupKey = targetRow
      ? (targetRow.orderGroupKey || [generatedNo, targetRow.customerName, targetRow.orderDate].map(v => (v || '').trim()).join('_'))
      : orderId;

    const updatedRaw = rawResponses.map(row => {
      if (row.orderId === orderId) {
        return {
          ...row,
          orderNo: generatedNo,
          orderNoTimestamp: nowStr,
          statusAN: row.statusAN || 'Open'
        };
      }
      return row;
    });
    setRawResponses(updatedRaw);
    saveOrdersToStorage(updatedRaw);

    if (targetRow) {
      const promotedRow: ProductOrderRow = {
        ...targetRow,
        orderGroupKey: newGroupKey,
        orderNo: generatedNo,
        orderNoTimestamp: nowStr,
        statusAN: isItemComplete(targetRow.statusAN) ? targetRow.statusAN : 'Open',
        dispatchQty: targetRow.dispatchQty ?? 0,
        balanceQty: targetRow.balanceQty ?? targetRow.qty
      };

      setAutomationRows(prev => {
        const existsIdx = prev.findIndex(r => r.orderId === orderId || (r.orderGroupKey && r.orderGroupKey === newGroupKey));
        const nextAuto = existsIdx >= 0
          ? prev.map((r, i) => (i === existsIdx ? { ...r, orderNo: generatedNo, orderNoTimestamp: nowStr } : r))
          : [promotedRow, ...prev];
        saveAutomationOrdersToStorage(nextAuto);
        return nextAuto;
      });
    }

    if (webAppUrl && targetRow) {
      setSyncFeedbackTone('success');
      setSyncFeedback(`⏳ Saving Order No "${generatedNo}" to Google Sheet Product Order Col S...`);
      const writeRes = await pushOrderUpdateToGoogleSheet(webAppUrl, {
        action: 'updateOrderNo',
        sheetRowIndex: targetRow.sheetRowIndex,
        timestamp: targetRow.timestamp,
        orderDate: targetRow.orderDate,
        customerName: targetRow.customerName,
        itemName: targetRow.itemName,
        qty: targetRow.qty,
        orderNo: generatedNo
      });

      if (writeRes.ok) {
        setSyncFeedbackTone('success');
        setSyncFeedback(`✓ Order No "${generatedNo}" (${affectedItem}) saved in App + Google Sheet Col S! (${writeRes.message})`);
      } else {
        setSyncFeedbackTone('error');
        setSyncFeedback(`⚠️ App me save hua, lekin Google Sheet write failed: ${writeRes.message}`);
      }
    } else {
      setSyncFeedbackTone('warning');
      setSyncFeedback(
        `⚠️ Order No "${generatedNo}" sirf App me save hua hai! Google Sheet "Product Order" Col S me save karne ke liye "2-Way Sheet Setup" URL add karein.`
      );
    }
  };

  // Generate Order No for all pending rows in Product Order
  const handleGenerateAllPendingOrderNo = () => {
    let counter = 1752;
    const nowStr = new Date().toLocaleString('en-IN');
    let countGenerated = 0;
    const newlyPromoted: ProductOrderRow[] = [];

    setRawResponses(prev =>
      prev.map(row => {
        if (!row.orderNo || row.orderNo.trim() === '') {
          countGenerated++;
          const genNo = `MMFSO2526-0${counter++}`;
          const updated: ProductOrderRow = {
            ...row,
            orderNo: genNo,
            orderNoTimestamp: nowStr,
            statusAN: row.statusAN || 'Open'
          };
          newlyPromoted.push({
            ...updated,
            orderGroupKey: [genNo, row.customerName, row.orderDate].map(v => (v || '').trim()).join('_')
          });
          return updated;
        }
        return row;
      })
    );

    if (newlyPromoted.length > 0) {
      setAutomationRows(prev => [...newlyPromoted, ...prev]);
    }

    setSyncFeedback(
      `Generated Order Numbers for ${countGenerated} pending orders! All flowed to Product Automation (Open).`
    );
    setTimeout(() => setSyncFeedback(null), 4500);
  };

  // Add new row into Product Order (+ push to Google Sheet if Web App configured)
  const handleAddNewProductOrderRow = async (newRow: ProductOrderRow) => {
    setRawResponses(prev => [newRow, ...prev]);
    if (newRow.orderNo && newRow.orderNo.trim() !== '') {
      setAutomationRows(prev => [
        {
          ...newRow,
          orderGroupKey: [newRow.orderNo, newRow.customerName, newRow.orderDate].map(v => (v || '').trim()).join('_'),
          statusAN: 'Open'
        },
        ...prev
      ]);
    }

    let sheetNote = '';
    if (webAppUrl) {
      const writeRes = await pushOrderUpdateToGoogleSheet(webAppUrl, {
        action: 'addOrderRow',
        rowData: newRow
      });
      sheetNote = writeRes.ok ? ' & appended to Google Sheet ✓' : ` (Sheet note: ${writeRes.message})`;
    }

    setSyncFeedback(`New Order "${newRow.customerName}" added to Product Order${sheetNote}!`);
    setTimeout(() => setSyncFeedback(null), 4500);
  };

  // Update row field in Product Order
  const handleUpdateProductOrderRow = (orderId: string, field: keyof ProductOrderRow, value: any) => {
    setRawResponses(prev =>
      prev.map(row => (row.orderId === orderId ? { ...row, [field]: value } : row))
    );
  };

  // Update Order No (Col S) from Product Automation modal & sync back to Product Order + Google Sheet
  const handleSaveOrderNo = async () => {
    if (!editingOrderNo) return;
    const nowStr = new Date().toLocaleString('en-IN');
    const newVal = editingOrderNo.value.trim();

    let matchedRow: ProductOrderRow | undefined;

    setAutomationRows(prev =>
      prev.map(row => {
        if (buildOrderGroupKey(row) === editingOrderNo.key) {
          matchedRow = row;
          return {
            ...row,
            orderNo: newVal,
            orderNoTimestamp: nowStr,
            statusAN: row.statusAN || 'Open'
          };
        }
        return row;
      })
    );

    if (matchedRow) {
      setRawResponses(prev =>
        prev.map(r => {
          if (
            r.customerName.trim().toLowerCase() === matchedRow!.customerName.trim().toLowerCase() &&
            r.timestamp === matchedRow!.timestamp
          ) {
            return { ...r, orderNo: newVal, orderNoTimestamp: nowStr };
          }
          return r;
        })
      );

      if (webAppUrl) {
        const writeRes = await pushOrderUpdateToGoogleSheet(webAppUrl, {
          action: 'updateOrderNo',
          sheetRowIndex: matchedRow.sheetRowIndex,
          timestamp: matchedRow.timestamp,
          orderDate: matchedRow.orderDate,
          customerName: matchedRow.customerName,
          itemName: matchedRow.itemName,
          qty: matchedRow.qty,
          orderNo: newVal
        });
        setSyncFeedbackTone(writeRes.ok ? 'success' : 'error');
        setSyncFeedback(
          writeRes.ok
            ? `✓ Order No for ${editingOrderNo.po || matchedRow?.customerName} set to "${newVal}" in App + Google Sheet Col S!`
            : `⚠️ App me save hua, Google Sheet write error: ${writeRes.message}`
        );
      } else {
        setSyncFeedbackTone('warning');
        setSyncFeedback(`⚠️ Order No "${newVal}" sirf App me save hua! Google Sheet Col S write-back ke liye "2-Way Sheet Setup" karein.`);
      }
    } else {
      setSyncFeedbackTone('success');
      setSyncFeedback(`Order No for ${editingOrderNo.po || ''} set to "${newVal}"!`);
    }

    setEditingOrderNo(null);
  };

  // Handlers for Operational Columns W, X, AC, AE, AF, AG, AH, AI, AJ, AL, AN
  const handleToggleColAE = (orderKey: string, checked: boolean) => {
    setColAEChecks(prev => {
      const next = { ...prev, [orderKey]: checked };
      try { localStorage.setItem(LOCAL_STORAGE_COL_AE_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
    if (checked) {
      const ts = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      setColAFTimestamps(prev => {
        const next = { ...prev, [orderKey]: ts };
        try { localStorage.setItem(LOCAL_STORAGE_COL_AF_KEY, JSON.stringify(next)); } catch (e) {}
        return next;
      });
      setSyncFeedback(`Col AE Follow-up 1 Checked ✓ | Auto Timestamp set to ${ts} in Col AF`);
    } else {
      setColAFTimestamps(prev => {
        const next = { ...prev, [orderKey]: '' };
        try { localStorage.setItem(LOCAL_STORAGE_COL_AF_KEY, JSON.stringify(next)); } catch (e) {}
        return next;
      });
      setSyncFeedback(`Col AE Follow-up 1 Unchecked | Col AF Timestamp cleared`);
    }
    setTimeout(() => setSyncFeedback(null), 3500);
  };
  const handleToggleColAG = handleToggleColAE;

  const handleUpdateColAG = (orderKey: string, val: string) => {
    setColAGRemarks(prev => {
      const next = { ...prev, [orderKey]: val };
      try { localStorage.setItem(LOCAL_STORAGE_COL_AG_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };
  const handleUpdateColAI = handleUpdateColAG;

  const handleToggleColAH = (orderKey: string, checked: boolean) => {
    setColAHChecks(prev => {
      const next = { ...prev, [orderKey]: checked };
      try { localStorage.setItem(LOCAL_STORAGE_COL_AH_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
    if (checked) {
      const ts = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      setColAITimestamps(prev => {
        const next = { ...prev, [orderKey]: ts };
        try { localStorage.setItem(LOCAL_STORAGE_COL_AI_KEY, JSON.stringify(next)); } catch (e) {}
        return next;
      });
      setSyncFeedback(`Col AH Follow-up 2 Checked ✓ | Auto Timestamp set to ${ts} in Col AI`);
    } else {
      setColAITimestamps(prev => {
        const next = { ...prev, [orderKey]: '' };
        try { localStorage.setItem(LOCAL_STORAGE_COL_AI_KEY, JSON.stringify(next)); } catch (e) {}
        return next;
      });
      setSyncFeedback(`Col AH Follow-up 2 Unchecked | Col AI Timestamp cleared`);
    }
    setTimeout(() => setSyncFeedback(null), 3500);
  };
  const handleToggleColAJ = handleToggleColAH;

  const handleUpdateColAJ = (orderKey: string, val: string) => {
    setColAJRemarks(prev => {
      const next = { ...prev, [orderKey]: val };
      try { localStorage.setItem(LOCAL_STORAGE_COL_AJ_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };
  const handleUpdateColAL = handleUpdateColAJ;

  const handleUpdateColW = (orderKey: string, val: string) => {
    setColWStatuses(prev => {
      const next = { ...prev, [orderKey]: val };
      try { localStorage.setItem(LOCAL_STORAGE_COL_W_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };
  const handleUpdateColAA = handleUpdateColW;

  const handleUpdateColX = (orderKey: string, val: string) => {
    setColXRemarks(prev => {
      const next = { ...prev, [orderKey]: val };
      try { localStorage.setItem(LOCAL_STORAGE_COL_X_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };
  const handleUpdateColAB = handleUpdateColX;

  // Export entire sheet as CSV (Exact 45 Columns from user's specification)
  const handleExportCSV = () => {
    const headers = [
      'Timestamp', 'Customer PO', 'Customer Name', 'Customer Email', 'Order Date',
      'Unit', 'Item Name', 'Color', 'Width', 'Unit (of Item)', 'Qty', 'Rate', 'Discount', 'Delivery Date',
      'Remark', 'Customer Number', 'Billing Address', 'Delivery Address', 'Transporter Name',
      'Sales Person Name', 'Account Status', 'Approval', 'Timestamp', 'Order Number',
      'Dispatch Qnt', 'Balance Qnt', 'Status', 'Remark', 'Confirmation Mail', 'Mail Status',
      'Confirmation Msg', 'Whatspp Link', 'Follow-up 1', 'Timestamp', 'Follow-up 1 Remark',
      'Follow-up 2', 'Timestamp', 'Follow-up 2 Remark', 'LR- Number', 'Open / Close',
      'Delivered Whatspp Msg', 'Whatspp Link', 'Delivery Email', 'Delivery Email Link', 'Email Status Column'
    ];

    const rows: string[][] = [];

    groupedOrders.forEach(order => {
      order.items.forEach(item => {
        rows.push([
          `"${order.timestamp || ''}"`,
          `"${order.customerPO || ''}"`,
          `"${order.customerName || ''}"`,
          `"${order.customerEmail || ''}"`,
          `"${order.orderDate || ''}"`,
          `"${item.unit || ''}"`,
          `"${item.itemName || ''}"`,
          `"${item.color || ''}"`,
          `"${item.width || ''}"`,
          `"${item.unitOfItem || ''}"`,
          `${item.qty}`,
          `${item.rate}`,
          `${item.discount}`,
          `"${item.deliveryDate || ''}"`,
          `"${(order.remark || '').replace(/"/g, '""')}"`,
          `"${order.customerNumber || ''}"`,
          `"${(order.billingAddress || '').replace(/"/g, '""')}"`,
          `"${(order.deliveryAddress || '').replace(/"/g, '""')}"`,
          `"${order.transporterName || ''}"`,
          `"${order.salesPerson || ''}"`,
          `"${order.accountStatus || ''}"`,
          `"${order.approvalStatus || ''}"`,
          `"${order.branch || ''}"`,
          `"${order.orderNo || ''}"`,
          `${item.dispatchQty || 0}`,
          `${item.balanceQty || 0}`,
          `"${colAAStatuses[order.orderKey] || 'In Production'}"`,
          `"${(colABRemarks[order.orderKey] || '').replace(/"/g, '""')}"`,
          `"Sent"`,
          `"Delivered"`,
          `"${aeStatuses[order.orderKey] || 'Pending'}"`,
          `"${(aeStatuses[order.orderKey] || 'Pending') === 'Message Sent' ? 'Sent WA' : ''}"`,
          `"${colAGChecks[order.orderKey] ? 'Yes' : 'No'}"`,
          `"${colAHTimestamps[order.orderKey] || ''}"`,
          `"${(colAIRemarks[order.orderKey] || '').replace(/"/g, '""')}"`,
          `"${colAJChecks[order.orderKey] ? 'Yes' : 'No'}"`,
          `"${colAKTimestamps[order.orderKey] || ''}"`,
          `"${(colALRemarks[order.orderKey] || '').replace(/"/g, '""')}"`,
          `"${lrNumbers[order.orderKey] || ''}"`,
          `"${order.statusAN || 'Open'}"`,
          `"${aoStatuses[order.orderKey] || 'Pending'}"`,
          `"${aoStatuses[order.orderKey] === 'Message Sent' ? 'Sent Messages' : ''}"`,
          `"${order.customerEmail || ''}"`,
          `""`,
          `"Sent"`
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GINZA_Product_Automation_45Col_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSyncFeedback('Downloaded 45-Column GINZA FMS CSV file ready for Excel / Google Sheet!');
    setTimeout(() => setSyncFeedback(null), 3500);
  };

  // Helper: Extract Clean Google Sheet ID from URL or Raw ID
  const extractSheetId = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  };

  // Helper: Push order rows to Firebase Realtime Database
  const pushOrdersToFirebase = async (
    rowsToSync: ProductOrderRow[],
    customUrl?: string,
    customSecret?: string
  ): Promise<{ activeOrders: number; closedOrders: number; totalRows: number }> => {
    const targetUrl = (customUrl || firebaseUrl || 'https://ginza-fms-default-rtdb.firebaseio.com').trim().replace(/\/+$/, '');
    const targetSecret = (customSecret !== undefined ? customSecret : firebaseSecret || 'iIElINFgR124ssaG3QWjExz2lT72cRh5g502oP6J').trim();

    if (!targetUrl) {
      throw new Error('Firebase Realtime Database URL not specified.');
    }

    const authParam = targetSecret ? `?auth=${encodeURIComponent(targetSecret)}` : '';

    // Group rows by orderKey
    const tempGroupMap: Record<string, ProductOrderRow[]> = {};
    rowsToSync.forEach(r => {
      const k = `${r.customerPO || 'NOPO'}_${r.customerName || 'NOCUST'}_${r.orderNo || r.orderDate || 'NODATE'}`;
      if (!tempGroupMap[k]) tempGroupMap[k] = [];
      tempGroupMap[k].push(r);
    });

    const automationPayload: Record<string, any> = {};
    const closedPayload: Record<string, any> = {};

    Object.entries(tempGroupMap).forEach(([rawKey, items]) => {
      const first = items[0];
      const safeKey = rawKey.replace(/[.#$/\[\]]/g, '_').substring(0, 100);

      const activeItems = items.filter(it => (it.statusAN || 'Open') !== 'Closed');
      const closedItems = items.filter(it => (it.statusAN || 'Open') === 'Closed');

      if (activeItems.length > 0) {
        automationPayload[safeKey] = {
          order_key: safeKey,
          customer_po: first.customerPO,
          customer_name: first.customerName,
          customer_email: first.customerEmail,
          order_date: first.orderDate,
          order_no: first.orderNo || '',
          sales_person: first.salesPerson,
          transporter_name: first.transporterName,
          billing_address: first.billingAddress,
          delivery_address: first.deliveryAddress,
          customer_number: first.customerNumber,
          remark: first.remark,
          status: first.statusAN || 'Open',
          items: activeItems.map((it, idx) => ({
            item_index: idx + 1,
            item_name: it.itemName,
            color: it.color,
            width: it.width,
            unit: it.unitOfItem || it.unit,
            qty: it.qty,
            rate: it.rate,
            discount: it.discount,
            delivery_date: it.deliveryDate,
            dispatch_qty: it.dispatchQty || 0,
            balance_qty: it.balanceQty || it.qty,
            status: it.statusAN || 'Open'
          })),
          total_qty: activeItems.reduce((s, it) => s + it.qty, 0),
          total_dispatch_qty: activeItems.reduce((s, it) => s + (it.dispatchQty || 0), 0),
          total_balance_qty: activeItems.reduce((s, it) => s + (it.balanceQty || it.qty), 0),
          last_synced_at: new Date().toISOString()
        };
      }

      if (closedItems.length > 0) {
        closedPayload[safeKey] = {
          order_key: safeKey,
          customer_po: first.customerPO,
          customer_name: first.customerName,
          customer_email: first.customerEmail,
          order_date: first.orderDate,
          order_no: first.orderNo || '',
          sales_person: first.salesPerson,
          transporter_name: first.transporterName,
          billing_address: first.billingAddress,
          delivery_address: first.deliveryAddress,
          customer_number: first.customerNumber,
          remark: first.remark,
          status: 'Closed',
          items: closedItems.map((it, idx) => ({
            item_index: idx + 1,
            item_name: it.itemName,
            color: it.color,
            width: it.width,
            unit: it.unitOfItem || it.unit,
            qty: it.qty,
            rate: it.rate,
            discount: it.discount,
            delivery_date: it.deliveryDate,
            dispatch_qty: it.dispatchQty || 0,
            balance_qty: it.balanceQty || 0,
            status: 'Closed'
          })),
          total_qty: closedItems.reduce((s, it) => s + it.qty, 0),
          total_dispatch_qty: closedItems.reduce((s, it) => s + (it.dispatchQty || 0), 0),
          total_balance_qty: closedItems.reduce((s, it) => s + (it.balanceQty || 0), 0),
          last_synced_at: new Date().toISOString()
        };
      }
    });

    // Send PATCH to /product_automation.json
    if (Object.keys(automationPayload).length > 0) {
      const resp = await fetch(`${targetUrl}/product_automation.json${authParam}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(automationPayload)
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Firebase HTTP ${resp.status}: ${text.substring(0, 150)}`);
      }
    }

    // Send PATCH to /closed_orders.json
    if (Object.keys(closedPayload).length > 0) {
      const resp2 = await fetch(`${targetUrl}/closed_orders.json${authParam}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(closedPayload)
      });
      if (!resp2.ok) {
        const text = await resp2.text();
        throw new Error(`Firebase HTTP ${resp2.status}: ${text.substring(0, 150)}`);
      }
    }

    return {
      activeOrders: Object.keys(automationPayload).length,
      closedOrders: Object.keys(closedPayload).length,
      totalRows: rowsToSync.length
    };
  };

  // Helper: Robust CSV parser respecting quotes and newlines
  const parseCsvRows = (text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === ',' || char === '\t') && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  };

  // Direct Excel / CSV Paste or Google Sheet Fetch Data Parser
  const handleParseImportedData = async (
    text: string,
    syncFirebase: boolean = true,
    sourceLabel: string = 'Import'
  ) => {
    if (!text.trim()) return;

    const parsedRows = parseCsvRows(text.trim());
    if (parsedRows.length === 0) {
      setImportError('Sheet data me koi valid rows nahi mili.');
      return;
    }

    const newItems: ProductOrderRow[] = [];
    const importedColW: Record<string, string> = {};
    const importedColX: Record<string, string> = {};
    const importedColAC: Record<string, string> = {};
    const importedColAE: Record<string, boolean> = {};
    const importedColAF: Record<string, string> = {};
    const importedColAG: Record<string, string> = {};
    const importedColAH: Record<string, boolean> = {};
    const importedColAI: Record<string, string> = {};
    const importedColAJ: Record<string, string> = {};
    const importedColAL: Record<string, string> = {};
    const importedColAN: Record<string, string> = {};
    const importedDispatch: Record<string, number> = {};

    let currentPO = 'IMPORT-PO';
    let currentName = 'Direct Imported Client';
    let currentDate = new Date().toLocaleDateString('en-GB');
    let currentEmail = 'N/A';
    let currentBilling = '';
    let currentDelivery = '';
    let currentTransporter = 'SafeXpress';
    let currentSalesPerson = 'Lalit Maroo';
    let currentOrderNo = '';
    let currentRemark = '';

    parsedRows.forEach((cols, index) => {
      const firstColLower = (cols[0] || '').toLowerCase().trim();
      const secondColLower = (cols[1] || '').toLowerCase().trim();
      const thirdColLower = (cols[2] || '').toLowerCase().trim();
      const fourthColLower = (cols[3] || '').toLowerCase().trim();

      // Skip header row if it contains header keywords
      if (
        index === 0 &&
        (firstColLower.includes('timestamp') ||
          firstColLower.includes('order no') ||
          firstColLower.includes('order') ||
          secondColLower.includes('customer') ||
          secondColLower.includes('timestamp') ||
          thirdColLower.includes('po') ||
          fourthColLower.includes('customer') ||
          firstColLower.includes('#'))
      ) {
        return;
      }

      if (cols.length < 2) return;

      // Prioritize 43-column Product Automation format if cols >= 26
      const is43ColFormat = cols.length >= 26;
      const is19ColFormat = !is43ColFormat && (cols.length >= 14);

      if (is19ColFormat) {
        // Exact 19-column Product Order layout (Columns A to S)
        // Col 0 (A): Timestamp
        // Col 1 (B): Customer Name
        // Col 2 (C): Order Date
        // Col 3 (D): Unit
        // Col 4 (E): Item Name
        // Col 5 (F): Color
        // Col 6 (G): Width
        // Col 7 (H): Unit (of item)
        // Col 8 (I): Qty
        // Col 9 (J): Rate
        // Col 10 (K): Discount
        // Col 11 (L): Delivery Date
        // Col 12 (M): Remark
        // Col 13 (N): Customer Number
        // Col 14 (O): Billing Address
        // Col 15 (P): Delivery Address
        // Col 16 (Q): Sales Person Name
        // Col 17 (R): Sales Person Contact
        // Col 18 (S): Order Number

        const timestamp = cols[0] ? cols[0].trim() : '';
        const custName = cols[1] ? cols[1].trim() : '';
        const date = cols[2] ? cols[2].trim() : '';
        const unit = cols[3] ? cols[3].trim() : '';
        const itemName = cols[4] ? cols[4].trim() : '';
        const color = cols[5] ? cols[5].trim() : '';
        const width = cols[6] ? cols[6].trim() : '';
        const unitOfItem = cols[7] ? cols[7].trim() : '';
        const qty = cols[8] ? (parseFloat(cols[8].replace(/,/g, '')) || 0) : 0;
        const rate = cols[9] ? (parseFloat(cols[9].replace(/,/g, '')) || 0) : 0;
        const discount = cols[10] ? (parseFloat(cols[10].replace(/,/g, '')) || 0) : 0;
        const deliveryDate = cols[11] ? cols[11].trim() : '';
        const remark = cols[12] ? cols[12].trim() : '';
        const phone = cols[13] ? cols[13].trim() : '';
        const billing = cols[14] ? cols[14].trim() : '';
        const delivery = cols[15] ? cols[15].trim() : '';
        const sales = cols[16] ? cols[16].trim() : '';
        const salesContact = cols[17] ? cols[17].trim() : '';
        const orderNo = cols[18] ? cols[18].trim() : '';

        newItems.push({
          orderId: `ORD-IMP-${index + 1}-${Date.now().toString(36)}`,
          timestamp: timestamp || new Date().toLocaleString('en-IN'),
          customerName: custName,
          customerPO: '',
          customerEmail: '',
          orderDate: date,
          unit: unit,
          itemName: itemName,
          color: color,
          width: width,
          unitOfItem: unitOfItem,
          qty: qty,
          rate: rate,
          discount: discount,
          deliveryDate: deliveryDate,
          remark: remark,
          customerNumber: phone,
          billingAddress: billing,
          deliveryAddress: delivery,
          salesPerson: sales,
          salesPersonContact: salesContact,
          orderNo: orderNo,
          orderNoTimestamp: orderNo ? new Date().toLocaleString('en-IN') : '',
          statusAN: 'Open',
          dispatchQty: 0,
          balanceQty: qty
        });
      } else if (is43ColFormat) {
        // Exact 43-column Product Automation layout (Columns A to AQ)
        const timestamp = cols[0] ? cols[0].trim() : '';
        const custName = cols[1] ? cols[1].trim() : '';
        const date = cols[2] ? cols[2].trim() : '';
        const unit = cols[3] ? cols[3].trim() : '';
        const itemName = cols[4] ? cols[4].trim() : '';
        const color = cols[5] ? cols[5].trim() : '';
        const width = cols[6] ? cols[6].trim() : '';
        const unitOfItem = cols[7] ? cols[7].trim() : '';
        const qty = cols[8] ? (parseFloat(cols[8].replace(/,/g, '')) || 0) : 0;
        const rate = cols[9] ? (parseFloat(cols[9].replace(/,/g, '')) || 0) : 0;
        const discount = cols[10] ? (parseFloat(cols[10].replace(/,/g, '')) || 0) : 0;
        const deliveryDate = cols[11] ? cols[11].trim() : '';
        const remark = cols[12] ? cols[12].trim() : '';
        const phone = cols[13] ? cols[13].trim() : '';
        const billing = cols[14] ? cols[14].trim() : '';
        const delivery = cols[15] ? cols[15].trim() : '';
        const sales = cols[16] ? cols[16].trim() : '';
        const salesContact = cols[17] ? cols[17].trim() : '';
        const orderNo = cols[18] ? cols[18].trim() : '';
        const customerMailId = cols[19] ? cols[19].trim() : '';
        const rawDispatch = cols[20] !== undefined ? cols[20].trim() : '';
        const dispatchQty = rawDispatch ? (parseFloat(rawDispatch.replace(/,/g, '')) || 0) : 0;
        const balanceQty = cols[21] ? (parseFloat(cols[21].replace(/,/g, '')) || Math.max(0, qty - dispatchQty)) : Math.max(0, qty - dispatchQty);
        const statusVal = cols[22] ? cols[22].trim() : '';
        const approvalVal = cols[24] ? cols[24].trim() : 'APPROVED';
        const transporterVal = cols[36] ? cols[36].trim() : '';
        const rawOpenClose = (cols[38] || '').trim();
        const openCloseVal = rawOpenClose.toLowerCase();
        let statusAN: 'Open' | 'In-Progress' | 'Complete' | 'Closed' = 'Open';
        if (isItemComplete(openCloseVal) || isItemComplete(statusVal)) {
          statusAN = 'Complete';
        } else if (openCloseVal.includes('prog') || statusVal.toLowerCase().includes('prog')) {
          statusAN = 'In-Progress';
        } else {
          // In Google Sheet: Blank means open, Complete means closed
          statusAN = 'Open';
        }

        const orderKey = [
          '',
          custName,
          customerMailId,
          phone,
          date
        ].map(v => (v || '').trim()).join('_');

        if (cols[22]) importedColW[orderKey] = cols[22].trim();
        if (cols[23]) importedColX[orderKey] = cols[23].trim();
        if (cols[28]) importedColAC[orderKey] = cols[28].trim();
        if (cols[30]) {
          const val30 = cols[30].trim().toLowerCase();
          importedColAE[orderKey] = ['yes', 'true', '✓', 'checked', '1'].includes(val30);
        }
        if (cols[31]) importedColAF[orderKey] = cols[31].trim();
        if (cols[32]) importedColAG[orderKey] = cols[32].trim();
        if (cols[33]) {
          const val33 = cols[33].trim().toLowerCase();
          importedColAH[orderKey] = ['yes', 'true', '✓', 'checked', '1'].includes(val33);
        }
        if (cols[34]) importedColAI[orderKey] = cols[34].trim();
        if (cols[35]) importedColAJ[orderKey] = cols[35].trim();
        if (cols[37]) importedColAL[orderKey] = cols[37].trim();
        if (cols[39]) importedColAN[orderKey] = cols[39].trim();

        const itemKey = `${orderKey}___${itemName.trim()}___${color.trim()}___${width.trim()}`;
        if (rawDispatch !== '') {
          importedDispatch[itemKey] = dispatchQty;
        }

        newItems.push({
          orderId: `ORD-IMP-${index + 1}-${Date.now().toString(36)}`,
          timestamp: timestamp || new Date().toLocaleString('en-IN'),
          customerName: custName,
          orderDate: date,
          unit: unit,
          itemName: itemName,
          color: color,
          width: width,
          unitOfItem: unitOfItem,
          qty: qty,
          rate: rate,
          discount: discount,
          deliveryDate: deliveryDate,
          remark: remark,
          customerNumber: phone,
          billingAddress: billing,
          deliveryAddress: delivery,
          salesPerson: sales,
          salesPersonContact: salesContact,
          orderNo: orderNo,
          customerEmail: customerMailId,
          customerMailId: customerMailId,
          transporterName: transporterVal,
          approvalStatus: approvalVal,
          orderNoTimestamp: orderNo ? (cols[25] || new Date().toLocaleString('en-IN')) : '',
          statusAN: statusAN,
          dispatchQty: dispatchQty,
          balanceQty: Math.max(0, balanceQty)
        });
      } else {
        // Fallback layout
        const po = cols[1] || currentPO;
        const custName = cols[2] || cols[1] || currentName;
        const email = cols[3] || currentEmail;
        const date = cols[4] || cols[2] || currentDate;
        const unit = cols[5] || 'WARP(UDHANA)';
        const itemName = cols[6] || cols[4] || `Imported Item ${index}`;
        const color = cols[7] || cols[5] || 'White';
        const width = cols[8] || cols[6] || '56"';
        const unitOfItem = cols[9] || cols[7] || 'MTR';
        const qty = cols[10] ? (parseFloat(cols[10].replace(/,/g, '')) || 0) : (cols[8] ? parseFloat(cols[8].replace(/,/g, '')) || 0 : 0);
        const rate = cols[11] ? (parseFloat(cols[11].replace(/,/g, '')) || 0) : (cols[9] ? parseFloat(cols[9].replace(/,/g, '')) || 0 : 0);
        const discount = cols[12] ? (parseFloat(cols[12].replace(/,/g, '')) || 0) : 0;
        const deliveryDate = cols[13] || cols[11] || '';
        const remark = cols[14] || cols[12] || currentRemark;
        const phone = cols[15] || cols[13] || '';
        const billing = cols[16] || cols[14] || currentBilling;
        const delivery = cols[17] || cols[15] || currentDelivery;
        const transporter = cols[18] || currentTransporter;
        const sales = cols[19] || cols[16] || currentSalesPerson;
        const orderNo = cols[23] || cols[18] || currentOrderNo;
        const dispatchQty = cols[24] ? (parseFloat(cols[24].replace(/,/g, '')) || 0) : 0;

        newItems.push({
          orderId: `IMP-${Date.now()}-${index}`,
          referenceNo: cols[0] || '',
          timestamp: cols[0] || new Date().toLocaleString('en-IN'),
          customerPO: po,
          customerName: custName,
          customerEmail: email,
          orderDate: date,
          unit: unit,
          itemName: itemName,
          color: color,
          width: width,
          unitOfItem: unitOfItem,
          qty: qty,
          rate: rate,
          discount: discount,
          deliveryDate: deliveryDate,
          remark: remark,
          customerNumber: phone,
          billingAddress: billing,
          deliveryAddress: delivery,
          transporterName: transporter,
          salesPerson: sales,
          orderNo: orderNo,
          orderNoTimestamp: new Date().toLocaleString('en-IN'),
          statusAN: 'Open',
          dispatchQty: dispatchQty,
          balanceQty: Math.max(0, qty - dispatchQty)
        });
      }
    });

    if (newItems.length > 0) {
      if (Object.keys(importedColW).length > 0) setColWStatuses(prev => ({ ...prev, ...importedColW }));
      if (Object.keys(importedColX).length > 0) setColXRemarks(prev => ({ ...prev, ...importedColX }));
      if (Object.keys(importedColAC).length > 0) setAcStatuses(prev => ({ ...prev, ...importedColAC }));
      if (Object.keys(importedColAE).length > 0) setColAEChecks(prev => ({ ...prev, ...importedColAE }));
      if (Object.keys(importedColAF).length > 0) setColAFTimestamps(prev => ({ ...prev, ...importedColAF }));
      if (Object.keys(importedColAG).length > 0) setColAGRemarks(prev => ({ ...prev, ...importedColAG }));
      if (Object.keys(importedColAH).length > 0) setColAHChecks(prev => ({ ...prev, ...importedColAH }));
      if (Object.keys(importedColAI).length > 0) setColAITimestamps(prev => ({ ...prev, ...importedColAI }));
      if (Object.keys(importedColAJ).length > 0) setColAJRemarks(prev => ({ ...prev, ...importedColAJ }));
      if (Object.keys(importedColAL).length > 0) setLrNumbers(prev => ({ ...prev, ...importedColAL }));
      if (Object.keys(importedColAN).length > 0) setAnStatuses(prev => ({ ...prev, ...importedColAN }));
      if (Object.keys(importedDispatch).length > 0) setDispatchRecords(prev => ({ ...prev, ...importedDispatch }));

      if (importReplaceMode) {
        setRawResponses(newItems);
      } else {
        setRawResponses(prev => [...newItems, ...prev]);
      }
      setShowImportModal(false);
      setPastedDataText('');
      setImportError(null);
      setImportError(null);

      // Auto-Sync to Firebase if enabled
      if (syncFirebase && firebaseUrl) {
        setSyncFeedback(`Imported ${newItems.length} rows! Pushing to Firebase Cloud Database...`);
        try {
          const syncRes = await pushOrdersToFirebase(newItems);
          setSyncFeedback(
            `✓ Successfully imported ${newItems.length} rows from "${sourceLabel}" & saved ${syncRes.activeOrders + syncRes.closedOrders} orders to Firebase!`
          );
        } catch (fbErr: any) {
          console.warn('Firebase sync warning:', fbErr);
          setSyncFeedback(
            `✓ Imported ${newItems.length} rows into application! (Firebase note: ${fbErr.message || 'Check URL/Secret'})`
          );
        }
      } else {
        setSyncFeedback(`✓ Successfully imported ${newItems.length} rows from "${sourceLabel}" into application!`);
      }

      setTimeout(() => setSyncFeedback(null), 5000);
    } else {
      setImportError('Koi valid data row import nahi ho saki. Kripya column structure verify karein.');
    }
  };

  // Google Sheet Direct Fetch and Import Handler
  const handleFetchFromGoogleSheet = async () => {
    const cleanId = extractSheetId(importSheetId);
    if (!cleanId) {
      setImportError('Kripya valid Google Sheet ID ya full Google Sheets URL enter karein.');
      return;
    }
    if (!importTabName.trim()) {
      setImportError('Kripya Tab / Sheet ka naam enter karein (e.g. Product Automation, Product Order).');
      return;
    }

    setIsFetchingSheet(true);
    setImportError(null);

    try {
      const tabLower = importTabName.trim().toLowerCase();
      const res = await fetchLiveGoogleQueryData(cleanId, importTabName.trim());
      if (res.rows && res.rows.length > 0 && res.source === 'live') {
        if (tabLower.includes('product order')) {
          setRawResponses(importReplaceMode ? res.rows : prev => [...res.rows, ...prev]);
          await saveOrdersToStorage(res.rows);
        } else {
          setAutomationRows(importReplaceMode ? res.rows : prev => [...res.rows, ...prev]);
          await saveAutomationOrdersToStorage(res.rows);
          hydrateFromAutomationRows(res.rows, true);
        }
        setLastSyncedAt(res.fetchedAt);
        setLiveSyncSource('live');
        setShowImportModal(false);
        setImportError(null);
        setSyncFeedback(`✓ Live Google Sheet "${importTabName.trim()}" se ${res.rows.length.toLocaleString()} rows import aur save ho gayi!`);
        setTimeout(() => setSyncFeedback(null), 5000);
        return;
      }

      // Direct gviz fallback for third-party spreadsheets without known gid
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(importTabName.trim())}`;
      const resp = await fetch(gvizUrl);
      if (!resp.ok) {
        throw new Error(`Google Sheets responded with HTTP status ${resp.status}`);
      }
      const csvText = await resp.text();
      if (!csvText || csvText.trim().length === 0) {
        throw new Error(`Tab "${importTabName}" me koi data nahi mila ya tab exist nahi karta.`);
      }
      if (csvText.startsWith('<!DOCTYPE html>') || csvText.includes('<html')) {
        throw new Error('Google Sheet private hai ya access restricted hai. Sheet ko Share > "Anyone with the link can view" karein, ya "Paste (Ctrl+V)" tab use karein.');
      }

      await handleParseImportedData(csvText, autoSyncToFirebase, `Google Sheet Tab: ${importTabName.trim()}`);
    } catch (err: any) {
      console.error('Google Sheet Import Error:', err);
      setImportError(
        err.message || 'Google Sheet se data fetch karne me error aayi. Kripya check karein ki Sheet me Share -> "Anyone with the link can view" active hai.'
      );
    } finally {
      setIsFetchingSheet(false);
    }
  };

  // 1-Click Upload all current Sheet Data to Firebase Realtime Database
  const handleUploadToFirebase = async () => {
    try {
      setUploadProgress(20);
      setSyncFeedback('Connecting to Firebase Realtime Database...');

      // Save current config in localStorage
      localStorage.setItem(
        LOCAL_STORAGE_FIREBASE_CONFIG,
        JSON.stringify({
          url: firebaseUrl,
          secret: firebaseSecret
        })
      );

      setUploadProgress(50);
      const res = await pushOrdersToFirebase(rawResponses);
      setUploadProgress(100);
      setSyncFeedback(
        `✓ Successfully uploaded all ${res.activeOrders + res.closedOrders} orders (${res.totalRows} rows) to Firebase Realtime Database!`
      );
      setTimeout(() => {
        setShowFirebaseModal(false);
        setUploadProgress(null);
        setSyncFeedback(null);
      }, 3500);
    } catch (err: any) {
      console.error('Firebase Upload Error:', err);
      setUploadProgress(null);
      setSyncFeedback(`Firebase Upload Error: ${err.message || 'Check URL & Secret'}`);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  // Filter orders based on activeSheetTab & statusFilter & search & column filters
  // When an order has multiple items, closed items show in "Closed Orders" and active items in "Product Automation"!
  const filteredOrders = useMemo(() => {
    const result: GroupedOrder[] = [];

    groupedOrders.forEach(order => {
      // When falling back to Product Order rows (no Product Automation rows loaded), require Order No
      if (automationRows.length === 0 && (activeSheetTab === 'automation' || activeSheetTab === 'closed')) {
        if (!order.orderNo || order.orderNo.trim() === '') {
          return;
        }
      }

      // User rule: "AM me jinka status complete he wo full row wali order Closed he to usko autoamatic closed order sheet me dal dena . complete hoga means full records closed he."
      const isOrderComplete = isItemComplete(order.statusAN) || order.items.some(it => isItemComplete(it.statusAN));

      // 1. Tab filter — STRICT REQUIREMENT:
      // - "Product Automation" tab shows ONLY Open / In-Progress orders (Col AM !== Complete)
      // - "Closed Orders" tab shows ONLY records where Col AM status is Complete
      if (activeSheetTab === 'automation') {
        if (isOrderComplete) return; // Strictly hide Col AM Complete records from Product Automation
      } else if (activeSheetTab === 'closed') {
        if (!isOrderComplete) return; // Strictly show ONLY Col AM Complete records in Closed Orders
      }

      // 2. Toolbar Status dropdown filter (strictly scoped to Product Automation tab)
      if (activeSheetTab === 'automation' && statusFilter !== 'ALL') {
        if (statusFilter === 'Closed' || statusFilter === 'Complete') {
          if (!isOrderComplete) return;
        } else if (statusFilter === 'Open') {
          if (isOrderComplete || order.statusAN === 'In-Progress') return;
        } else if (statusFilter === 'In-Progress') {
          if (order.statusAN !== 'In-Progress') return;
        }
      }

      // Filter items according to column filters (D to L, U, V, AM)
      const relevantItems = order.items.filter(item => {
        const itemStatus = isItemComplete(item.statusAN) ? 'Complete' : (item.statusAN || 'Open');

        if (colFilters['D'] && colFilters['D'].length > 0 && !colFilters['D'].includes(item.unit || '')) return false;
        if (colFilters['E'] && colFilters['E'].length > 0 && !colFilters['E'].includes(item.itemName || '')) return false;
        if (colFilters['F'] && colFilters['F'].length > 0 && !colFilters['F'].includes(item.color || '')) return false;
        if (colFilters['G'] && colFilters['G'].length > 0 && !colFilters['G'].includes(item.width || '')) return false;
        if (colFilters['H'] && colFilters['H'].length > 0 && !colFilters['H'].includes(item.unitOfItem || '')) return false;
        if (colFilters['I'] && colFilters['I'].length > 0 && !colFilters['I'].includes(String(item.qty || ''))) return false;
        if (colFilters['J'] && colFilters['J'].length > 0 && !colFilters['J'].includes(String(item.rate || ''))) return false;
        if (colFilters['K'] && colFilters['K'].length > 0 && !colFilters['K'].includes(String(item.discount || ''))) return false;
        if (colFilters['L'] && colFilters['L'].length > 0 && !colFilters['L'].includes(item.deliveryDate || '')) return false;
        if (colFilters['U'] && colFilters['U'].length > 0 && !colFilters['U'].includes(String(item.dispatchQty ?? 0))) return false;
        if (colFilters['V'] && colFilters['V'].length > 0 && !colFilters['V'].includes(String(item.balanceQty ?? ''))) return false;
        if (colFilters['AM'] && colFilters['AM'].length > 0 && !colFilters['AM'].includes(itemStatus)) return false;

        return true;
      });

      // If no items in this order match the current tab/filter, skip this order
      if (relevantItems.length === 0) return;

      // Header-level Column Filters (A, B, C, M to T, W to AQ)
      for (const [colKey, selectedVals] of Object.entries(colFilters)) {
        if (!selectedVals || selectedVals.length === 0) continue;
        if (colKey === 'A' && !selectedVals.includes(order.timestamp || '')) return;
        if (colKey === 'B' && !selectedVals.includes(order.customerName || '')) return;
        if (colKey === 'C' && !selectedVals.includes(order.orderDate || '')) return;
        if (colKey === 'M' && !selectedVals.includes(order.remark || '')) return;
        if (colKey === 'N' && !selectedVals.includes(order.customerNumber || '')) return;
        if (colKey === 'O' && !selectedVals.includes(order.billingAddress || '')) return;
        if (colKey === 'P' && !selectedVals.includes(order.deliveryAddress || '')) return;
        if (colKey === 'Q' && !selectedVals.includes(order.salesPerson || '')) return;
        if (colKey === 'R' && !selectedVals.includes(order.salesPersonContact || '')) return;
        if (colKey === 'S' && !selectedVals.includes(order.orderNo || 'Set SO#')) return;
        if (colKey === 'T' && !selectedVals.includes(order.customerMailId || order.customerEmail || '')) return;
        if (colKey === 'W' && !selectedVals.includes(colWStatuses[order.orderKey] ?? (order.accountStatus || 'In Production'))) return;
        if (colKey === 'X' && !selectedVals.includes(colXRemarks[order.orderKey] ?? '')) return;
        if (colKey === 'Y' && !selectedVals.includes(order.approvalStatus || 'APPROVED')) return;
        if (colKey === 'AC' && !selectedVals.includes(acStatuses[order.orderKey] || 'Pending')) return;
        if (colKey === 'AE' && !selectedVals.includes(colAEChecks[order.orderKey] ? 'Checked' : 'Unchecked')) return;
        if (colKey === 'AF' && !selectedVals.includes(colAFTimestamps[order.orderKey] || '—')) return;
        if (colKey === 'AG' && !selectedVals.includes(colAGRemarks[order.orderKey] || '')) return;
        if (colKey === 'AH' && !selectedVals.includes(colAHChecks[order.orderKey] ? 'Checked' : 'Unchecked')) return;
        if (colKey === 'AI' && !selectedVals.includes(colAITimestamps[order.orderKey] || '—')) return;
        if (colKey === 'AJ' && !selectedVals.includes(colAJRemarks[order.orderKey] || '')) return;
        if (colKey === 'AK' && !selectedVals.includes(order.transporterName || 'Atc express')) return;
        if (colKey === 'AL' && !selectedVals.includes(lrNumbers[order.orderKey] || '')) return;
        if (colKey === 'AN' && !selectedVals.includes(anStatuses[order.orderKey] || 'Pending')) return;
        if (colKey === 'AP' && !selectedVals.includes(order.customerMailId || order.customerEmail || '')) return;
      }

      // Search filter (Customer Name / Order Number basis)
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchesName = (order.customerName || '').toLowerCase().includes(q);
        const matchesOrderNo = (order.orderNo || '').toLowerCase().includes(q);

        if (searchMode === 'customer') {
          if (!matchesName) return;
        } else if (searchMode === 'order_no') {
          if (!matchesOrderNo) return;
        } else if (searchMode === 'customer_or_order') {
          if (!matchesName && !matchesOrderNo) return;
        } else {
          const matchesPO = (order.customerPO || '').toLowerCase().includes(q);
          const matchesSales = (order.salesPerson || '').toLowerCase().includes(q);
          const matchesTransporter = (order.transporterName || '').toLowerCase().includes(q);
          const matchesAnyItem = relevantItems.some(
            it => (it.itemName || '').toLowerCase().includes(q) || (it.color || '').toLowerCase().includes(q)
          );
          if (!matchesPO && !matchesName && !matchesOrderNo && !matchesSales && !matchesTransporter && !matchesAnyItem) {
            return;
          }
        }
      }

      result.push({
        ...order,
        items: relevantItems
      });
    });

    // Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (sortConfig.column === 'B') {
          valA = a.customerPO;
          valB = b.customerPO;
        } else if (sortConfig.column === 'C') {
          valA = a.customerName;
          valB = b.customerName;
        } else if (sortConfig.column === 'K') {
          valA = a.items.reduce((s, it) => s + it.qty, 0);
          valB = b.items.reduce((s, it) => s + it.qty, 0);
        } else {
          valA = a.customerPO;
          valB = b.customerPO;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [groupedOrders, activeSheetTab, statusFilter, searchTerm, searchMode, colFilters, sortConfig, acStatuses, anStatuses, colWStatuses, colXRemarks, colAEChecks, colAFTimestamps, colAGRemarks, colAHChecks, colAITimestamps, colAJRemarks, lrNumbers]);

  // Virtual Pagination for Product Automation & Closed Orders to prevent browser crash/freeze
  const [automationPage, setAutomationPage] = useState(1);
  const [automationPageSize, setAutomationPageSize] = useState<number>(25);

  const totalAutomationPages = Math.max(1, Math.ceil(filteredOrders.length / (automationPageSize || 25)));
  const safeAutomationPage = Math.min(automationPage, totalAutomationPages);

  const paginatedOrders = useMemo(() => {
    if (automationPageSize === 0) return filteredOrders;
    const start = (safeAutomationPage - 1) * automationPageSize;
    return filteredOrders.slice(start, start + automationPageSize);
  }, [filteredOrders, safeAutomationPage, automationPageSize]);

  const startRowNumber = useMemo(() => {
    if (automationPageSize === 0 || safeAutomationPage <= 1) return 2;
    let count = 2;
    const prev = filteredOrders.slice(0, (safeAutomationPage - 1) * automationPageSize);
    prev.forEach(o => { count += o.items.length; });
    return count;
  }, [filteredOrders, safeAutomationPage, automationPageSize]);

  useEffect(() => {
    if (activeSheetTab !== 'automation' && activeSheetTab !== 'closed') return;
    const el = tableScrollRef.current;
    if (!el) return;

    const updateWidth = () => {
      if (el.scrollWidth > 0) {
        setTableScrollWidth(el.scrollWidth);
      }
      if (topScrollRef.current) {
        topScrollRef.current.scrollLeft = el.scrollLeft;
      }
    };

    updateWidth();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateWidth) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', updateWidth);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [activeSheetTab, visibleCols, viewMode, isFullWidth, statusFilter, automationPage, automationPageSize]);

  // Aggregate metrics
  const totalOrdersCount = groupedOrders.length;
  const closedOrdersCount = groupedOrders.filter(o => isItemComplete(o.statusAN) || o.items.some(it => isItemComplete(it.statusAN))).length;
  const activeOrdersCount = groupedOrders.filter(o => !(isItemComplete(o.statusAN) || o.items.some(it => isItemComplete(it.statusAN)))).length;

  // Toggle filter value for a column
  const toggleColFilterValue = (col: string, val: string) => {
    setColFilters(prev => {
      const current = prev[col] || [];
      if (current.includes(val)) {
        const next = current.filter(v => v !== val);
        if (next.length === 0) {
          const copy = { ...prev };
          delete copy[col];
          return copy;
        }
        return { ...prev, [col]: next };
      } else {
        return { ...prev, [col]: [...current, val] };
      }
    });
  };

  // Get unique values for ANY column in the ACTIVE tab to show in filter dropdown
  const getUniqueColumnValues = (col: string): string[] => {
    const set = new Set<string>();
    groupedOrders.forEach(o => {
      const isOrderComplete = isItemComplete(o.statusAN) || o.items.some(it => isItemComplete(it.statusAN));
      if (activeSheetTab === 'automation' && isOrderComplete) return;
      if (activeSheetTab === 'closed' && !isOrderComplete) return;
      if (col === 'A') set.add(o.timestamp || '');
      else if (col === 'B') set.add(o.customerName || '');
      else if (col === 'C') set.add(o.orderDate || '');
      else if (col === 'D') o.items.forEach(it => set.add(it.unit || ''));
      else if (col === 'E') o.items.forEach(it => set.add(it.itemName || ''));
      else if (col === 'F') o.items.forEach(it => set.add(it.color || ''));
      else if (col === 'G') o.items.forEach(it => set.add(it.width || ''));
      else if (col === 'H') o.items.forEach(it => set.add(it.unitOfItem || ''));
      else if (col === 'I') o.items.forEach(it => set.add(String(it.qty || '')));
      else if (col === 'J') o.items.forEach(it => set.add(String(it.rate || '')));
      else if (col === 'K') o.items.forEach(it => set.add(String(it.discount || '')));
      else if (col === 'L') o.items.forEach(it => set.add(it.deliveryDate || ''));
      else if (col === 'M') set.add(o.remark || '');
      else if (col === 'N') set.add(o.customerNumber || '');
      else if (col === 'O') set.add(o.billingAddress || '');
      else if (col === 'P') set.add(o.deliveryAddress || '');
      else if (col === 'Q') set.add(o.salesPerson || '');
      else if (col === 'R') set.add(o.salesPersonContact || '');
      else if (col === 'S') set.add(o.orderNo || 'Set SO#');
      else if (col === 'T') set.add(o.customerMailId || o.customerEmail || '');
      else if (col === 'U') o.items.forEach(it => set.add(String(it.dispatchQty ?? 0)));
      else if (col === 'V') o.items.forEach(it => set.add(String(it.balanceQty ?? '')));
      else if (col === 'W') set.add(colWStatuses[o.orderKey] ?? (o.accountStatus || 'In Production'));
      else if (col === 'X') set.add(colXRemarks[o.orderKey] ?? '');
      else if (col === 'Y') set.add(o.approvalStatus || 'APPROVED');
      else if (col === 'Z') set.add(o.orderNoTimestamp || o.timestamp || '');
      else if (col === 'AA') set.add('Sent');
      else if (col === 'AB') set.add('Delivered');
      else if (col === 'AC') set.add(acStatuses[o.orderKey] || 'Pending');
      else if (col === 'AE') set.add(colAEChecks[o.orderKey] ? 'Checked' : 'Unchecked');
      else if (col === 'AF') set.add(colAFTimestamps[o.orderKey] || '—');
      else if (col === 'AG') set.add(colAGRemarks[o.orderKey] || '');
      else if (col === 'AH') set.add(colAHChecks[o.orderKey] ? 'Checked' : 'Unchecked');
      else if (col === 'AI') set.add(colAITimestamps[o.orderKey] || '—');
      else if (col === 'AJ') set.add(colAJRemarks[o.orderKey] || '');
      else if (col === 'AK') set.add(o.transporterName || 'Atc express');
      else if (col === 'AL') set.add(lrNumbers[o.orderKey] || '');
      else if (col === 'AM') o.items.forEach(it => set.add(isItemComplete(it.statusAN) ? 'Complete' : (it.statusAN || 'Open')));
      else if (col === 'AN') set.add(anStatuses[o.orderKey] || 'Pending');
      else if (col === 'AP') set.add(o.customerMailId || o.customerEmail || '');
    });
    return Array.from(set).filter(v => v !== undefined && v !== null && String(v).trim() !== '').slice(0, 50);
  };

  return (
    <div className="space-y-3">
      {/* CONSTANT STICKY TOP SHEET TABS & CENTRALIZED SYNC BAR */}
      <div className="sticky top-11 z-30 bg-slate-100/95 backdrop-blur-xs border border-slate-300 rounded-xl shadow-xs px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 select-none">
        {/* Top Constant Sheet Tab Names */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tab 1: Product Order */}
          <button
            type="button"
            onClick={() => {
              setActiveSheetTab('product_order');
              setActiveFilterCol(null);
              setShowColManager(false);
              setColSearchQuery('');
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer border ${
              activeSheetTab === 'product_order'
                ? 'bg-blue-700 text-white border-blue-800 shadow-sm'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${activeSheetTab === 'product_order' ? 'text-blue-200' : 'text-blue-600'}`} />
            <span>Product Order</span>
          </button>

          {/* Tab 2: Product Automation (Strictly Open Only) */}
          <button
            type="button"
            onClick={() => {
              setActiveSheetTab('automation');
              setActiveFilterCol(null);
              setShowColManager(false);
              setColSearchQuery('');
              setAutomationPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer border ${
              activeSheetTab === 'automation'
                ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Layers className={`w-3.5 h-3.5 ${activeSheetTab === 'automation' ? 'text-emerald-200' : 'text-emerald-600'}`} />
            <span>Product Automation</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              activeSheetTab === 'automation' ? 'bg-emerald-900 text-emerald-100' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {activeOrdersCount} Open
            </span>
          </button>

          {/* Tab 3: Closed Orders (Strictly Col AM Complete Only) */}
          <button
            type="button"
            onClick={() => {
              setActiveSheetTab('closed');
              setActiveFilterCol(null);
              setShowColManager(false);
              setColSearchQuery('');
              setAutomationPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer border ${
              activeSheetTab === 'closed'
                ? 'bg-indigo-700 text-white border-indigo-800 shadow-sm'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Archive className={`w-3.5 h-3.5 ${activeSheetTab === 'closed' ? 'text-indigo-200' : 'text-indigo-600'}`} />
            <span>Closed Orders</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              activeSheetTab === 'closed' ? 'bg-indigo-900 text-indigo-100' : 'bg-indigo-100 text-indigo-800'
            }`}>
              {closedOrdersCount.toLocaleString()}
            </span>
          </button>
        </div>

        {/* Right Side: Live Centralization Sync Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-slate-300 text-[11px] text-slate-700">
            <span className={`w-2 h-2 rounded-full ${liveSyncSource === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <span className="font-semibold">
              {liveSyncSource === 'live' ? 'Live Sheet Connected' : 'Local Cache'}
            </span>
            {lastSyncedAt && (
              <span className="font-mono text-[10px] text-slate-500">({lastSyncedAt})</span>
            )}
          </div>

          <button
            type="button"
            disabled={isFetchingQueryLive}
            onClick={() => handleSyncBothLiveSheets(false)}
            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Fetch both Product Order & Product Automation live from Google Sheet"
          >
            {isFetchingQueryLive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{isFetchingQueryLive ? 'Syncing...' : 'Sync Live Sheet'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTwoWaySyncModal(true)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              webAppUrl
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
            }`}
            title="Enable 2-Way Centralization (Write Order No, Dispatch Qty & Col AM directly back to Google Sheet)"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>{webAppUrl ? '2-Way Sheet Write ON ✓' : '2-Way Sheet Setup'}</span>
          </button>
        </div>
      </div>

      {/* SPREADSHEET TOOLBAR & CONTROLS */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
        {/* Top Control Bar - ALL IN ONE SINGLE LINE WITH VISIBLE HORIZONTAL SCROLL */}
        <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto select-none fms-sheet-scroll whitespace-nowrap">
          {/* Left Controls Group in Single Line */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search Box with Customer Name / Order Number Basis Selector (All Tabs) */}
            <div className="flex items-center bg-white border border-slate-300 rounded-md focus-within:ring-1 focus-within:ring-emerald-500 overflow-hidden shrink-0">
              <select
                value={searchMode}
                onChange={(e) => {
                  setSearchMode(e.target.value as SearchBasisMode);
                  setAutomationPage(1);
                }}
                className="bg-slate-100 border-r border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-800 focus:outline-none cursor-pointer"
                title="Choose Search Basis for this tab"
              >
                <option value="customer_or_order">Customer / Order No</option>
                <option value="customer">Customer Name</option>
                <option value="order_no">Order Number</option>
                <option value="all">All Columns</option>
              </select>
              <div className="relative w-44 sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={
                    searchMode === 'customer'
                      ? 'Search Customer Name...'
                      : searchMode === 'order_no'
                        ? 'Search Order Number...'
                        : searchMode === 'customer_or_order'
                          ? 'Search Customer / Order No...'
                          : 'Search Customer, Order No, Item...'
                  }
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setAutomationPage(1);
                  }}
                  className="w-full pl-7 pr-6 py-1 text-xs bg-transparent focus:outline-none text-slate-800 placeholder-slate-400"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setAutomationPage(1);
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Status Filter (Contextual for Automation / Closed) */}
            {activeSheetTab === 'automation' && (
              <div className="flex items-center gap-1 text-xs shrink-0">
                <span className="text-slate-500 font-medium text-[11px] flex items-center gap-0.5">
                  <Filter className="w-3 h-3" />
                  Open Filter:
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">All Open Orders ({activeOrdersCount})</option>
                  <option value="Open">🔵 Open Only ({groupedOrders.filter(o => !isItemComplete(o.statusAN) && o.statusAN !== 'In-Progress').length})</option>
                  <option value="In-Progress">🟡 In-Progress Only ({groupedOrders.filter(o => o.statusAN === 'In-Progress').length})</option>
                </select>
              </div>
            )}

            {activeSheetTab === 'closed' && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold shrink-0">
                <Archive className="w-3.5 h-3.5 text-indigo-600" />
                <span>Showing Col AM = &quot;Complete&quot; Only ({closedOrdersCount} Records)</span>
              </div>
            )}

            {/* ONLY Order Status Badge */}
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-sky-50 border border-sky-200 text-sky-950 text-xs shadow-2xs shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
              <span className="text-[11px] font-bold text-sky-800">Order Status :</span>
              <span className="font-mono font-bold text-xs">{activeOrdersCount} Open / {closedOrdersCount} Complete</span>
            </div>

            {/* Clear active filters button */}
            {Object.keys(colFilters).length > 0 && (
              <button
                onClick={() => setColFilters({})}
                className="px-1.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 flex items-center gap-1 shrink-0"
              >
                <X className="w-3 h-3" />
                <span>Reset ({Object.keys(colFilters).length})</span>
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-slate-300 shrink-0 mx-0.5" />

          {/* Right Controls Group in Single Line */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* View Mode Switch (Applicable for Automation & Closed Orders) */}
            {(activeSheetTab === 'automation' || activeSheetTab === 'closed') && (
              <div className="flex items-center p-0.5 bg-slate-200/80 rounded-lg text-xs shrink-0">
                <button
                  onClick={() => setViewMode('merged')}
                  className={`px-2 py-1 rounded-md transition-all font-semibold ${
                    viewMode === 'merged'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="A-E & N-X Vertically Merged with Individual Product Item Rows"
                >
                  ⚡ Merged Visual View
                </button>
                <button
                  onClick={() => setViewMode('unmerged')}
                  className={`px-2 py-1 rounded-md transition-all font-medium ${
                    viewMode === 'unmerged'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="100% Flat Row-Wise View (Independent Row Data)"
                >
                  Flat Unmerged
                </button>
              </div>
            )}

            {/* Columns Hide / Show Button (Per Active Tab) */}
            <button
              onClick={() => setShowColManager(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
              title="Hide / Show Specific Columns in the Active Tab"
            >
              <Columns className="w-3 h-3 text-emerald-700" />
              <span>
                {activeSheetTab === 'product_order'
                  ? `Columns (${productOrderColumns.filter(c => visibleCols[c.colLetter] !== false).length}/${productOrderColumns.length})`
                  : `Columns (${fmsColumnMapping.filter(c => visibleCols[c.sheetCol]).length}/${fmsColumnMapping.length})`}
              </span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded border border-slate-300 shrink-0"
              title="Export CSV / Excel"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Firebase Cloud Sync Button */}
            <button
              onClick={() => setShowFirebaseModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-2xs transition-colors shrink-0"
              title="Upload historical data to Firebase"
            >
              <Flame className="w-3 h-3 fill-white" />
              <span>Firebase</span>
            </button>

            {/* Reset data */}
            <button
              onClick={handleReset}
              className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded shrink-0"
              title="Reset to default sample data"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* FULL SIZE ON BUTTON IN THE FAR RIGHT CORNER */}
            {setIsFullWidth && (
              <button
                onClick={() => setIsFullWidth(!isFullWidth)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all shadow-xs shrink-0 ${
                  isFullWidth
                    ? 'bg-emerald-700 text-white border-emerald-800 hover:bg-emerald-800'
                    : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                }`}
                title={isFullWidth ? "Click for Boxed View" : "Click for Full Screen View"}
              >
                {isFullWidth ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                <span>{isFullWidth ? 'Full Size ON' : 'Full Size OFF'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Sync feedback notification */}
        {syncFeedback && (
          <div className={`p-2.5 border-b flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in duration-150 ${
            syncFeedbackTone === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : syncFeedbackTone === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <div className="flex items-center gap-2">
              {syncFeedbackTone === 'success'
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                : <AlertTriangle className={`w-4 h-4 shrink-0 ${syncFeedbackTone === 'error' ? 'text-rose-600' : 'text-amber-600'}`} />}
              <span className="font-medium">{syncFeedback}</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {(syncFeedbackTone === 'warning' || syncFeedbackTone === 'error') && (
                <button
                  type="button"
                  onClick={() => setShowTwoWaySyncModal(true)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-md text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Link2 className="w-3 h-3" />
                  <span>Setup 2-Way Sheet Write</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSyncFeedback(null);
                  setSyncFeedbackTone('success');
                }}
                className="p-0.5 opacity-60 hover:opacity-100 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TOP HORIZONTAL SCROLLBAR BELOW UPPER MENU TOOLS (Product Automation & Closed Orders) */}
        {(activeSheetTab === 'automation' || activeSheetTab === 'closed') && (
          <div
            ref={topScrollRef}
            onScroll={handleTopScroll}
            className="overflow-x-auto overflow-y-hidden bg-slate-100 border-b border-slate-300 fms-sheet-scroll"
            title="Horizontal Scroll (Columns A–AQ)"
          >
            <div style={{ width: `${tableScrollWidth}px`, height: '2px' }} />
          </div>
        )}

        {/* THE MAIN SPREADSHEET TABLE GRID CONTAINER (Vertical & Horizontal Scroll Box with Freeze Panes) */}
        {activeSheetTab === 'product_order' ? (
          <ProductOrderView
            orders={rawResponses}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            searchMode={searchModesByTab.product_order}
            visibleCols={visibleColsByTab.product_order}
            isFullWidth={isFullWidth}
            onGenerateOrderNo={handleGenerateOrderNo}
            onGenerateAllPending={handleGenerateAllPendingOrderNo}
            onDeleteRow={handleDeleteItem}
            onClearAllRows={handleClearAllProductOrders}
            onOpenImportModal={() => {
              setImportTabName('Product Order');
              setShowImportModal(true);
            }}
            onUpdateRow={handleUpdateProductOrderRow}
            onNavigateToAutomation={() => setActiveSheetTab('automation')}
            onAddNewRow={handleAddNewProductOrderRow}
            onFetchQueryLive={() => handleSyncBothLiveSheets(false)}
            isFetchingLive={isFetchingQueryLive}
            onOpenQueryStudio={onOpenQueryStudio}
            onPurgeDelhiAndLock={handlePurgeDelhiAndLockQuery}
            lastSyncedAt={lastSyncedAt}
            webAppConfigured={Boolean(webAppUrl)}
            onOpenTwoWaySyncModal={() => setShowTwoWaySyncModal(true)}
            onOpenColumnManager={() => setShowColManager(true)}
            onHideColumn={(colLetter) => {
              setVisibleColsByTab(prev => ({
                ...prev,
                product_order: { ...prev.product_order, [colLetter]: false }
              }));
              setSyncFeedback(`Column ${colLetter} hidden in Product Order. Click "Hide / Show Columns" or "Unhide All" to restore.`);
              setTimeout(() => setSyncFeedback(null), 3000);
            }}
            onShowAllColumns={() => {
              const all: Record<string, boolean> = {};
              productOrderColumns.forEach(c => { all[c.colLetter] = true; });
              setVisibleColsByTab(prev => ({ ...prev, product_order: all }));
            }}
          />
        ) : (
          <div
            ref={tableScrollRef}
            onScroll={handleTableScroll}
            className={`overflow-x-auto overflow-y-auto ${isFullWidth ? 'h-[calc(100vh-140px)] max-h-[89vh]' : 'h-[640px] max-h-[74vh]'} select-text relative fms-sheet-scroll border border-slate-300 rounded-lg shadow-inner bg-white`}
          >
            <table className="w-full border-collapse text-xs text-left">
            {/* The Sticky Column Letters Header with Rich Fill Colors */}
            <thead className={`${freezeRows === 1 ? 'sticky top-0 z-30' : ''} select-none border-b-2 border-slate-900`}>
              <tr className="font-mono text-[11px]">
                {/* # Column */}
                <th
                  className={`w-12 px-2 py-1 text-center bg-slate-900 text-slate-300 border-r border-slate-800 font-bold ${
                    freezeColumns >= 1 ? 'sticky left-0 z-40 bg-slate-900 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.3)]' : ''
                  }`}
                >
                  #
                </th>
                {/* Action Column */}
                <th className="w-14 px-2 py-1 text-center bg-slate-900 text-slate-300 border-r border-slate-800 font-bold">
                  Action
                </th>

                {fmsColumnMapping.map(col => {
                  if (!visibleCols[col.sheetCol]) return null;
                  const isFiltered = colFilters[col.sheetCol] && colFilters[col.sheetCol].length > 0;
                  const isSorted = sortConfig && sortConfig.column === col.sheetCol;

                  let bgColor = 'bg-slate-900 text-slate-300 border-r border-slate-800';
                  if (['A', 'B', 'C', 'D', 'E'].includes(col.sheetCol)) {
                    bgColor = 'bg-sky-950 text-sky-200 border-r border-sky-900';
                  } else if (['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].includes(col.sheetCol)) {
                    bgColor = 'bg-slate-950 text-slate-200 border-r border-slate-800';
                  } else if (['O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X'].includes(col.sheetCol)) {
                    bgColor = 'bg-indigo-950 text-indigo-200 border-r border-indigo-900';
                  } else if (col.sheetCol === 'Y') {
                    bgColor = 'bg-amber-900 text-amber-100 border-r border-amber-800 font-extrabold';
                  } else if (col.sheetCol === 'Z') {
                    bgColor = 'bg-emerald-900 text-emerald-100 border-r border-emerald-800 font-extrabold';
                  } else if (['AA', 'AB'].includes(col.sheetCol)) {
                    bgColor = 'bg-teal-950 text-teal-200 border-r border-teal-900 font-bold';
                  } else if (['AG', 'AH', 'AI'].includes(col.sheetCol)) {
                    bgColor = 'bg-emerald-950 text-emerald-200 border-r border-emerald-900 font-bold';
                  } else if (['AJ', 'AK', 'AL'].includes(col.sheetCol)) {
                    bgColor = 'bg-sky-950 text-sky-200 border-r border-sky-900 font-bold';
                  } else if (col.sheetCol === 'AN') {
                    bgColor = 'bg-blue-900 text-blue-100 border-r border-blue-800 font-extrabold';
                  } else if (col.sheetCol === 'AO' || col.sheetCol === 'AP') {
                    bgColor = 'bg-purple-950 text-purple-200 border-r border-purple-900';
                  }

                  // Sticky freeze column styles
                  let stickyStyle = '';
                  if (col.sheetCol === 'B' && freezeColumns >= 2) {
                    stickyStyle = 'sticky left-[48px] z-40 bg-sky-950 text-sky-100 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.3)]';
                  } else if (col.sheetCol === 'C' && freezeColumns >= 3) {
                    stickyStyle = 'sticky left-[158px] z-40 bg-sky-950 text-sky-100 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.3)]';
                  }

                  return (
                    <th
                      key={col.sheetCol}
                      className={`px-2 py-1 text-center font-bold ${bgColor} ${stickyStyle}`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{col.sheetCol}</span>
                        {isSorted && (
                          <span className="text-[10px] text-emerald-400 font-bold">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                        {isFiltered && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>

              {/* Row 2: Human Readable Column Names with Filters & Elegant Fill Color */}
              <tr className="bg-slate-800 text-slate-100 font-sans text-[11px] font-semibold border-b-2 border-slate-950">
                <th
                  className={`px-2 py-1 text-center bg-slate-900 text-slate-400 border-r border-slate-700 ${
                    freezeColumns >= 1 ? 'sticky left-0 z-40 bg-slate-900 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.3)]' : ''
                  }`}
                >
                  1
                </th>
                <th className="px-2 py-1 text-center bg-slate-900 text-slate-400 border-r border-slate-700 text-[10px]">
                  Action
                </th>

                {fmsColumnMapping.map(col => {
                  if (!visibleCols[col.sheetCol]) return null;
                  const isFiltered = colFilters[col.sheetCol] && colFilters[col.sheetCol].length > 0;

                  // Rich fill color for specific functional groups
                  let bgHead = 'bg-slate-800 text-slate-100 border-r border-slate-700';
                  if (col.sheetCol === 'Y') {
                    bgHead = 'bg-amber-950 text-amber-200 border-r border-amber-800 font-bold';
                  } else if (col.sheetCol === 'Z') {
                    bgHead = 'bg-emerald-950 text-emerald-200 border-r border-emerald-800 font-bold';
                  } else if (['AA', 'AB'].includes(col.sheetCol)) {
                    bgHead = 'bg-teal-900 text-teal-100 border-r border-teal-800 font-bold min-w-[120px]';
                  } else if (['AG', 'AH', 'AI'].includes(col.sheetCol)) {
                    bgHead = 'bg-emerald-900 text-emerald-100 border-r border-emerald-800 font-bold min-w-[120px]';
                  } else if (['AJ', 'AK', 'AL'].includes(col.sheetCol)) {
                    bgHead = 'bg-sky-900 text-sky-100 border-r border-sky-800 font-bold min-w-[120px]';
                  } else if (col.sheetCol === 'AN') {
                    bgHead = 'bg-blue-950 text-sky-200 border-r border-blue-800 min-w-[140px] font-bold';
                  } else if (['A', 'B', 'C', 'D', 'E'].includes(col.sheetCol)) {
                    bgHead = 'bg-slate-850 text-sky-100 border-r border-slate-700';
                  }

                  // Sticky freeze column styles
                  let stickyStyle = '';
                  if (col.sheetCol === 'B' && freezeColumns >= 2) {
                    stickyStyle = 'sticky left-[48px] z-40 bg-slate-850 text-sky-200 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.3)]';
                  } else if (col.sheetCol === 'C' && freezeColumns >= 3) {
                    stickyStyle = 'sticky left-[158px] z-40 bg-slate-850 text-sky-200 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.3)]';
                  }

                  return (
                    <th
                      key={col.sheetCol}
                      className={`px-2 py-1 whitespace-nowrap ${bgHead} ${stickyStyle}`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate">{col.name}</span>
                        {/* Filter on EVERY column */}
                        <button
                          onClick={() => setActiveFilterCol(activeFilterCol === col.sheetCol ? null : col.sheetCol)}
                          className={`p-0.5 rounded hover:bg-slate-700 transition-colors ${
                            isFiltered ? 'text-rose-400 font-extrabold bg-rose-950' : 'text-slate-400 hover:text-white'
                          }`}
                          title={`Filter, Sort or Hide ${col.name} (${col.sheetCol})`}
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="font-sans">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={45} className="text-center py-12 text-slate-500 bg-white">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No orders match the current filter or search criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">Try switching tabs below, reset column filters or clear search.</p>
                  </td>
                </tr>
              ) : (
                renderSpreadsheetRows(
                  paginatedOrders,
                  viewMode === 'merged',
                  visibleCols,
                  freezeColumns,
                  {
                    onDispatchChange: handleDispatchChange,
                    onItemStatusChange: handleItemStatusChange,
                    onDeleteOrder: handleDeleteOrder,
                    onDeleteItem: handleDeleteItem,
                    onOpenOrderNoModal: setEditingOrderNo,
                    onOpenAddItemModal: setAddingItemToOrder,
                    onOpenConfirmWhatsAppModal: setConfirmWhatsAppModalOrder,
                    onOpenWhatsAppModal: setWhatsAppModalOrder,
                    acStatuses,
                    setAcStatuses,
                    anStatuses,
                    setAnStatuses,
                    lrNumbers,
                    setLrNumbers,
                    setSyncFeedback,
                    colWStatuses,
                    onUpdateColW: handleUpdateColW,
                    colXRemarks,
                    onUpdateColX: handleUpdateColX,
                    colAEChecks,
                    onToggleColAE: handleToggleColAE,
                    colAFTimestamps,
                    colAGRemarks,
                    onUpdateColAG: handleUpdateColAG,
                    colAHChecks,
                    onToggleColAH: handleToggleColAH,
                    colAITimestamps,
                    colAJRemarks,
                    onUpdateColAJ: handleUpdateColAJ
                  },
                  startRowNumber
                )
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* FAST VIRTUAL PAGINATION BAR */}
        {(activeSheetTab === 'automation' || activeSheetTab === 'closed') && filteredOrders.length > 0 && (
          <div className="shrink-0 flex items-center justify-between px-2.5 py-1 bg-slate-100 border-t border-slate-300 text-xs text-slate-700 select-none">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 text-[11px]">
                Showing {automationPageSize === 0 ? 1 : (safeAutomationPage - 1) * automationPageSize + 1}–
                {automationPageSize === 0 ? filteredOrders.length : Math.min(safeAutomationPage * automationPageSize, filteredOrders.length)} of{' '}
                <span className="font-bold text-emerald-700">{filteredOrders.length}</span> orders
              </span>

              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-300">
                <span className="text-[10px] text-slate-500">Per page:</span>
                <select
                  value={automationPageSize}
                  onChange={(e) => {
                    setAutomationPageSize(Number(e.target.value));
                    setAutomationPage(1);
                  }}
                  className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={20}>20</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={0}>All</option>
                </select>
              </div>
            </div>

            {automationPageSize > 0 && totalAutomationPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAutomationPage(p => Math.max(1, p - 1))}
                  disabled={safeAutomationPage <= 1}
                  className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 text-[11px] font-medium cursor-pointer"
                >
                  <ChevronLeft className="w-3 h-3" /> Prev
                </button>

                <span className="px-1 text-[11px] font-medium text-slate-600">
                  <strong className="text-slate-900">{safeAutomationPage}</strong>/{totalAutomationPages}
                </span>

                <button
                  type="button"
                  onClick={() => setAutomationPage(p => Math.min(totalAutomationPages, p + 1))}
                  disabled={safeAutomationPage >= totalAutomationPages}
                  className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 text-[11px] font-medium cursor-pointer"
                >
                  Next <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* COLUMN HEADER FILTER POPOVER (Works on EVERY Column with HIDE THIS COLUMN Option) */}
        {activeFilterCol && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setActiveFilterCol(null)}>
            <div
              className="bg-white rounded-xl shadow-2xl border border-slate-300 p-4 w-72 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-emerald-600" />
                  {fmsColumnMapping.find(c => c.sheetCol === activeFilterCol)?.name} ({activeFilterCol})
                </span>
                <button onClick={() => setActiveFilterCol(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sorting options */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSortConfig({ column: activeFilterCol, direction: 'asc' });
                    setActiveFilterCol(null);
                  }}
                  className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700 flex items-center justify-center gap-1"
                >
                  <ArrowUp className="w-3 h-3 text-emerald-600" />
                  <span>Sort A → Z</span>
                </button>
                <button
                  onClick={() => {
                    setSortConfig({ column: activeFilterCol, direction: 'desc' });
                    setActiveFilterCol(null);
                  }}
                  className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700 flex items-center justify-center gap-1"
                >
                  <ArrowDown className="w-3 h-3 text-emerald-600" />
                  <span>Sort Z → A</span>
                </button>
              </div>

              {/* HIDE THIS COLUMN OPTION (Requested by user) */}
              <button
                onClick={() => {
                  setVisibleCols(prev => ({ ...prev, [activeFilterCol]: false }));
                  setActiveFilterCol(null);
                  setSyncFeedback(`Column ${activeFilterCol} hidden. Use 'Columns' button to unhide.`);
                  setTimeout(() => setSyncFeedback(null), 3000);
                }}
                className="w-full py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded font-semibold flex items-center justify-center gap-1.5 border border-rose-200"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hide this Column ({activeFilterCol})</span>
              </button>

              {/* Unique values list with checkboxes */}
              <div>
                <span className="text-[11px] font-semibold text-slate-600 block mb-1">Select values to filter:</span>
                <div className="max-h-44 overflow-y-auto space-y-1 bg-slate-50 p-2 rounded border border-slate-200">
                  {getUniqueColumnValues(activeFilterCol).map(val => {
                    const isChecked = !colFilters[activeFilterCol] || colFilters[activeFilterCol].includes(val);
                    return (
                      <label key={val} className="flex items-center gap-2 py-0.5 px-1 hover:bg-white rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleColFilterValue(activeFilterCol, val)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="truncate text-slate-800">{val}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => {
                    setColFilters(prev => {
                      const copy = { ...prev };
                      delete copy[activeFilterCol];
                      return copy;
                    });
                    setActiveFilterCol(null);
                  }}
                  className="text-slate-500 hover:text-slate-800 text-[11px] underline"
                >
                  Clear Filter
                </button>
                <button
                  onClick={() => setActiveFilterCol(null)}
                  className="px-3 py-1 bg-emerald-700 text-white rounded font-medium hover:bg-emerald-800"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL: DIRECT GOOGLE SHEET (ID + TAB) & EXCEL / CSV DATA IMPORT */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                  <Upload className="w-4 h-4 text-sky-400" />
                  Import Google Sheet / Excel Data &amp; Sync to Firebase
                </h3>
                <p className="text-[11px] text-slate-300">
                  Google Sheet ID aur Tab Name enter karke live data load karein ya direct paste karein
                </p>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportError(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setImportTabMode('sheet');
                  setImportError(null);
                }}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                  importTabMode === 'sheet'
                    ? 'border-blue-600 text-blue-900 bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                <span>⚡ Live Google Sheet (ID + Tab)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportTabMode('paste');
                  setImportError(null);
                }}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                  importTabMode === 'paste'
                    ? 'border-emerald-600 text-emerald-900 bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Copy className="w-3.5 h-3.5 text-emerald-600" />
                <span>📋 Paste Rows (Ctrl+V)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportTabMode('file');
                  setImportError(null);
                }}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                  importTabMode === 'file'
                    ? 'border-indigo-600 text-indigo-900 bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>📁 Upload File (.csv)</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              {/* Error Callout */}
              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold block text-xs">Import Issue:</span>
                    <p className="text-[11px] leading-relaxed text-rose-800">{importError}</p>
                    <p className="text-[10px] text-rose-700 font-medium">
                      💡 Tip: Agar Sheet internal/private ho, toh Google Sheet me jaakar rows select karke <strong>Ctrl+C</strong> karein aur yahan <strong>"Paste Rows (Ctrl+V)"</strong> tab me paste kar dein!
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 1: GOOGLE SHEET ID & TAB NAME */}
              {importTabMode === 'sheet' && (
                <div className="space-y-4">
                  {/* Google Sheet ID input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5 text-blue-600" />
                        Google Sheet ID ya Full Sheet URL:
                      </label>
                      <span className="text-[10px] text-slate-500">
                        URL paste karne par ID auto-extract hoti hai
                      </span>
                    </div>
                    <input
                      type="text"
                      value={importSheetId}
                      onChange={(e) => {
                        setImportSheetId(e.target.value);
                        setImportError(null);
                      }}
                      placeholder="e.g. 14cIoLK1Z8Ihj1DakVtHvk-QPrCfJzQu2hco26MBHiYk"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>
                        Extracted ID:{' '}
                        <code className="text-blue-800 font-bold font-mono">
                          {extractSheetId(importSheetId) || 'None'}
                        </code>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setImportSheetId('1xSSZ6DyQarQJOd8UpOfCV-tjdKL1oQq_IKuXJkcRv5Q')
                        }
                        className="text-blue-600 hover:underline font-bold"
                      >
                        Reset Default ID
                      </button>
                    </div>
                  </div>

                  {/* Tab / Sheet Name input */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-800 block mb-1">
                      Tab / Sheet Name (Google Sheet ke bottom tab ka naam):
                    </label>
                    <input
                      type="text"
                      value={importTabName}
                      onChange={(e) => {
                        setImportTabName(e.target.value);
                        setImportError(null);
                      }}
                      placeholder="e.g. Product Order / Product Automation"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    {/* Quick Selection Chips */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-medium">Quick Pick:</span>
                      <button
                        type="button"
                        onClick={() => setImportTabName('Product Order')}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                          importTabName === 'Product Order'
                            ? 'bg-blue-100 border-blue-400 text-blue-900 font-bold'
                            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Product Order (19 Columns A-S) ★
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportTabName('Product Automation')}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                          importTabName === 'Product Automation'
                            ? 'bg-blue-100 border-blue-400 text-blue-900 font-bold'
                            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Product Automation (43 Columns A-AQ)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportTabName('Closed Orders')}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                          importTabName === 'Closed Orders'
                            ? 'bg-blue-100 border-blue-400 text-blue-900'
                            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Closed Orders
                      </button>
                    </div>
                  </div>

                  {/* Query Formula Info Box */}
                  <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 space-y-2">
                    <div className="flex items-center justify-between text-blue-950 font-bold text-[11px]">
                      <span>Google Sheet IMPORTRANGE Query Formula:</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-200 text-blue-900 font-mono">1TksqSeCWat_0CRRPTxA0nAMiQFtUO17xUhtqHJM2JAs</span>
                    </div>
                    <code className="block bg-white p-2 rounded border border-blue-200 text-[10px] text-blue-900 font-mono leading-relaxed break-all select-all">
                      =QUERY(IMPORTRANGE("1TksqSeCWat_0CRRPTxA0nAMiQFtUO17xUhtqHJM2JAs", "Orders!A:R"), "select Col1, Col2,Col8,Col9, Col10, Col11, Col12, Col13, Col14, Col15, Col16, Col17, Col18, Col3, Col4, Col5, Col6, Col7 ", 1)
                    </code>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-[10px] text-blue-700 flex-1">
                        Transposes 18 columns from Orders!A:R directly into Product Order (A:R) with Order Number in Col S.
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          setShowImportModal(false);
                          await handleSyncGoogleQueryLive();
                        }}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold text-xs shadow-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>⚡ Load This Query (3,215 Rows)</span>
                      </button>
                    </div>
                  </div>

                  {/* Firebase Auto-Sync Checkbox card */}
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/90 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoSyncToFirebase}
                        onChange={(e) => setAutoSyncToFirebase(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
                        Auto-save imported data to Firebase Realtime Database
                      </span>
                    </label>
                    <div className="pl-6 text-[10px] text-amber-900/80 space-y-0.5">
                      <p>
                        Data import hote hi direct Firebase me batch update ho jayega taaki aapka data cloud me permanently save rahe aur har device par live show ho.
                      </p>
                      <p className="font-mono text-slate-600 truncate">
                        Target: <span className="text-amber-800">{firebaseUrl}</span> (Auth Secret: Configured ✓)
                      </p>
                    </div>
                  </div>

                  {/* Guidance Note */}
                  <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-sky-950 text-[11px] leading-relaxed">
                    <span className="font-bold block text-sky-900 mb-0.5">📌 Permission Note for Google Sheets:</span>
                    Google Sheets se direct fetch karne ke liye Sheet ka link sharing <strong>"Anyone with the link can view"</strong> hona chahiye.
                  </div>
                </div>
              )}

              {/* TAB 2: PASTE ROWS DIRECTLY */}
              {importTabMode === 'paste' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Paste rows directly copied from Google Sheets / Excel (Ctrl+V):
                    </label>
                    <textarea
                      rows={8}
                      value={pastedDataText}
                      onChange={(e) => setPastedDataText(e.target.value)}
                      placeholder="Google Sheet me rows select karke Ctrl+C karein aur yahan Ctrl+V karein...&#10;Columns automatically PO, Customer, Items, Qty, Rate, Dispatch, Status etc. me map honge."
                      className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-[11px] focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Firebase Auto-Sync Checkbox card */}
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/90">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoSyncToFirebase}
                        onChange={(e) => setAutoSyncToFirebase(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
                        Save pasted data to Firebase Realtime Database
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 3: FILE UPLOAD */}
              {importTabMode === 'file' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Select a .CSV or .TXT file from your computer:
                    </label>
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const content = event.target?.result as string;
                            if (content) setPastedDataText(content);
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                    />
                  </div>

                  {pastedDataText && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-600 max-h-28 overflow-y-auto">
                      File loaded (~{pastedDataText.split('\n').filter(Boolean).length} rows detected)
                    </div>
                  )}

                  {/* Firebase Auto-Sync Checkbox card */}
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/90">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoSyncToFirebase}
                        onChange={(e) => setAutoSyncToFirebase(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
                        Save uploaded data to Firebase Realtime Database
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Upload Mode Card: Clean 1:1 Fresh Upload vs Append */}
              <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-950 flex items-center gap-1.5">
                    <span>⚡ Upload Mode:</span>
                  </span>
                  <span className="text-[10px] text-blue-800 font-semibold bg-blue-100 px-2 py-0.5 rounded-full border border-blue-300">
                    Recommended: Replace All (Zero Duplicates)
                  </span>
                </div>
                <div className="space-y-1.5 pl-1">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 select-none">
                    <input
                      type="radio"
                      name="importReplaceMode"
                      checked={importReplaceMode}
                      onChange={() => setImportReplaceMode(true)}
                      className="text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span>✓ Replace All Rows (Clean 1:1 Fresh Upload — Purges old/duplicate rows)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 select-none">
                    <input
                      type="radio"
                      name="importReplaceMode"
                      checked={!importReplaceMode}
                      onChange={() => setImportReplaceMode(false)}
                      className="text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Append to Existing Rows (Add rows below current data)</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-200">
                <span className="text-[11px] text-slate-500">
                  Multiple times import kar sakte hain — clean 1:1 mapping ensure hogi!
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportError(null);
                    }}
                    className="px-3.5 py-1.5 text-slate-600 hover:text-slate-800 font-medium"
                  >
                    Cancel
                  </button>

                  {importTabMode === 'sheet' ? (
                    <button
                      type="button"
                      disabled={isFetchingSheet || !importSheetId.trim() || !importTabName.trim()}
                      onClick={handleFetchFromGoogleSheet}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      {isFetchingSheet ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Fetching Google Sheet...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>Fetch &amp; Import from Sheet</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!pastedDataText.trim()}
                      onClick={() => handleParseImportedData(pastedDataText, autoSyncToFirebase, importTabMode === 'paste' ? 'Pasted Data' : 'Uploaded File')}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Import into Sheet Grid</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PER-TAB COLUMN VISIBILITY MANAGER (HIDE / SHOW SPECIFIC COLUMNS) */}
      {showColManager && (() => {
        const isProductOrderTab = activeSheetTab === 'product_order';
        const activeTabTitle = isProductOrderTab
          ? 'Product Order'
          : activeSheetTab === 'closed'
            ? 'Closed Orders'
            : 'Product Automation';

        const tabColumnsList = isProductOrderTab
          ? productOrderColumns.map(c => ({ key: c.colLetter, name: c.label }))
          : fmsColumnMapping.map(c => ({ key: c.sheetCol, name: c.name }));

        const filteredColItems = tabColumnsList.filter(c => {
          if (!colSearchQuery.trim()) return true;
          const q = colSearchQuery.toLowerCase();
          return c.key.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
        });

        const visibleCount = tabColumnsList.filter(c =>
          isProductOrderTab ? visibleCols[c.key] !== false : !!visibleCols[c.key]
        ).length;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Columns className="w-4 h-4 text-emerald-400" />
                    <span>Hide / Show Columns — {activeTabTitle}</span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Checked columns stay visible in <span className="font-semibold text-white">{activeTabTitle}</span>; uncheck any column to hide it.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowColManager(false);
                    setColSearchQuery('');
                  }}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 max-h-[64vh] overflow-y-auto text-xs">
                {/* Search Columns */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={colSearchQuery}
                    onChange={(e) => setColSearchQuery(e.target.value)}
                    placeholder={`Search columns in ${activeTabTitle} (e.g. Rate, Color, S, AN)...`}
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                  />
                  {colSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setColSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Quick toggle presets per active tab */}
                <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      tabColumnsList.forEach(c => { all[c.key] = true; });
                      setVisibleCols(all);
                    }}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded font-semibold text-emerald-800 cursor-pointer"
                  >
                    Show All ({tabColumnsList.length})
                  </button>

                  {isProductOrderTab ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const core: Record<string, boolean> = {};
                          tabColumnsList.forEach(c => {
                            core[c.key] = ['A', 'B', 'C', 'E', 'I', 'Q', 'S'].includes(c.key);
                          });
                          setVisibleCols(core);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700 cursor-pointer"
                      >
                        Core Order Info (7)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const compact: Record<string, boolean> = {};
                          tabColumnsList.forEach(c => {
                            compact[c.key] = ['A', 'B', 'E', 'I', 'S'].includes(c.key);
                          });
                          setVisibleCols(compact);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700 cursor-pointer"
                      >
                        Compact SO Entry (5)
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const focused: Record<string, boolean> = {};
                          tabColumnsList.forEach(c => {
                            focused[c.key] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AN', 'AO', 'AP'].includes(c.key);
                          });
                          setVisibleCols(focused);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700 cursor-pointer"
                      >
                        Standard FMS View (29)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const min: Record<string, boolean> = {};
                          tabColumnsList.forEach(c => {
                            min[c.key] = ['B', 'C', 'E', 'I', 'S', 'U', 'V', 'AM', 'AN'].includes(c.key);
                          });
                          setVisibleCols(min);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700 cursor-pointer"
                      >
                        Compact Dispatch (9)
                      </button>
                    </>
                  )}
                </div>

                {/* Grid of all columns in active tab */}
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredColItems.map(col => {
                    const isChecked = isProductOrderTab
                      ? visibleCols[col.key] !== false
                      : !!visibleCols[col.key];
                    return (
                      <label
                        key={col.key}
                        className={`flex items-center gap-2 p-1.5 rounded border transition-colors cursor-pointer ${
                          isChecked ? 'bg-emerald-50/60 border-emerald-200 text-slate-900' : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => setVisibleCols(prev => ({ ...prev, [col.key]: e.target.checked }))}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-mono font-bold text-[11px] w-6 text-emerald-800">{col.key}</span>
                        <span className="truncate text-xs">{col.name}</span>
                      </label>
                    );
                  })}
                  {filteredColItems.length === 0 && (
                    <div className="col-span-2 py-4 text-center text-slate-400 text-xs">
                      No columns matching &ldquo;{colSearchQuery}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-slate-600 font-medium">
                  {visibleCount} of {tabColumnsList.length} columns visible ({activeTabTitle})
                </span>
                <button
                  onClick={() => {
                    setShowColManager(false);
                    setColSearchQuery('');
                  }}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: FIREBASE CLOUD SYNC & HISTORICAL DATA UPLOAD */}
      {showFirebaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Flame className="w-5 h-5 fill-white" />
                  Firebase Cloud Sync &amp; Historical Data Upload
                </h3>
                <p className="text-xs text-amber-100">
                  Load up to 1 Lakh+ rows without browser lag or script timeouts
                </p>
              </div>
              <button onClick={() => setShowFirebaseModal(false)} className="text-amber-100 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-amber-950 space-y-1">
                <span className="font-bold block text-sm flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-amber-700" />
                  Firebase Data Kahan Save Hota Hai?
                </span>
                <p className="text-[11px] text-amber-900/90 leading-relaxed">
                  Data <strong>Firebase Console &gt; Build &gt; Realtime Database &gt; Data</strong> tab me <code>/product_automation</code> aur <code>/closed_orders</code> me save hota hai.
                  (Firestore Database me nahi, Realtime Database me check karein!)
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Firebase Realtime Database URL:
                  </label>
                  <input
                    type="text"
                    value={firebaseUrl}
                    onChange={(e) => setFirebaseUrl(e.target.value)}
                    placeholder="https://your-project-id-default-rtdb.firebaseio.com"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    📌 <strong>URL Kahan Milegi:</strong> Firebase Console &gt; Left menu <strong>Build</strong> &gt; <strong>Realtime Database</strong> &gt; Data tab ke bilkul upar di hui URL copy karke yahan paste karein.
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Firebase Database Secret (Auth Token):
                  </label>
                  <input
                    type="text"
                    value={firebaseSecret}
                    onChange={(e) => setFirebaseSecret(e.target.value)}
                    placeholder="iIElINFgR124ssaG3QWjExz2lT72cRh5g502oP6J"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none bg-slate-50"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Firebase Console &gt; Project Settings &gt; Service Accounts &gt; Database Secrets
                  </span>
                </div>
              </div>

              {/* Upload Progress Bar if active */}
              {uploadProgress !== null && (
                <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Uploading Orders to Firebase...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Chunking: 100 rows per batch payload (Zero Quota Loss)
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem(
                        LOCAL_STORAGE_FIREBASE_CONFIG,
                        JSON.stringify({ url: firebaseUrl, secret: firebaseSecret })
                      );
                      setSyncFeedback('Saved Firebase URL & Secret Token to application!');
                      setTimeout(() => setSyncFeedback(null), 3000);
                    }}
                    className="w-full sm:w-auto px-3.5 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 text-xs"
                  >
                    Save Config
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const targetUrl = firebaseUrl.trim().replace(/\/+$/, '');
                        const authParam = firebaseSecret ? `?auth=${encodeURIComponent(firebaseSecret)}` : '';
                        const testUrl = `${targetUrl}/_connection_test.json${authParam}`;
                        setSyncFeedback('Testing Firebase connection...');
                        const resp = await fetch(testUrl, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            tested_at: new Date().toISOString(),
                            status: 'Connected',
                            client: 'GINZA Web FMS'
                          })
                        });
                        if (resp.ok) {
                          setSyncFeedback(`✓ Firebase Connected Successfully! (HTTP ${resp.status})`);
                        } else {
                          const errTxt = await resp.text();
                          setSyncFeedback(`Firebase Connection Failed: HTTP ${resp.status} - ${errTxt.substring(0, 100)}`);
                        }
                      } catch (err: any) {
                        setSyncFeedback(`Firebase Test Error: ${err.message || 'Network error'}`);
                      }
                      setTimeout(() => setSyncFeedback(null), 5000);
                    }}
                    className="w-full sm:w-auto px-3.5 py-2 border border-amber-300 bg-amber-50 rounded-lg font-semibold text-amber-900 hover:bg-amber-100 text-xs"
                  >
                    📡 Test Ping
                  </button>
                </div>

                <button
                  type="button"
                  disabled={uploadProgress !== null}
                  onClick={handleUploadToFirebase}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 text-xs"
                >
                  <CloudUpload className="w-4 h-4" />
                  <span>1-Click Upload Data to Firebase</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW MULTI-ITEM ORDER */}
      {showNewOrderModal && (
        <NewOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onSubmit={handleCreateNewOrder}
        />
      )}

      {/* MODAL: ADD ITEM TO EXISTING ORDER */}
      {addingItemToOrder && (
        <AddItemModal
          order={addingItemToOrder}
          onClose={() => setAddingItemToOrder(null)}
          onSubmit={(itemData) => handleAddItemToExistingOrder(addingItemToOrder, itemData)}
        />
      )}

      {/* MODAL: QUICK EDIT ORDER NO (COL X) */}
      {editingOrderNo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-5 max-w-md w-full">
            <h3 className="text-sm font-bold text-slate-900">
              Edit Order Number (Col X)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Set or update Sales Order number for <strong className="text-slate-800">{editingOrderNo.po}</strong>.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Sales Order Number (Col X)</label>
                <input
                  type="text"
                  value={editingOrderNo.value}
                  onChange={(e) => setEditingOrderNo({ ...editingOrderNo, value: e.target.value })}
                  placeholder="e.g. DMN/02241/25-26 / TDN/03590/25-26"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                  autoFocus
                />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingOrderNo(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOrderNo}
                className="px-4 py-1.5 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
              >
                Save Order No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WHATSAPP DISPATCH PREVIEW */}
      {whatsAppModalOrder && (() => {
        const cleanPhone = (whatsAppModalOrder.customerNumber || '').replace(/[+\-\s]/g, '').replace(/^0+/, '');
        const itemBlocks = whatsAppModalOrder.items.map(it => (
          `*Item Name*    : ${it.itemName}\n` +
          `*Color*        : ${it.color}\n` +
          `*Dispatch Qnt* : ${it.dispatchQty || 0}\n` +
          `*Unit of Item* : ${it.unitOfItem}`
        )).join('\n--------------------------\n');

        const messageText =
          `Dear ${whatsAppModalOrder.customerName},\n\n` +
          `We are pleased to inform you that your order has been *successfully dispatched*.\n\n` +
          `*Order Summary*\n` +
          `--------------------------\n` +
          `Order Date : ${whatsAppModalOrder.orderDate}\n` +
          `Order No   : ${whatsAppModalOrder.orderNo || 'DMN/02241/25-26'}\n` +
          `Transporter: ${whatsAppModalOrder.transporterName || 'Mehta transport'}\n\n` +
          `*Dispatched Items*\n` +
          `--------------------------\n` +
          itemBlocks + `\n\n` +
          `Thank you for choosing Ginza Industries Ltd.`;

        const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
              <div className="px-5 py-4 bg-emerald-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-emerald-800 text-white">
                    <MessageSquare className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm">WhatsApp Dispatch Link Preview (Col AO → AP)</h3>
                    <p className="text-[11px] text-emerald-100">Formula generated via HYPERLINK + ENCODEURL</p>
                  </div>
                </div>
                <button
                  onClick={() => setWhatsAppModalOrder(null)}
                  className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-emerald-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Customer &amp; Phone (Col P)</span>
                    <span className="font-bold text-slate-800">{whatsAppModalOrder.customerName}</span>
                    <span className="font-mono text-emerald-700 block">{cleanPhone || '8800421410'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Order No &amp; Date (Col X &amp; E)</span>
                    <span className="font-bold text-slate-800">{whatsAppModalOrder.orderNo || 'DMN/02241/25-26'}</span>
                    <span className="text-slate-600 block">{whatsAppModalOrder.orderDate}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Dispatched Message (Multi-item summary):
                    </label>
                    <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {whatsAppModalOrder.items.length} Product Items
                    </span>
                  </div>
                  <div className="bg-[#eef8f2] border border-[#c1e7ce] p-3.5 rounded-xl font-mono text-xs whitespace-pre-wrap text-slate-800 leading-relaxed shadow-inner">
                    {messageText}
                  </div>
                </div>
              </div>

              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(messageText);
                    setCopiedWhatsAppMsg(true);
                    setTimeout(() => setCopiedWhatsAppMsg(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  {copiedWhatsAppMsg ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedWhatsAppMsg ? 'Copied Message!' : 'Copy Text'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWhatsAppModalOrder(null)}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg"
                  >
                    Close
                  </button>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Send on WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: INSTANT CONFIRMATION WHATSAPP PREVIEW (Col AE ➔ AF) */}
      {confirmWhatsAppModalOrder && (() => {
        const cleanPhone = (confirmWhatsAppModalOrder.customerNumber || '').replace(/[^0-9]/g, '');
        const displayOrderNo = confirmWhatsAppModalOrder.orderNo?.trim() || confirmWhatsAppModalOrder.customerPO?.trim() || 'Pending';
        const NL = '\n';
        const NL2 = '\n\n';

        const itemBlocks = confirmWhatsAppModalOrder.items.map((it, idx) => {
          const itemHeader = confirmWhatsAppModalOrder.items.length > 1 ? `*Item ${idx + 1}:*${NL}` : '';
          return (
            itemHeader +
            `Item Name: ${it.itemName}${NL}` +
            `Color: ${it.color}${NL}` +
            `Qnt: ${it.qty}${NL}` +
            `Price: ${it.rate}${NL}` +
            `Delivery Date: ${it.deliveryDate || ''}`
          );
        });

        const itemsText = itemBlocks.join(`${NL}--------------------------${NL}`);
        let addressLine = '';
        if (confirmWhatsAppModalOrder.deliveryAddress && confirmWhatsAppModalOrder.deliveryAddress.trim()) {
          addressLine = `Delivery Address: ${confirmWhatsAppModalOrder.deliveryAddress.trim()}${NL}`;
        }

        const messageText =
          `Dear ${confirmWhatsAppModalOrder.customerName || 'Customer'},${NL2}` +
          `Thank you for choosing Ginza Industries Ltd.${NL2}` +
          `Your Order has been successfully received and is now being processed.${NL2}` +
          `*Order Summary*${NL2}` +
          `Order Date: ${confirmWhatsAppModalOrder.orderDate}${NL}` +
          `Order Number: ${displayOrderNo}${NL}` +
          addressLine +
          `--------------------------${NL}` +
          itemsText + `${NL}` +
          `--------------------------${NL2}` +
          `Thank you for your continued support & trust in Soie and Ginza Industries Limited.`;

        const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
              <div className="px-5 py-4 bg-emerald-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-emerald-800 text-white">
                    <MessageSquare className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm">Order Confirmation WhatsApp Preview (Col AE ➔ AF)</h3>
                    <p className="text-[11px] text-emerald-100">Formula generated via HYPERLINK + ENCODEURL</p>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmWhatsAppModalOrder(null)}
                  className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-emerald-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Customer &amp; Phone (Col P)</span>
                    <span className="font-bold text-slate-800">{confirmWhatsAppModalOrder.customerName}</span>
                    <span className="font-mono text-emerald-700 block">{cleanPhone || '8800421410'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Order No &amp; Date (Col X &amp; E)</span>
                    <span className="font-bold text-slate-800">{displayOrderNo}</span>
                    <span className="text-slate-600 block">{confirmWhatsAppModalOrder.orderDate}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Order Confirmation Message (Instant Booking Notice):
                    </label>
                    <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {confirmWhatsAppModalOrder.items.length} Product Items
                    </span>
                  </div>
                  <div className="bg-[#eef8f2] border border-[#c1e7ce] p-3.5 rounded-xl font-mono text-xs whitespace-pre-wrap text-slate-800 leading-relaxed shadow-inner">
                    {messageText}
                  </div>
                </div>
              </div>

              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(messageText);
                    setCopiedConfirmMsg(true);
                    setTimeout(() => setCopiedConfirmMsg(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  {copiedConfirmMsg ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedConfirmMsg ? 'Copied Message!' : 'Copy Text'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmWhatsAppModalOrder(null)}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg"
                  >
                    Close
                  </button>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Send on WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* MODAL: 2-WAY GOOGLE SHEET WRITE-BACK (APPS SCRIPT WEB APP SETUP) */}
      {showTwoWaySyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-900 to-teal-800 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-emerald-300" />
                  2-Way Google Sheet Centralization (App ⇄ Google Sheet)
                </h3>
                <p className="text-[11px] text-emerald-100">
                  App me Order No (Col S), Dispatch Qnt (Col U), ya Col AM edit karte hi direct Google Sheet update hoga
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTwoWaySyncModal(false)}
                className="text-emerald-100 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 space-y-1">
                <span className="font-bold block">How 2-Way Centralization Works:</span>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  <strong>1) Sheet ➔ App (Already Active ✓):</strong> Google Sheet ke &quot;Product Order&quot; &amp; &quot;Product Automation&quot; tabs me koi bhi Order Number, Dispatch Qnt, ya Col AM status dalein, app me auto-sync ho jata hai.
                </p>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  <strong>2) App ➔ Sheet Write-Back:</strong> Google Sheet me row write karne ke liye neeche diya Apps Script deploy karke apna Web App URL yahan paste karein.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-800 block">
                  Step 1: Deploy Apps Script as Web App (Access: &quot;Anyone&quot;)
                </label>
                <div className="flex items-center justify-between gap-2 bg-slate-900 text-slate-200 p-2.5 rounded-lg">
                  <span className="text-[11px] font-mono truncate">
                    Extensions ➔ Apps Script ➔ Paste Code ➔ Deploy ➔ Web App (Anyone)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generateTwoWayWebAppCode(defaultGasConfig));
                      setCopiedWebAppScript(true);
                      setTimeout(() => setCopiedWebAppScript(false), 2500);
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedWebAppScript ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedWebAppScript ? 'Copied Code!' : 'Copy Web App Script'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-800 block">
                  Step 2: Paste Deployed Google Apps Script Web App URL (Target Sheet: <span className="font-mono text-emerald-700">1xSSZ6DyQarQJOd8UpOfCV-tjdKL1oQq_IKuXJkcRv5Q</span>)
                </label>
                <input
                  type="url"
                  value={webAppUrl}
                  onChange={(e) => setWebAppUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
                {webAppUrl.trim().endsWith('/dev') && (
                  <p className="text-[11px] text-rose-600 font-semibold">
                    ⚠️ Aapne &quot;/dev&quot; test URL paste kiya hai. Deploy ➔ New deployment karke &quot;/exec&quot; URL paste karein!
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={testingWebApp || !webAppUrl.trim().startsWith('https://script.google.com/')}
                  onClick={async () => {
                    setTestingWebApp(true);
                    try {
                      const resp = await fetch(webAppUrl.trim(), { redirect: 'follow' });
                      const data = await resp.json();
                      if (data.ok) {
                        setSyncFeedbackTone('success');
                        setSyncFeedback('✓ 2-Way Apps Script Web App Verified & Connected!');
                      } else {
                        setSyncFeedbackTone('warning');
                        setSyncFeedback('Web App responded, check spreadsheet permissions.');
                      }
                    } catch (err: any) {
                      setSyncFeedbackTone('error');
                      setSyncFeedback(`Web App ping failed: ${err?.message || 'Ensure access is set to Anyone'}`);
                    } finally {
                      setTestingWebApp(false);
                      setTimeout(() => setSyncFeedback(null), 5000);
                    }
                  }}
                  className="px-3 py-1.5 border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 rounded-lg font-semibold text-xs disabled:opacity-50 cursor-pointer"
                >
                  {testingWebApp ? 'Testing...' : 'Test Connection'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWebAppUrl(DEFAULT_WEB_APP_URL);
                      try { localStorage.setItem(WEB_APP_URL_STORAGE_KEY, DEFAULT_WEB_APP_URL); } catch {}
                      setSyncFeedbackTone('success');
                      setSyncFeedback('✓ Default 2-Way Web App URL restored & saved!');
                      setTimeout(() => setSyncFeedback(null), 4000);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                    title="Restore built-in default 2-Way Google Sheet URL"
                  >
                    Reset Default URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const clean = webAppUrl.trim();
                      setWebAppUrl(clean);
                      try {
                        localStorage.setItem(WEB_APP_URL_STORAGE_KEY, clean);
                      } catch {}
                      setShowTwoWaySyncModal(false);
                      setSyncFeedbackTone(clean.endsWith('/dev') ? 'warning' : 'success');
                      setSyncFeedback(
                        clean
                          ? clean.endsWith('/dev')
                            ? '⚠️ Warning: "/dev" URL saved. Please replace with "/exec" Web App deployment URL.'
                            : '✓ 2-Way Google Sheet Write-Back URL Saved! Ab Order No Col S direct Google Sheet me save hoga.'
                          : '2-Way URL cleared.'
                      );
                      setTimeout(() => setSyncFeedback(null), 5000);
                    }}
                    className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Save Web App URL
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// RENDER FUNCTION FOR ROWS (Handles Merged A-E, N-X, and Freeze Panes)
function renderSpreadsheetRows(
  orders: GroupedOrder[],
  useMerge: boolean,
  visibleCols: Record<string, boolean>,
  freezeColumns: number,
  handlers: {
    onDispatchChange: (orderKey: string, item: any, valStr: string) => void;
    onItemStatusChange: (orderId: string, newStatus: 'Open' | 'In-Progress' | 'Closed' | 'Complete') => void;
    onDeleteOrder: (orderKey: string, poName: string) => void;
    onDeleteItem: (itemOrderId: string) => void;
    onOpenOrderNoModal: (data: { key: string; po: string; value: string }) => void;
    onOpenAddItemModal: (order: GroupedOrder) => void;
    onOpenConfirmWhatsAppModal: (order: GroupedOrder) => void;
    onOpenWhatsAppModal: (order: GroupedOrder) => void;
    acStatuses: Record<string, string>;
    setAcStatuses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    anStatuses: Record<string, string>;
    setAnStatuses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    lrNumbers: Record<string, string>;
    setLrNumbers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setSyncFeedback: (msg: string | null) => void;
    colWStatuses: Record<string, string>;
    onUpdateColW: (orderKey: string, val: string) => void;
    colXRemarks: Record<string, string>;
    onUpdateColX: (orderKey: string, val: string) => void;
    colAEChecks: Record<string, boolean>;
    onToggleColAE: (orderKey: string, checked: boolean) => void;
    colAFTimestamps: Record<string, string>;
    colAGRemarks: Record<string, string>;
    onUpdateColAG: (orderKey: string, val: string) => void;
    colAHChecks: Record<string, boolean>;
    onToggleColAH: (orderKey: string, checked: boolean) => void;
    colAITimestamps: Record<string, string>;
    colAJRemarks: Record<string, string>;
    onUpdateColAJ: (orderKey: string, val: string) => void;
  },
  startRowIndex: number = 2
) {
  let rowNumber = startRowIndex; // Sheets start row 2 (or offset for page)
  const rows: React.ReactNode[] = [];

  orders.forEach((order) => {
    const rowSpan = useMerge ? order.items.length : 1;
    const currentOrderKey = order.orderKey;
    const currentStatus = order.statusAN || 'Open';

    order.items.forEach((item, itemIdx) => {
      const isFirst = itemIdx === 0;
      const isLast = itemIdx === order.items.length - 1;
      const showHeaderCols = !useMerge || isFirst;
      const thisRow = rowNumber;

      const bottomBorderClass = useMerge && isLast
        ? 'border-b-2 border-b-slate-400'
        : 'border-b border-b-slate-200';

      const cellBottomBorder = useMerge ? 'border-b-2 border-b-slate-400' : '';

      // Freeze column positioning styles
      const numSticky = freezeColumns >= 1 ? 'sticky left-0 z-20 bg-slate-50 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.15)]' : '';
      const poSticky = freezeColumns >= 2 ? 'sticky left-[48px] z-20 bg-blue-50/90 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.15)]' : '';
      const nameSticky = freezeColumns >= 3 ? 'sticky left-[158px] z-20 bg-blue-50/90 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.15)]' : '';

      rows.push(
        <tr
          key={`${order.orderKey}_${item.id}_${itemIdx}`}
          className={`hover:bg-slate-50 transition-colors ${bottomBorderClass}`}
        >
          {/* Row Number */}
          <td
            className={`px-1.5 py-0.5 text-center bg-slate-50 border-r border-slate-300 font-mono text-[10px] text-slate-500 ${numSticky} ${useMerge && isLast ? 'border-b-2 border-b-slate-400' : ''}`}
          >
            {thisRow}
          </td>

          {/* Quick Action Column (Add Item / Delete) */}
          {showHeaderCols ? (
            <td
              rowSpan={rowSpan}
              className={`px-1 py-0.5 text-center bg-slate-50/80 border-r border-slate-300 align-middle whitespace-nowrap ${cellBottomBorder}`}
            >
              <div className="flex items-center justify-center gap-0.5">
                <button
                  onClick={() => handlers.onOpenAddItemModal(order)}
                  className="p-0.5 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                  title="Add another Item row to this order"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handlers.onDeleteOrder(order.orderKey, order.customerPO || order.orderKey)}
                  className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Delete this entire order"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </td>
          ) : null}

          {/* COLUMNS A TO C: VERTICAL MERGE */}
          {showHeaderCols && (
            <>
              {/* Col A: Timestamp */}
              {visibleCols['A'] && (
                <td
                  rowSpan={rowSpan}
                  className={`px-2 py-0.5 border-r border-slate-300 text-slate-600 align-middle bg-blue-50/20 whitespace-nowrap text-[11px] ${cellBottomBorder}`}
                >
                  {order.timestamp}
                </td>
              )}

              {/* Col B: Customer Name */}
              {visibleCols['B'] && (
                <td
                  rowSpan={rowSpan}
                  className={`px-2 py-0.5 border-r border-slate-300 font-bold text-slate-900 align-middle bg-blue-50/20 whitespace-nowrap text-[11px] ${poSticky} ${cellBottomBorder}`}
                >
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-900">{order.customerName}</span>
                    {useMerge && order.items.length > 1 && (
                      <span className="text-[9px] px-1 py-0.1 rounded-full bg-blue-100 text-blue-800 font-mono font-bold">
                        {order.items.length} itm
                      </span>
                    )}
                  </div>
                </td>
              )}

              {/* Col C: Order Date */}
              {visibleCols['C'] && (
                <td
                  rowSpan={rowSpan}
                  className={`px-2 py-0.5 border-r border-slate-300 text-slate-700 align-middle bg-blue-50/20 whitespace-nowrap text-[11px] ${cellBottomBorder}`}
                >
                  {order.orderDate}
                </td>
              )}
            </>
          )}

          {/* COLUMNS D TO L: INDIVIDUAL PRODUCT ITEM ROWS (UNMERGED) */}
          {/* Col D: Unit */}
          {visibleCols['D'] && (
            <td
              className={`px-2 py-0.5 border-r border-slate-300 text-slate-700 whitespace-nowrap font-medium text-[11px] ${useMerge && isLast ? 'border-b-2 border-b-slate-400' : ''}`}
            >
              {item.unit}
            </td>
          )}

          {/* Col E: Item Name */}
          {visibleCols['E'] && (
            <td
              className={`px-2 py-0.5 border-r border-slate-300 font-semibold text-slate-900 whitespace-nowrap text-[11px] ${useMerge && isLast ? 'border-b-2 border-b-slate-400' : ''}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span>{item.itemName}</span>
                {order.items.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlers.onDeleteItem(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-600 text-slate-300 p-0.5 rounded"
                    title="Delete item row"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </td>
          )}

          {/* Col F: Color */}
          {visibleCols['F'] && (
            <td
              className={`px-2 py-0.5 border-r border-slate-300 text-slate-700 whitespace-nowrap text-[11px] ${useMerge && isLast ? 'border-b-2 border-b-slate-400' : ''}`}
            >
              {item.color}
            </td>
          )}

          {/* Col G: Width */}
          {visibleCols['G'] && (
            <td
              className={`px-2 py-0.5 border-r border-slate-300 text-slate-700 whitespace-nowrap text-[11px] ${useMerge && isLast ? 'border-b-2 border-b-slate-400' : ''}`}
            >
              {item.width}
            </td>
          )}

          {/* Col H: Unit (of item) */}
          {visibleCols['H'] && (
            <td
              className={`px-2 py-0.5 border-r border-slate-300 text-slate-600 whitespace-nowrap text-[11px] ${useMerge && isLast ? 'border-b-2 border-b-slate-400' : ''}`}
            >
              {item.unitOfItem}
            </td>
          )}

          {/* Col I: Qty */}
          {visibleCols['I'] && (
            <td
              className={`px-2 py-0.5 border-r border-slate-300 font-mono font-bold text-slate-900 text-right whitespace-nowrap text-[11px] ${useMerge && isLast ? 'border-b-2 border-b-slate-400' : ''}`}
            >
              {item.qty.toLocaleString()}
            </td>
          )}

          {/* Col J: Rate */}
          {visibleCols['J'] && (
            <td
              className={`px-2 py-0.5 border-r border-slate-300 font-mono text-slate-700 text-right whitespace-nowrap text-[11px] ${useMerge && isLast ? 'border-b-2 border-b-slate-400' : ''}`}
            >
              ₹{item.rate}
            </td>
          )}

          {/* Col K: Discount */}
          {visibleCols['K'] && (
            <td
              className={`px-2 py-0.5 border-r border-slate-300 font-mono text-slate-700 text-right whitespace-nowrap text-[11px] ${useMerge && isLast ? 'border-b-2 border-b-slate-400' : ''}`}
            >
              {item.discount}%
            </td>
          )}

          {/* Col L: Delivery Date */}
          {visibleCols['L'] && (
            <td
              className={`px-2 py-0.5 border-r border-slate-300 text-slate-600 whitespace-nowrap text-[11px] ${useMerge && isLast ? 'border-b-2 border-b-slate-400' : ''}`}
            >
              {item.deliveryDate}
            </td>
          )}

          {/* COLUMNS M TO T: VERTICAL MERGE */}
          {showHeaderCols && (
            <>
              {/* Col M: Remark */}
              {visibleCols['M'] && (
                <td
                  rowSpan={rowSpan}
                  className={`px-2 py-0.5 border-r border-slate-300 text-slate-600 align-middle bg-blue-50/20 whitespace-nowrap max-w-[180px] truncate text-[11px] ${cellBottomBorder}`}
                  title={order.remark}
                >
                  {order.remark || '—'}
                </td>
              )}

              {/* Col N: Customer Number */}
              {visibleCols['N'] && (
                <td
                  rowSpan={rowSpan}
                  className={`px-2 py-0.5 border-r border-slate-300 font-mono text-slate-700 align-middle bg-blue-50/20 whitespace-nowrap text-[11px] ${cellBottomBorder}`}
                >
                  {order.customerNumber}
                </td>
              )}

              {/* Col O: Billing Address */}
              {visibleCols['O'] && (
                <td
                  rowSpan={rowSpan}
                  className={`px-2 py-0.5 border-r border-slate-300 text-slate-600 align-middle bg-blue-50/20 whitespace-nowrap max-w-[180px] truncate text-[11px] ${cellBottomBorder}`}
                  title={order.billingAddress}
                >
                  {order.billingAddress}
                </td>
              )}

              {/* Col P: Delivery Address */}
              {visibleCols['P'] && (
                <td
                  rowSpan={rowSpan}
                  className={`px-2 py-0.5 border-r border-slate-300 text-slate-600 align-middle bg-blue-50/20 whitespace-nowrap max-w-[180px] truncate text-[11px] ${cellBottomBorder}`}
                  title={order.deliveryAddress}
                >
                  {order.deliveryAddress}
                </td>
              )}

              {/* Col Q: Sales Person Name */}
              {visibleCols['Q'] && (
                <td
                  rowSpan={rowSpan}
                  className={`px-2 py-0.5 border-r border-slate-300 text-slate-700 align-middle bg-blue-50/20 whitespace-nowrap text-[11px] ${cellBottomBorder}`}
                >
                  {order.salesPerson}
                </td>
              )}

              {/* Col R: Sales Person Contact */}
              {visibleCols['R'] && (
                <td
                  rowSpan={rowSpan}
                  className={`px-2 py-0.5 border-r border-slate-300 text-slate-600 align-middle bg-blue-50/20 whitespace-nowrap font-mono text-[11px] ${cellBottomBorder}`}
                >
                  {order.salesPersonContact || '—'}
                </td>
              )}

              {/* Col S: Order No (Editable with Modal) */}
              {visibleCols['S'] && (
                <td
                  rowSpan={rowSpan}
                  className={`px-2 py-0.5 border-r border-slate-300 font-mono font-medium text-slate-900 align-middle bg-blue-50/20 whitespace-nowrap text-[11px] ${cellBottomBorder}`}
                >
                  <div className="flex items-center gap-1">
                    <span className={order.orderNo ? 'font-bold text-slate-900' : 'text-slate-400 italic'}>
                      {order.orderNo || 'Set SO#'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlers.onOpenOrderNoModal({ key: order.orderKey, po: order.customerPO || '', value: order.orderNo });
                      }}
                      className="text-slate-400 hover:text-emerald-700 p-0.5 rounded transition-colors"
                      title="Edit Order Number in Col S"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </td>
              )}

              {/* Col T: Customer Mail Id */}
              {visibleCols['T'] && (
                <td
                  rowSpan={rowSpan}
                  className={`px-2 py-0.5 border-r border-slate-300 text-slate-600 align-middle bg-blue-50/20 whitespace-nowrap text-[10px] ${cellBottomBorder}`}
                >
                  {order.customerMailId || order.customerEmail || '—'}
                </td>
              )}
            </>
          )}

          {/* COLUMN U: DISPATCH QNT (ITEM ROW USER ENTRY) */}
          {visibleCols['U'] && (
            <td
              className={`px-1.5 py-0.5 border-r border-slate-300 bg-amber-50/40 whitespace-nowrap text-right ${useMerge && isLast ? 'border-b-2 border-b-slate-400' : ''}`}
            >
              <div className="flex items-center justify-end gap-1">
                <input
                  type="number"
                  step="any"
                  value={item.dispatchQty !== undefined && item.dispatchQty !== null ? item.dispatchQty : ''}
                  placeholder="0"
                  onChange={(e) => handlers.onDispatchChange(order.orderKey, item, e.target.value)}
                  className="w-18 px-1.5 py-0.5 text-right font-mono text-[11px] font-bold text-amber-950 bg-white border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 focus:outline-none h-6 print:hidden"
                />
                <span className="hidden print:inline-block font-mono font-bold text-slate-900 text-[11px]">
                  {item.dispatchQty !== undefined && item.dispatchQty !== null ? item.dispatchQty : 0}
                </span>
              </div>
            </td>
          )}

          {/* COLUMN V: BALANCE QNT (= I - U) */}
          {visibleCols['V'] && (
            <td
              className={`px-2 py-0.5 border-r border-slate-300 bg-emerald-50/40 whitespace-nowrap text-right text-[11px] ${useMerge && isLast ? 'border-b-2 border-b-slate-400' : ''}`}
            >
              <div className="flex items-center justify-end gap-1.5">
                <span
                  className={`font-mono font-bold text-[11px] tabular-nums ${
                    (item.balanceQty || 0) <= 0
                      ? 'text-emerald-700'
                      : (item.dispatchQty || 0) > 0
                      ? 'text-amber-700'
                      : 'text-slate-900'
                  }`}
                >
                  {item.balanceQty?.toLocaleString()}
                </span>
                {(item.balanceQty || 0) <= 0 ? (
                  <span className="text-[9px] px-1 py-0.1 rounded bg-emerald-100 text-emerald-800 font-bold">
                    Done
                  </span>
                ) : (item.dispatchQty || 0) > 0 ? (
                  <span className="text-[9px] px-1 py-0.1 rounded bg-amber-100 text-amber-800 font-bold">
                    Partial
                  </span>
                ) : (
                  <span className="text-[9px] px-1 py-0.1 rounded bg-slate-100 text-slate-600 font-medium">
                    Pending
                  </span>
                )}
              </div>
            </td>
          )}

          {/* OPERATIONAL COLUMNS W TO AL: VERTICALLY MERGED */}
          {showHeaderCols && (
            <>
              {/* Col W: Status (Manual User Text Edit with Auto-Save) */}
              {visibleCols['W'] && (
                <td rowSpan={rowSpan} className={`px-1.5 py-0.5 border-r border-slate-300 align-middle ${cellBottomBorder}`}>
                  <input
                    type="text"
                    placeholder="Status..."
                    value={handlers.colWStatuses[currentOrderKey] ?? (order.accountStatus || 'In Production')}
                    onChange={(e) => handlers.onUpdateColW(currentOrderKey, e.target.value)}
                    className="w-28 px-1.5 py-0.5 border border-teal-300 rounded text-[11px] font-semibold text-slate-800 bg-teal-50/20 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 h-6 shadow-2xs"
                    title="Col W: Editable Status (Auto-saved)"
                  />
                </td>
              )}

              {/* Col X: Remark (Manual User Text Edit with Auto-Save) */}
              {visibleCols['X'] && (
                <td rowSpan={rowSpan} className={`px-1.5 py-0.5 border-r border-slate-300 align-middle ${cellBottomBorder}`}>
                  <input
                    type="text"
                    placeholder="Remark..."
                    value={handlers.colXRemarks[currentOrderKey] ?? ''}
                    onChange={(e) => handlers.onUpdateColX(currentOrderKey, e.target.value)}
                    className="w-32 px-1.5 py-0.5 border border-slate-300 rounded text-[11px] text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 h-6 shadow-2xs"
                    title="Col X: Editable Logistics Remark (Auto-saved)"
                  />
                </td>
              )}

              {/* Col Y: Approval */}
              {visibleCols['Y'] && (
                <td rowSpan={rowSpan} className={`px-2 py-0.5 border-r border-slate-300 text-slate-700 align-middle text-[11px] ${cellBottomBorder}`}>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                    {order.approvalStatus || 'APPROVED'}
                  </span>
                </td>
              )}

              {/* Col Z: Timestamp */}
              {visibleCols['Z'] && (
                <td rowSpan={rowSpan} className={`px-2 py-0.5 border-r border-slate-300 text-slate-600 align-middle text-[10px] font-mono ${cellBottomBorder} whitespace-nowrap`}>
                  {order.orderNoTimestamp || order.timestamp}
                </td>
              )}

              {/* Col AA: Confirmation Mail */}
              {visibleCols['AA'] && (
                <td rowSpan={rowSpan} className={`px-2 py-0.5 border-r border-slate-300 text-slate-700 align-middle text-[11px] font-medium text-center ${cellBottomBorder}`}>
                  Sent
                </td>
              )}

              {/* Col AB: Mail Status */}
              {visibleCols['AB'] && (
                <td rowSpan={rowSpan} className={`px-2 py-0.5 border-r border-slate-300 text-emerald-700 font-medium align-middle text-[11px] text-center ${cellBottomBorder}`}>
                  Delivered
                </td>
              )}

              {/* Col AC: Confirmation Msg (WhatsApp Sent) */}
              {visibleCols['AC'] && (
                <td rowSpan={rowSpan} className={`px-1.5 py-0.5 border-r border-slate-300 text-center align-middle bg-blue-50/20 whitespace-nowrap ${cellBottomBorder}`}>
                  <select
                    value={handlers.acStatuses[currentOrderKey] || 'Pending'}
                    onChange={(e) => {
                      const val = e.target.value;
                      handlers.setAcStatuses(prev => ({ ...prev, [currentOrderKey]: val }));
                      handlers.setSyncFeedback(`Col AC Confirmation set to "${val}". ${val === 'Message Sent' ? 'WhatsApp link active in Col AD!' : 'Pending status.'}`);
                      setTimeout(() => handlers.setSyncFeedback(null), 3500);
                    }}
                    className="text-[10px] bg-white border border-blue-300 rounded px-1.5 py-0.5 font-medium text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none h-6"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Message Sent">Message Sent</option>
                  </select>
                </td>
              )}

              {/* Col AD: Whatspp Link (Instant Confirmation AC ➔ AD) */}
              {visibleCols['AD'] && (
                <td rowSpan={rowSpan} className={`px-1.5 py-0.5 border-r border-slate-300 text-center align-middle bg-emerald-50/20 whitespace-nowrap ${cellBottomBorder}`}>
                  <button
                    onClick={() => handlers.onOpenConfirmWhatsAppModal(order)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                    title="Send Order Confirmation WhatsApp"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Send WA</span>
                    <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                </td>
              )}

              {/* Col AE: Follow-up 1 (CHECKBOX - when clicked, auto timestamp in Col AF) */}
              {visibleCols['AE'] && (
                <td rowSpan={rowSpan} className={`px-2 py-0.5 border-r border-slate-300 text-center align-middle ${cellBottomBorder} bg-emerald-50/30`}>
                  <label className="inline-flex items-center justify-center cursor-pointer p-0.5" title="Check to record Follow-up 1 timestamp in Col AF">
                    <input
                      type="checkbox"
                      checked={!!handlers.colAEChecks[currentOrderKey]}
                      onChange={(e) => handlers.onToggleColAE(currentOrderKey, e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                    />
                  </label>
                </td>
              )}

              {/* Col AF: Timestamp (Auto-generated from Col AE Checkbox) */}
              {visibleCols['AF'] && (
                <td rowSpan={rowSpan} className={`px-2 py-0.5 border-r border-slate-300 align-middle text-[10px] font-mono ${cellBottomBorder} whitespace-nowrap bg-emerald-50/10`}>
                  {handlers.colAFTimestamps[currentOrderKey] ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                      <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>{handlers.colAFTimestamps[currentOrderKey]}</span>
                    </span>
                  ) : (
                    <span className="text-slate-300 italic text-[10px]">—</span>
                  )}
                </td>
              )}

              {/* Col AG: Follow-up 1 Remark (Manual User Text Edit with Auto-Save - EDITABLE!) */}
              {visibleCols['AG'] && (
                <td rowSpan={rowSpan} className={`px-1.5 py-0.5 border-r border-slate-300 align-middle ${cellBottomBorder}`}>
                  <input
                    type="text"
                    placeholder="Follow-up 1 remark..."
                    value={handlers.colAGRemarks[currentOrderKey] ?? ''}
                    onChange={(e) => handlers.onUpdateColAG(currentOrderKey, e.target.value)}
                    className="w-36 px-1.5 py-0.5 border border-slate-300 rounded text-[11px] text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 h-6 shadow-2xs"
                    title="Col AG: Editable Follow-up 1 Remark (Auto-saved)"
                  />
                </td>
              )}

              {/* Col AH: Follow-up 2 (CHECKBOX - when clicked, auto timestamp in Col AI) */}
              {visibleCols['AH'] && (
                <td rowSpan={rowSpan} className={`px-2 py-0.5 border-r border-slate-300 text-center align-middle ${cellBottomBorder} bg-sky-50/30`}>
                  <label className="inline-flex items-center justify-center cursor-pointer p-0.5" title="Check to record Follow-up 2 timestamp in Col AI">
                    <input
                      type="checkbox"
                      checked={!!handlers.colAHChecks[currentOrderKey]}
                      onChange={(e) => handlers.onToggleColAH(currentOrderKey, e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer shadow-2xs"
                    />
                  </label>
                </td>
              )}

              {/* Col AI: Timestamp (Auto-generated from Col AH Checkbox) */}
              {visibleCols['AI'] && (
                <td rowSpan={rowSpan} className={`px-2 py-0.5 border-r border-slate-300 align-middle text-[10px] font-mono ${cellBottomBorder} whitespace-nowrap bg-sky-50/10`}>
                  {handlers.colAITimestamps[currentOrderKey] ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300 font-bold">
                      <Clock className="w-3 h-3 text-sky-600 shrink-0" />
                      <span>{handlers.colAITimestamps[currentOrderKey]}</span>
                    </span>
                  ) : (
                    <span className="text-slate-300 italic text-[10px]">—</span>
                  )}
                </td>
              )}

              {/* Col AJ: Follow-up 2 Remark (Manual User Text Edit with Auto-Save - EDITABLE!) */}
              {visibleCols['AJ'] && (
                <td rowSpan={rowSpan} className={`px-1.5 py-0.5 border-r border-slate-300 align-middle ${cellBottomBorder}`}>
                  <input
                    type="text"
                    placeholder="Follow-up 2 remark..."
                    value={handlers.colAJRemarks[currentOrderKey] ?? ''}
                    onChange={(e) => handlers.onUpdateColAJ(currentOrderKey, e.target.value)}
                    className="w-36 px-1.5 py-0.5 border border-slate-300 rounded text-[11px] text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 h-6 shadow-2xs"
                    title="Col AJ: Editable Follow-up 2 Remark (Auto-saved)"
                  />
                </td>
              )}

              {/* Col AK: Transport Name */}
              {visibleCols['AK'] && (
                <td rowSpan={rowSpan} className={`px-2 py-0.5 border-r border-slate-300 text-slate-700 align-middle text-[11px] ${cellBottomBorder}`}>
                  {order.transporterName || 'Atc express'}
                </td>
              )}

              {/* Col AL: LR- Number */}
              {visibleCols['AL'] && (
                <td rowSpan={rowSpan} className={`px-1.5 py-0.5 border-r border-slate-300 font-mono text-slate-800 align-middle ${cellBottomBorder}`}>
                  <input
                    type="text"
                    placeholder="e.g. MEHTA-0041"
                    value={handlers.lrNumbers[currentOrderKey] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      handlers.setLrNumbers(prev => ({ ...prev, [currentOrderKey]: val }));
                    }}
                    className="w-24 px-1.5 py-0.5 border border-slate-300 rounded font-mono text-[11px] h-6"
                  />
                </td>
              )}
            </>
          )}

          {/* COLUMN AM: OPEN / CLOSE (INDIVIDUAL PRODUCT ITEM ROW - UNMERGED) */}
          {visibleCols['AM'] && (
            <td
              className={`px-1.5 py-0.5 border-r border-slate-300 text-center align-middle bg-sky-50/20 whitespace-nowrap ${
                useMerge && isLast ? 'border-b-2 border-b-slate-400' : ''
              }`}
            >
              <div className="flex items-center justify-center">
                <select
                  value={isItemComplete(item.statusAN) ? 'Complete' : (item.statusAN || 'Open')}
                  onChange={(e) => handlers.onItemStatusChange(item.id, e.target.value as any)}
                  className={`text-[11px] font-bold rounded px-1.5 py-0.5 border transition-all cursor-pointer focus:outline-none focus:ring-1 h-6 shadow-2xs ${
                    isItemComplete(item.statusAN)
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-400 focus:ring-emerald-500'
                      : (item.statusAN || 'Open') === 'In-Progress'
                      ? 'bg-amber-100 text-amber-900 border-amber-400 focus:ring-amber-500'
                      : 'bg-sky-100 text-sky-900 border-sky-400 focus:ring-sky-500'
                  }`}
                >
                  <option value="Open">🔵 Open</option>
                  <option value="In-Progress">🟡 In-Progress</option>
                  <option value="Complete">🟢 Complete</option>
                </select>
              </div>
            </td>
          )}

          {/* COLUMNS AN TO AQ: DELIVERED WHATSAPP & EMAILS (VERTICALLY MERGED PER ORDER) */}
          {showHeaderCols && (
            <>
              {/* Col AN: Delivered Whatspp Msg ("Pending" / "Message Sent") */}
              {visibleCols['AN'] && (
                <td
                  rowSpan={rowSpan}
                  className={`px-1.5 py-0.5 border-r border-slate-300 text-center align-middle whitespace-nowrap ${cellBottomBorder} bg-purple-50/20`}
                >
                  <select
                    value={handlers.anStatuses[currentOrderKey] === 'Message Sent' ? 'Message Sent' : 'Pending'}
                    onChange={(e) => {
                      const val = e.target.value;
                      handlers.setAnStatuses(prev => ({ ...prev, [currentOrderKey]: val }));
                      handlers.setSyncFeedback(`Col AN Delivered WhatsApp set to "${val}". ${val === 'Message Sent' ? 'WhatsApp link active in Col AO!' : 'Pending status.'}`);
                      setTimeout(() => handlers.setSyncFeedback(null), 3500);
                    }}
                    className={`text-[10px] rounded px-1.5 py-0.5 font-bold focus:ring-1 focus:outline-none h-6 ${
                      handlers.anStatuses[currentOrderKey] === 'Message Sent'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-400 focus:ring-emerald-500'
                        : 'bg-white border border-purple-300 text-slate-800 focus:ring-purple-500'
                    }`}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Message Sent">Message Sent</option>
                  </select>
                </td>
              )}

              {/* Col AO: Whatspp Link (Dispatch WhatsApp) */}
              {visibleCols['AO'] && (
                <td
                  rowSpan={rowSpan}
                  className={`px-1.5 py-0.5 border-r border-slate-300 text-center align-middle bg-emerald-50/20 whitespace-nowrap ${cellBottomBorder}`}
                >
                  <button
                    onClick={() => handlers.onOpenWhatsAppModal(order)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                    title="Send WhatsApp Dispatch Notice"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Send WA</span>
                    <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                </td>
              )}

              {/* Col AP: Delivery Email */}
              {visibleCols['AP'] && (
                <td rowSpan={rowSpan} className={`px-2 py-0.5 border-r border-slate-300 text-slate-600 align-middle text-[10px] ${cellBottomBorder}`}>
                  {order.customerMailId || order.customerEmail || '—'}
                </td>
              )}

              {/* Col AQ: Delivery Email Link */}
              {visibleCols['AQ'] && (
                <td rowSpan={rowSpan} className={`px-2 py-0.5 border-r border-slate-300 text-blue-600 align-middle text-center text-[10px] ${cellBottomBorder}`}>
                  {order.customerMailId || order.customerEmail ? (
                    <a
                      href={`mailto:${order.customerMailId || order.customerEmail}?subject=Dispatch%20Details%20Order%20${encodeURIComponent(order.orderNo || '')}&body=Dear%20Customer,%0A%0AYour%20order%20has%20been%20dispatched.`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <span>Send Email</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">—</span>
                  )}
                </td>
              )}
            </>
          )}
        </tr>
      );

      rowNumber++;
    });
  });

  return rows;
}

// MODAL COMPONENT: CREATE NEW ORDER WITH MULTIPLE ITEMS
interface NewOrderModalProps {
  onClose: () => void;
  onSubmit: (orderData: any) => void;
}

const NewOrderModal: React.FC<NewOrderModalProps> = ({ onClose, onSubmit }) => {
  const [customerPO, setCustomerPO] = useState(`PO-${Math.floor(1000 + Math.random() * 9000)}`);
  const [customerName, setCustomerName] = useState('Manju Creation (Santacruz Mumbai)');
  const [customerEmail, setCustomerEmail] = useState('orders@manjucreation.com');
  const [customerNumber, setCustomerNumber] = useState('9820123456');
  const [orderDate, setOrderDate] = useState('23/04/2026');
  const [billingAddress, setBillingAddress] = useState('Shop 4, Station Road, Santacruz West, Mumbai, Maharashtra 400054');
  const [deliveryAddress, setDeliveryAddress] = useState('Shop 4, Station Road, Santacruz West, Mumbai, Maharashtra 400054');
  const [transporterName, setTransporterName] = useState('Mumbai Central Transport');
  const [salesPerson, setSalesPerson] = useState('Santosh Pachratkar');
  const [orderNo, setOrderNo] = useState(`MMFSO2526-0${Math.floor(1700 + Math.random() * 90)}`);
  const [remark, setRemark] = useState('Urgent delivery Mumbai HO');
  const [statusAN, setStatusAN] = useState<'Open' | 'In-Progress' | 'Closed'>('Open');

  // Items in this order
  const [items, setItems] = useState([
    {
      unit: 'ELASTIC',
      itemName: 'N5412-18MM',
      color: 'White',
      width: '18 mm',
      unitOfItem: 'MTR',
      qty: 32000,
      rate: 4.21,
      discount: 0,
      deliveryDate: '02/06/2026'
    },
    {
      unit: 'ELASTIC',
      itemName: 'N5412-25MM',
      color: 'White',
      width: '25 mm',
      unitOfItem: 'MTR',
      qty: 28000,
      rate: 5.38,
      discount: 0,
      deliveryDate: '02/06/2026'
    }
  ]);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        unit: 'ELASTIC',
        itemName: 'N5412-10MM',
        color: 'White',
        width: '10 mm',
        unitOfItem: 'MTR',
        qty: 32000,
        rate: 2.46,
        discount: 0,
        deliveryDate: '02/06/2026'
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems(items.map((it, idx) => idx === index ? { ...it, [field]: value } : it));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      customerPO,
      customerName,
      customerEmail,
      customerNumber,
      orderDate,
      billingAddress,
      deliveryAddress,
      transporterName,
      salesPerson,
      orderNo,
      remark,
      statusAN,
      items
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-400" />
              Add Customer Order (Multi-Item Vertical Merge)
            </h3>
            <p className="text-xs text-slate-300">
              Columns A–E and N–X will vertically merge across all {items.length} items entered below.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Order Header Fields */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
              Order Header Details (Merged Columns A–E &amp; N–X)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Customer PO (Col B)</label>
                <input
                  type="text"
                  required
                  value={customerPO}
                  onChange={(e) => setCustomerPO(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Customer Name (Col C)</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Customer Number (Col P)</label>
                <input
                  type="text"
                  value={customerNumber}
                  onChange={(e) => setCustomerNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Order Date (Col E)</label>
                <input
                  type="text"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Transporter Name (Col S)</label>
                <input
                  type="text"
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Order Number (Col X)</label>
                <input
                  type="text"
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-mono font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Open / Close (Col AN)</label>
                <select
                  value={statusAN}
                  onChange={(e) => setStatusAN(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-sky-400 text-sky-950 font-bold rounded"
                >
                  <option value="Open">🔵 Open</option>
                  <option value="In-Progress">🟡 In-Progress</option>
                  <option value="Closed">🟢 Closed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Billing &amp; Delivery Address (Col Q &amp; R)</label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => {
                    setBillingAddress(e.target.value);
                    setDeliveryAddress(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Remark (Col O)</label>
                <input
                  type="text"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Individual Item Rows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Product Items ({items.length} Rows — Cols F to N)
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Item Row</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-center gap-2 text-xs">
                  <span className="w-5 text-center font-mono font-bold text-slate-400 text-[11px]">{idx + 1}</span>
                  <div className="w-32">
                    <input
                      type="text"
                      placeholder="Item Name (Col G)"
                      value={it.itemName}
                      onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-medium"
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="text"
                      placeholder="Color (Col H)"
                      value={it.color}
                      onChange={(e) => handleItemChange(idx, 'color', e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div className="w-16">
                    <input
                      type="text"
                      placeholder="Width (Col I)"
                      value={it.width}
                      onChange={(e) => handleItemChange(idx, 'width', e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      placeholder="Qty (Col K)"
                      value={it.qty}
                      onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono font-bold text-right"
                    />
                  </div>
                  <div className="w-16">
                    <input
                      type="number"
                      placeholder="Rate (Col L)"
                      value={it.rate}
                      onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono text-right"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="text"
                      placeholder="Delivery Date"
                      value={it.deliveryDate}
                      onChange={(e) => handleItemChange(idx, 'deliveryDate', e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded ml-auto"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 shadow-sm"
            >
              Add Multi-Item Order to Sheet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// MODAL COMPONENT: ADD ITEM TO EXISTING ORDER
interface AddItemModalProps {
  order: GroupedOrder;
  onClose: () => void;
  onSubmit: (itemData: any) => void;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ order, onClose, onSubmit }) => {
  const [unit, setUnit] = useState('ELASTIC');
  const [itemName, setItemName] = useState('N5412-10MM');
  const [color, setColor] = useState('White');
  const [width, setWidth] = useState('10 mm');
  const [unitOfItem, setUnitOfItem] = useState('MTR');
  const [qty, setQty] = useState(15000);
  const [rate, setRate] = useState(2.8);
  const [discount, setDiscount] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState('02/06/2026');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      unit,
      itemName,
      color,
      width,
      unitOfItem,
      qty,
      rate,
      discount,
      deliveryDate
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Add Item to {order.customerPO}</h3>
            <p className="text-[11px] text-slate-500">Customer: {order.customerName}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Item Name (Col G)</label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Color (Col H)</label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Width (Col I)</label>
              <input
                type="text"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Qty (Col K)</label>
              <input
                type="number"
                required
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Rate ₹ (Col L)</label>
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Disc % (Col M)</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Delivery Target Date (Col N)</label>
            <input
              type="text"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-bold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 shadow-sm"
            >
              Add Item Row
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
