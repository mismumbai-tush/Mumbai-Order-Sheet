import React, { useMemo, useState } from 'react';
import { GroupedOrder, DispatchHistoryEntry } from '../types/fms';
import { parseOrderDateInfo, SearchBasisMode } from './ProductOrderView';
import { isItemComplete } from './SpreadsheetSimulator';
import {
  BarChart3,
  Download,
  RotateCcw,
  Calendar,
  Building2,
  Users,
  TrendingUp,
  PackageCheck,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Layers,
  Archive,
  Truck
} from 'lucide-react';

interface DashboardViewProps {
  groupedOrders: GroupedOrder[];
  colAKTransporters?: Record<string, string>;
  dispatchHistoryMap?: Record<string, DispatchHistoryEntry[]>;
  onNavigateToOrder?: (
    tab: 'automation' | 'closed',
    searchQuery: string,
    searchMode?: SearchBasisMode
  ) => void;
}

type StatusScope = 'ALL' | 'AUTOMATION' | 'CLOSED';
type TrendGranularity = 'monthly' | 'weekly';
type EmployeeSortKey = 'qty' | 'value' | 'dispatchPct' | 'orders';
type CustomerMetricKey = 'qty' | 'value' | 'balance' | 'orders';
type BreakdownTabKey = 'items' | 'colors' | 'transporters' | 'uom';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function toDateObj(info: { year?: number; month?: number; day?: number }): Date | null {
  if (!info.year || !info.month || !info.day) return null;
  const d = new Date(info.year, info.month - 1, info.day, 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getQuarterFromMonth(month?: number): 'Q1' | 'Q2' | 'Q3' | 'Q4' | null {
  if (!month || month < 1 || month > 12) return null;
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

// ISO-like Monday-start week bucket
function getWeekInfo(date: Date): { key: string; label: string; shortLabel: string; startTs: number } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = d.getDay(); // 0=Sun..6=Sat
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  // ISO week number
  const thu = new Date(mon);
  thu.setDate(mon.getDate() + 3);
  const yearStart = new Date(thu.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((thu.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  const key = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
  const monLabel = `${mon.getDate()} ${MONTH_LABELS[mon.getMonth()]}`;
  const sunLabel = `${sun.getDate()} ${MONTH_LABELS[sun.getMonth()]}`;
  const label = `W${String(weekNum).padStart(2, '0')} · ${monLabel}–${sunLabel} ${sun.getFullYear()}`;
  const shortLabel = `W${String(weekNum).padStart(2, '0')} (${monLabel})`;
  return { key, label, shortLabel, startTs: mon.getTime() };
}

function formatINR(val: number): string {
  if (!Number.isFinite(val) || val === 0) return '₹0';
  const abs = Math.abs(val);
  if (abs >= 1e7) return `₹${(val / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(val / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `₹${(val / 1e3).toFixed(1)} K`;
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

function formatQty(val: number): string {
  if (!Number.isFinite(val)) return '0';
  if (Math.abs(val - Math.round(val)) < 0.001) {
    return Math.round(val).toLocaleString('en-IN');
  }
  return Number(val.toFixed(2)).toLocaleString('en-IN');
}

function formatShortAxis(val: number): string {
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(0)}k`;
  return String(Math.round(val));
}

function normalizeDashboardEmployeeName(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return 'Vishal Ambhore';
  const normalized = trimmed.toLowerCase().replace(/[\s_-]+/g, ' ');
  if (
    normalized === 'unassigned' ||
    normalized === 'vishal ambhore' ||
    normalized === 'vishal' ||
    normalized === 'nikam' ||
    normalized === 'ginza mumbai ho' ||
    normalized.includes('ginza mumbai')
  ) {
    return 'Vishal Ambhore';
  }
  return trimmed;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  groupedOrders,
  colAKTransporters = {},
  dispatchHistoryMap = {},
  onNavigateToOrder
}) => {
  // Upper Filter States
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedQuarter, setSelectedQuarter] = useState<'ALL' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedWeek, setSelectedWeek] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('ALL');
  const [statusScope, setStatusScope] = useState<StatusScope>('ALL');

  // Interactive Chart View Controls
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>('monthly');
  const [hoveredPeriodKey, setHoveredPeriodKey] = useState<string | null>(null);
  const [employeeSort, setEmployeeSort] = useState<EmployeeSortKey>('qty');
  const [customerMetric, setCustomerMetric] = useState<CustomerMetricKey>('qty');
  const [breakdownTab, setBreakdownTab] = useState<BreakdownTabKey>('items');

  // Extract filter option lists from all orders
  const filterOptions = useMemo(() => {
    const years = new Set<string>();
    const units = new Set<string>();
    const employees = new Set<string>();

    groupedOrders.forEach(order => {
      const info = parseOrderDateInfo(order.orderDate, order.timestamp);
      if (info.year && info.year >= 2020 && info.year <= 2035) {
        years.add(String(info.year));
      }
      const emp = normalizeDashboardEmployeeName(order.salesPerson);
      employees.add(emp);

      order.items.forEach(item => {
        const u = (item.unit || '').trim();
        if (u) units.add(u);
      });
    });

    return {
      years: Array.from(years).sort().reverse(),
      units: Array.from(units).sort((a, b) => a.localeCompare(b)),
      employees: Array.from(employees).sort((a, b) => a.localeCompare(b))
    };
  }, [groupedOrders]);

  // Available months constrained by selectedQuarter
  const monthOptions = useMemo(() => {
    const all = MONTH_LABELS.map((label, idx) => ({ value: String(idx + 1), label: `${label} (${String(idx + 1).padStart(2, '0')})` }));
    if (selectedQuarter === 'Q1') return all.slice(0, 3);
    if (selectedQuarter === 'Q2') return all.slice(3, 6);
    if (selectedQuarter === 'Q3') return all.slice(6, 9);
    if (selectedQuarter === 'Q4') return all.slice(9, 12);
    return all;
  }, [selectedQuarter]);

  // Week buckets available within Year / Quarter / Month scope
  const availableWeeks = useMemo(() => {
    const weekMap = new Map<string, { key: string; label: string; startTs: number; count: number }>();

    groupedOrders.forEach(order => {
      const info = parseOrderDateInfo(order.orderDate, order.timestamp);
      const d = toDateObj(info);
      if (!d) return;

      if (selectedYear !== 'ALL' && String(info.year) !== selectedYear) return;
      if (selectedQuarter !== 'ALL' && getQuarterFromMonth(info.month) !== selectedQuarter) return;
      if (selectedMonth !== 'ALL' && String(info.month) !== selectedMonth) return;

      const w = getWeekInfo(d);
      const existing = weekMap.get(w.key);
      if (!existing) {
        weekMap.set(w.key, { key: w.key, label: w.label, startTs: w.startTs, count: 1 });
      } else {
        existing.count += 1;
      }
    });

    return Array.from(weekMap.values()).sort((a, b) => b.startTs - a.startTs);
  }, [groupedOrders, selectedYear, selectedQuarter, selectedMonth]);

  // Filtered Orders + Item Scope
  const filteredDataset = useMemo(() => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentWeekKey = getWeekInfo(todayMidnight).key;
    const lastWeekDate = new Date(todayMidnight);
    lastWeekDate.setDate(todayMidnight.getDate() - 7);
    const lastWeekKey = getWeekInfo(lastWeekDate).key;
    const fourWeeksAgoTs = todayMidnight.getTime() - 28 * 86400000;

    const matchedOrders: Array<{
      order: GroupedOrder;
      isClosed: boolean;
      dateInfo: { year?: number; month?: number; day?: number };
      dateObj: Date | null;
      items: GroupedOrder['items'];
    }> = [];

    groupedOrders.forEach(order => {
      const isOrderComplete =
        isItemComplete(order.statusAN) ||
        order.items.some(it => isItemComplete(it.statusAN));

      // Status scope filter (Product Automation vs Closed Orders)
      if (statusScope === 'AUTOMATION' && isOrderComplete) return;
      if (statusScope === 'CLOSED' && !isOrderComplete) return;

      // Employee filter
      const emp = normalizeDashboardEmployeeName(order.salesPerson);
      if (selectedEmployee !== 'ALL' && emp !== selectedEmployee) return;

      // Date filters (Year, Quarter, Month, Week)
      const dateInfo = parseOrderDateInfo(order.orderDate, order.timestamp);
      const dateObj = toDateObj(dateInfo);

      if (selectedYear !== 'ALL' && String(dateInfo.year || '') !== selectedYear) return;
      if (selectedQuarter !== 'ALL' && getQuarterFromMonth(dateInfo.month) !== selectedQuarter) return;
      if (selectedMonth !== 'ALL' && String(dateInfo.month || '') !== selectedMonth) return;

      if (selectedWeek !== 'ALL') {
        if (!dateObj) return;
        const wk = getWeekInfo(dateObj);
        if (selectedWeek === 'THIS_WEEK') {
          if (wk.key !== currentWeekKey) return;
        } else if (selectedWeek === 'LAST_WEEK') {
          if (wk.key !== lastWeekKey) return;
        } else if (selectedWeek === 'LAST_4_WEEKS') {
          if (dateObj.getTime() < fourWeeksAgoTs || dateObj.getTime() > todayMidnight.getTime() + 86400000) return;
        } else if (wk.key !== selectedWeek) {
          return;
        }
      }

      // Unit filter applies cleanly at item level
      const matchingItems = selectedUnit === 'ALL'
        ? order.items
        : order.items.filter(it => (it.unit || '').trim() === selectedUnit);

      if (matchingItems.length === 0) return;

      matchedOrders.push({
        order,
        isClosed: isOrderComplete,
        dateInfo,
        dateObj,
        items: matchingItems
      });
    });

    return matchedOrders;
  }, [
    groupedOrders,
    statusScope,
    selectedEmployee,
    selectedYear,
    selectedQuarter,
    selectedMonth,
    selectedWeek,
    selectedUnit
  ]);

  // Comprehensive Business Analytics Computation
  const analytics = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    let totalOrders = 0;
    let openOrdersCount = 0;
    let inProgressOrdersCount = 0;
    let closedOrdersCount = 0;
    let totalItemLines = 0;

    let totalOrderQty = 0;
    let totalDispatchQty = 0;
    let totalBalanceQty = 0;
    let totalOrderValue = 0;
    let totalDispatchedValue = 0;
    let totalPendingValue = 0;

    let discountSum = 0;
    let discountCount = 0;
    let zeroDispatchOpenCount = 0;
    let partialDispatchOpenCount = 0;
    let fullDispatchOpenCount = 0;
    let overdueOpenCount = 0;
    let totalPartDispatchLogs = 0;

    interface AggBucket {
      key: string;
      label: string;
      shortLabel: string;
      sortWeight: number;
      orders: number;
      closedOrders: number;
      orderQty: number;
      dispatchQty: number;
      balanceQty: number;
      value: number;
    }

    const periodMap = new Map<string, AggBucket>();

    const employeeMap = new Map<string, {
      name: string;
      orders: number;
      openOrders: number;
      closedOrders: number;
      itemLines: number;
      orderQty: number;
      dispatchQty: number;
      balanceQty: number;
      value: number;
      dispatchedValue: number;
      discountSum: number;
      discountCount: number;
    }>();

    const unitMap = new Map<string, {
      unit: string;
      orders: number;
      openOrders: number;
      closedOrders: number;
      itemLines: number;
      orderQty: number;
      dispatchQty: number;
      balanceQty: number;
      value: number;
    }>();

    const customerMap = new Map<string, {
      name: string;
      orders: number;
      openOrders: number;
      closedOrders: number;
      orderQty: number;
      dispatchQty: number;
      balanceQty: number;
      value: number;
    }>();

    const itemMap = new Map<string, {
      itemName: string;
      orders: number;
      orderQty: number;
      dispatchQty: number;
      balanceQty: number;
      value: number;
      uom: string;
    }>();

    const colorMap = new Map<string, {
      color: string;
      orders: number;
      orderQty: number;
      dispatchQty: number;
      balanceQty: number;
    }>();

    const transporterMap = new Map<string, {
      name: string;
      orders: number;
      dispatchQty: number;
      orderQty: number;
    }>();

    const uomMap = new Map<string, {
      uom: string;
      lines: number;
      orderQty: number;
      dispatchQty: number;
      balanceQty: number;
    }>();

    const watchlist: Array<{
      orderKey: string;
      orderNo: string;
      customerName: string;
      salesPerson: string;
      units: string;
      orderDate: string;
      deliveryDate: string;
      daysOverdue: number;
      orderQty: number;
      dispatchQty: number;
      balanceQty: number;
      pendingValue: number;
      isClosed: boolean;
    }> = [];

    filteredDataset.forEach(({ order, isClosed, dateInfo, dateObj, items }) => {
      totalOrders += 1;
      if (isClosed) {
        closedOrdersCount += 1;
      } else {
        openOrdersCount += 1;
        if ((order.statusAN || '').toLowerCase() === 'in-progress') {
          inProgressOrdersCount += 1;
        }
      }

      let ordQty = 0;
      let ordDispatch = 0;
      let ordBalance = 0;
      let ordValue = 0;
      let ordDispVal = 0;
      let ordPendVal = 0;
      let earliestOverdueDays = 0;
      let earliestDeliveryStr = '';
      const ordUnitsSet = new Set<string>();

      items.forEach(item => {
        totalItemLines += 1;
        const q = Number(item.qty) || 0;
        const d = Number(item.dispatchQty) || 0;
        const b = Math.max(0, Number(item.balanceQty ?? (q - d)) || 0);
        const rate = Number(item.rate) || 0;
        const disc = Number(item.discount) || 0;
        const multiplier = Math.max(0, 1 - disc / 100);
        const val = q * rate * multiplier;
        const dispVal = d * rate * multiplier;
        const pendVal = b * rate * multiplier;

        ordQty += q;
        ordDispatch += d;
        ordBalance += b;
        ordValue += val;
        ordDispVal += dispVal;
        ordPendVal += pendVal;

        if (rate > 0) {
          discountSum += disc;
          discountCount += 1;
        }

        const ledgerKey = `${order.orderKey}___${(item.itemName || '').trim()}___${(item.color || '').trim()}___${(item.width || '').trim()}`;
        const ledgerList = dispatchHistoryMap[ledgerKey];
        if (ledgerList && ledgerList.length > 0) {
          totalPartDispatchLogs += ledgerList.length;
        }

        // Delivery due check for open items with remaining balance
        if (!isClosed && b > 0 && item.deliveryDate) {
          const delInfo = parseOrderDateInfo(item.deliveryDate, '');
          const delDate = toDateObj(delInfo);
          if (delDate && delDate.getTime() < todayStart) {
            const diffDays = Math.floor((todayStart - delDate.getTime()) / 86400000);
            if (diffDays > earliestOverdueDays) {
              earliestOverdueDays = diffDays;
              earliestDeliveryStr = item.deliveryDate;
            }
          } else if (!earliestDeliveryStr) {
            earliestDeliveryStr = item.deliveryDate;
          }
        } else if (!earliestDeliveryStr && item.deliveryDate) {
          earliestDeliveryStr = item.deliveryDate;
        }

        // Unit breakdown
        const unitName = (item.unit || 'Unassigned Unit').trim() || 'Unassigned Unit';
        ordUnitsSet.add(unitName);
        const uAgg = unitMap.get(unitName) || {
          unit: unitName,
          orders: 0,
          openOrders: 0,
          closedOrders: 0,
          itemLines: 0,
          orderQty: 0,
          dispatchQty: 0,
          balanceQty: 0,
          value: 0
        };
        uAgg.itemLines += 1;
        uAgg.orderQty += q;
        uAgg.dispatchQty += d;
        uAgg.balanceQty += b;
        uAgg.value += val;
        unitMap.set(unitName, uAgg);

        // Item SKU breakdown
        const skuName = (item.itemName || 'Unspecified Item').trim() || 'Unspecified Item';
        const uomName = (item.unitOfItem || 'MTR').trim().toUpperCase() || 'MTR';
        const iAgg = itemMap.get(skuName) || {
          itemName: skuName,
          orders: 0,
          orderQty: 0,
          dispatchQty: 0,
          balanceQty: 0,
          value: 0,
          uom: uomName
        };
        iAgg.orders += 1;
        iAgg.orderQty += q;
        iAgg.dispatchQty += d;
        iAgg.balanceQty += b;
        iAgg.value += val;
        itemMap.set(skuName, iAgg);

        // Color breakdown
        const colorName = (item.color || 'Unspecified').trim() || 'Unspecified';
        const cAgg = colorMap.get(colorName) || {
          color: colorName,
          orders: 0,
          orderQty: 0,
          dispatchQty: 0,
          balanceQty: 0
        };
        cAgg.orders += 1;
        cAgg.orderQty += q;
        cAgg.dispatchQty += d;
        cAgg.balanceQty += b;
        colorMap.set(colorName, cAgg);

        // UOM breakdown
        const mAgg = uomMap.get(uomName) || {
          uom: uomName,
          lines: 0,
          orderQty: 0,
          dispatchQty: 0,
          balanceQty: 0
        };
        mAgg.lines += 1;
        mAgg.orderQty += q;
        mAgg.dispatchQty += d;
        mAgg.balanceQty += b;
        uomMap.set(uomName, mAgg);
      });

      // Count unique orders per unit
      ordUnitsSet.forEach(uName => {
        const uAgg = unitMap.get(uName);
        if (uAgg) {
          uAgg.orders += 1;
          if (isClosed) uAgg.closedOrders += 1;
          else uAgg.openOrders += 1;
        }
      });

      totalOrderQty += ordQty;
      totalDispatchQty += ordDispatch;
      totalBalanceQty += ordBalance;
      totalOrderValue += ordValue;
      totalDispatchedValue += ordDispVal;
      totalPendingValue += ordPendVal;

      if (!isClosed) {
        if (ordDispatch <= 0) zeroDispatchOpenCount += 1;
        else if (ordBalance > 0) partialDispatchOpenCount += 1;
        else fullDispatchOpenCount += 1;

        if (earliestOverdueDays > 0) overdueOpenCount += 1;

        if (ordBalance > 0) {
          watchlist.push({
            orderKey: order.orderKey,
            orderNo: order.orderNo || 'Pending SO#',
            customerName: order.customerName || 'Unknown',
            salesPerson: normalizeDashboardEmployeeName(order.salesPerson),
            units: Array.from(ordUnitsSet).join(', '),
            orderDate: order.orderDate || '—',
            deliveryDate: earliestDeliveryStr || '—',
            daysOverdue: earliestOverdueDays,
            orderQty: ordQty,
            dispatchQty: ordDispatch,
            balanceQty: ordBalance,
            pendingValue: ordPendVal,
            isClosed
          });
        }
      }

      // Period aggregation (monthly or weekly)
      if (dateObj) {
        let pKey = '';
        let pLabel = '';
        let pShort = '';
        let pWeight = 0;

        if (trendGranularity === 'weekly') {
          const w = getWeekInfo(dateObj);
          pKey = w.key;
          pLabel = w.label;
          pShort = w.shortLabel;
          pWeight = w.startTs;
        } else {
          const yr = dateInfo.year || dateObj.getFullYear();
          const mo = dateInfo.month || (dateObj.getMonth() + 1);
          pKey = `${yr}-${String(mo).padStart(2, '0')}`;
          pLabel = `${MONTH_LABELS[mo - 1]} ${yr}`;
          pShort = `${MONTH_LABELS[mo - 1]} '${String(yr).slice(-2)}`;
          pWeight = yr * 100 + mo;
        }

        const pAgg = periodMap.get(pKey) || {
          key: pKey,
          label: pLabel,
          shortLabel: pShort,
          sortWeight: pWeight,
          orders: 0,
          closedOrders: 0,
          orderQty: 0,
          dispatchQty: 0,
          balanceQty: 0,
          value: 0
        };
        pAgg.orders += 1;
        if (isClosed) pAgg.closedOrders += 1;
        pAgg.orderQty += ordQty;
        pAgg.dispatchQty += ordDispatch;
        pAgg.balanceQty += ordBalance;
        pAgg.value += ordValue;
        periodMap.set(pKey, pAgg);
      }

      // Employee aggregation
      const empName = normalizeDashboardEmployeeName(order.salesPerson);
      const eAgg = employeeMap.get(empName) || {
        name: empName,
        orders: 0,
        openOrders: 0,
        closedOrders: 0,
        itemLines: 0,
        orderQty: 0,
        dispatchQty: 0,
        balanceQty: 0,
        value: 0,
        dispatchedValue: 0,
        discountSum: 0,
        discountCount: 0
      };
      eAgg.orders += 1;
      if (isClosed) eAgg.closedOrders += 1;
      else eAgg.openOrders += 1;
      eAgg.itemLines += items.length;
      eAgg.orderQty += ordQty;
      eAgg.dispatchQty += ordDispatch;
      eAgg.balanceQty += ordBalance;
      eAgg.value += ordValue;
      eAgg.dispatchedValue += ordDispVal;
      items.forEach(it => {
        if ((Number(it.rate) || 0) > 0) {
          eAgg.discountSum += Number(it.discount) || 0;
          eAgg.discountCount += 1;
        }
      });
      employeeMap.set(empName, eAgg);

      // Customer aggregation
      const custName = (order.customerName || 'Unknown Customer').trim() || 'Unknown Customer';
      const cuAgg = customerMap.get(custName) || {
        name: custName,
        orders: 0,
        openOrders: 0,
        closedOrders: 0,
        orderQty: 0,
        dispatchQty: 0,
        balanceQty: 0,
        value: 0
      };
      cuAgg.orders += 1;
      if (isClosed) cuAgg.closedOrders += 1;
      else cuAgg.openOrders += 1;
      cuAgg.orderQty += ordQty;
      cuAgg.dispatchQty += ordDispatch;
      cuAgg.balanceQty += ordBalance;
      cuAgg.value += ordValue;
      customerMap.set(custName, cuAgg);

      // Transporter aggregation
      const trName = (colAKTransporters[order.orderKey] ?? order.transporterName ?? '').trim() || 'Not Assigned';
      const trAgg = transporterMap.get(trName) || {
        name: trName,
        orders: 0,
        dispatchQty: 0,
        orderQty: 0
      };
      trAgg.orders += 1;
      trAgg.dispatchQty += ordDispatch;
      trAgg.orderQty += ordQty;
      transporterMap.set(trName, trAgg);
    });

    const periodSeries = Array.from(periodMap.values())
      .sort((a, b) => a.sortWeight - b.sortWeight)
      .slice(-14); // Show up to latest 14 periods cleanly

    const employees = Array.from(employeeMap.values()).map(e => ({
      ...e,
      dispatchPct: e.orderQty > 0 ? Math.min(100, (e.dispatchQty / e.orderQty) * 100) : 0,
      closurePct: e.orders > 0 ? (e.closedOrders / e.orders) * 100 : 0,
      avgDiscount: e.discountCount > 0 ? e.discountSum / e.discountCount : 0
    }));

    employees.sort((a, b) => {
      if (employeeSort === 'value') return b.value - a.value;
      if (employeeSort === 'dispatchPct') return b.dispatchPct - a.dispatchPct;
      if (employeeSort === 'orders') return b.orders - a.orders;
      return b.orderQty - a.orderQty;
    });

    const units = Array.from(unitMap.values())
      .map(u => ({
        ...u,
        dispatchPct: u.orderQty > 0 ? Math.min(100, (u.dispatchQty / u.orderQty) * 100) : 0,
        sharePct: totalOrderQty > 0 ? (u.orderQty / totalOrderQty) * 100 : 0
      }))
      .sort((a, b) => b.orderQty - a.orderQty);

    const customers = Array.from(customerMap.values())
      .map(c => ({
        ...c,
        dispatchPct: c.orderQty > 0 ? Math.min(100, (c.dispatchQty / c.orderQty) * 100) : 0
      }))
      .sort((a, b) => {
        if (customerMetric === 'value') return b.value - a.value;
        if (customerMetric === 'balance') return b.balanceQty - a.balanceQty;
        if (customerMetric === 'orders') return b.orders - a.orders;
        return b.orderQty - a.orderQty;
      });

    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.orderQty - a.orderQty)
      .slice(0, 10);

    const topColors = Array.from(colorMap.values())
      .sort((a, b) => b.orderQty - a.orderQty)
      .slice(0, 10);

    const topTransporters = Array.from(transporterMap.values())
      .sort((a, b) => b.dispatchQty - a.dispatchQty || b.orders - a.orders)
      .slice(0, 10);

    const uomList = Array.from(uomMap.values())
      .sort((a, b) => b.orderQty - a.orderQty);

    watchlist.sort((a, b) => {
      if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
      return b.balanceQty - a.balanceQty;
    });

    const dispatchRatePct = totalOrderQty > 0 ? Math.min(100, (totalDispatchQty / totalOrderQty) * 100) : 0;
    const pendingRatePct = totalOrderQty > 0 ? Math.max(0, 100 - dispatchRatePct) : 0;
    const closureRatePct = totalOrders > 0 ? (closedOrdersCount / totalOrders) * 100 : 0;
    const avgDiscountPct = discountCount > 0 ? discountSum / discountCount : 0;

    return {
      totalOrders,
      openOrdersCount,
      inProgressOrdersCount,
      pureOpenOrdersCount: Math.max(0, openOrdersCount - inProgressOrdersCount),
      closedOrdersCount,
      totalItemLines,
      totalOrderQty,
      totalDispatchQty,
      totalBalanceQty,
      totalOrderValue,
      totalDispatchedValue,
      totalPendingValue,
      dispatchRatePct,
      pendingRatePct,
      closureRatePct,
      avgDiscountPct,
      zeroDispatchOpenCount,
      partialDispatchOpenCount,
      fullDispatchOpenCount,
      overdueOpenCount,
      totalPartDispatchLogs,
      periodSeries,
      employees,
      units,
      customers,
      topItems,
      topColors,
      topTransporters,
      uomList,
      watchlist: watchlist.slice(0, 12)
    };
  }, [filteredDataset, trendGranularity, employeeSort, customerMetric, colAKTransporters, dispatchHistoryMap]);

  const hasActiveFilter =
    selectedYear !== 'ALL' ||
    selectedQuarter !== 'ALL' ||
    selectedMonth !== 'ALL' ||
    selectedWeek !== 'ALL' ||
    selectedUnit !== 'ALL' ||
    selectedEmployee !== 'ALL' ||
    statusScope !== 'ALL';

  const handleResetFilters = () => {
    setSelectedYear('ALL');
    setSelectedQuarter('ALL');
    setSelectedMonth('ALL');
    setSelectedWeek('ALL');
    setSelectedUnit('ALL');
    setSelectedEmployee('ALL');
    setStatusScope('ALL');
  };

  const handleExportSummaryCSV = () => {
    const lines: string[] = [];
    lines.push('SECTION,NAME,TOTAL ORDERS,OPEN ORDERS,CLOSED ORDERS,ORDER QTY,DISPATCHED QTY,BALANCE QTY,DISPATCH %,EST SALES VALUE (INR)');
    analytics.employees.forEach(e => {
      lines.push(
        `Employee,"${e.name.replace(/"/g, '""')}",${e.orders},${e.openOrders},${e.closedOrders},${e.orderQty},${e.dispatchQty},${e.balanceQty},${e.dispatchPct.toFixed(1)}%,${Math.round(e.value)}`
      );
    });
    analytics.units.forEach(u => {
      lines.push(
        `Unit,"${u.unit.replace(/"/g, '""')}",${u.orders},${u.openOrders},${u.closedOrders},${u.orderQty},${u.dispatchQty},${u.balanceQty},${u.dispatchPct.toFixed(1)}%,${Math.round(u.value)}`
      );
    });
    analytics.customers.slice(0, 25).forEach(c => {
      lines.push(
        `Top Customer,"${c.name.replace(/"/g, '""')}",${c.orders},${c.openOrders},${c.closedOrders},${c.orderQty},${c.dispatchQty},${c.balanceQty},${c.dispatchPct.toFixed(1)}%,${Math.round(c.value)}`
      );
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ginza_business_dashboard_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // SVG Trend Chart Geometry
  const maxPeriodQty = useMemo(() => {
    const m = analytics.periodSeries.reduce((acc, p) => Math.max(acc, p.orderQty, p.dispatchQty), 0);
    return m > 0 ? m : 100;
  }, [analytics.periodSeries]);

  const activeHoveredPeriod = useMemo(() => {
    if (analytics.periodSeries.length === 0) return null;
    if (hoveredPeriodKey) {
      const found = analytics.periodSeries.find(p => p.key === hoveredPeriodKey);
      if (found) return found;
    }
    return analytics.periodSeries[analytics.periodSeries.length - 1];
  }, [analytics.periodSeries, hoveredPeriodKey]);

  // Donut Chart Calculations for Order Status Pipeline
  const donutSegments = useMemo(() => {
    const total = Math.max(1, analytics.totalOrders);
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const segs = [
      { label: 'Completed (Closed Orders)', count: analytics.closedOrdersCount, color: '#16A34A' },
      { label: 'In-Progress (Automation)', count: analytics.inProgressOrdersCount, color: '#D97706' },
      { label: 'Open (Automation)', count: analytics.pureOpenOrdersCount, color: '#2563EB' }
    ];
    let offset = 0;
    return segs.map(s => {
      const len = (s.count / total) * circumference;
      const item = { ...s, len, offset, pct: (s.count / total) * 100, circumference, radius };
      offset += len;
      return item;
    });
  }, [analytics]);

  const maxCustomerMetric = useMemo(() => {
    const top10 = analytics.customers.slice(0, 10);
    const m = top10.reduce((acc, c) => {
      const v =
        customerMetric === 'value' ? c.value
        : customerMetric === 'balance' ? c.balanceQty
        : customerMetric === 'orders' ? c.orders
        : c.orderQty;
      return Math.max(acc, v);
    }, 0);
    return m > 0 ? m : 1;
  }, [analytics.customers, customerMetric]);

  return (
    <div className="space-y-4 w-full max-w-full min-w-0 pb-6">
      {/* 1. UPPER FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-700" />
              <span>Executive Operations &amp; Sales Dashboard</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live combined analytics from Product Automation ({analytics.openOrdersCount} Open) &amp; Closed Orders ({analytics.closedOrdersCount} Completed)
              <span aria-hidden="true"> · </span>
              <span className="font-mono tabular-nums text-slate-700 font-semibold">{analytics.totalOrders}</span> matching orders
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Segmented Control */}
            <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setStatusScope('ALL')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusScope === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Orders
              </button>
              <button
                type="button"
                onClick={() => setStatusScope('AUTOMATION')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusScope === 'AUTOMATION' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Product Automation
              </button>
              <button
                type="button"
                onClick={() => setStatusScope('CLOSED')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusScope === 'CLOSED' ? 'bg-white text-indigo-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Closed Orders
              </button>
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportSummaryCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Summary</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Grid: Year, Quarter, Month, Week, Unit, Employee Name */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
          {/* Year */}
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3" />
              Year
            </span>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedWeek('ALL');
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15 cursor-pointer"
            >
              <option value="ALL">All Years</option>
              {filterOptions.years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>

          {/* Quarter */}
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-500 mb-1 block">Quarter</span>
            <select
              value={selectedQuarter}
              onChange={(e) => {
                const nextQ = e.target.value as 'ALL' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
                setSelectedQuarter(nextQ);
                setSelectedMonth('ALL');
                setSelectedWeek('ALL');
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15 cursor-pointer"
            >
              <option value="ALL">All Quarters</option>
              <option value="Q1">Q1 (Jan – Mar)</option>
              <option value="Q2">Q2 (Apr – Jun)</option>
              <option value="Q3">Q3 (Jul – Sep)</option>
              <option value="Q4">Q4 (Oct – Dec)</option>
            </select>
          </label>

          {/* Month */}
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-500 mb-1 block">Month</span>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedWeek('ALL');
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15 cursor-pointer"
            >
              <option value="ALL">All Months</option>
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>

          {/* Week */}
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-500 mb-1 block">Week</span>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15 cursor-pointer"
            >
              <option value="ALL">All Weeks</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="LAST_WEEK">Last Week</option>
              <option value="LAST_4_WEEKS">Last 4 Weeks</option>
              {availableWeeks.map(w => (
                <option key={w.key} value={w.key}>
                  {w.label} ({w.count})
                </option>
              ))}
            </select>
          </label>

          {/* Unit */}
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
              <Building2 className="w-3 h-3" />
              Unit
            </span>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15 cursor-pointer"
            >
              <option value="ALL">All Units ({filterOptions.units.length})</option>
              {filterOptions.units.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>

          {/* Employee Name */}
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
              <Users className="w-3 h-3" />
              Employee Name
            </span>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15 cursor-pointer"
            >
              <option value="ALL">All Employees ({filterOptions.employees.length})</option>
              {filterOptions.employees.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Empty State when filters match 0 records */}
      {analytics.totalOrders === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900">No orders match the selected dashboard filters</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Try widening your Year, Quarter, Month, Week, Unit, or Employee filter to inspect order &amp; dispatch analytics.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-4 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <>
          {/* 2. TOP KPI SUMMARY STRIP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* KPI 1: Total Orders */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-slate-500">Total Orders</div>
              <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {analytics.totalOrders.toLocaleString('en-IN')}
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
                {analytics.totalItemLines.toLocaleString('en-IN')} item lines
                <span aria-hidden="true"> · </span>
                <span className="text-emerald-700 font-semibold">{analytics.closedOrdersCount} closed</span>
              </div>
            </div>

            {/* KPI 2: Order Quantity (Col I) */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-slate-500">Order Quantity (Col I)</div>
              <div className="mt-1 text-2xl font-bold text-blue-700 font-mono tabular-nums">
                {formatQty(analytics.totalOrderQty)}
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500 font-mono tabular-nums truncate" title={analytics.uomList.map(u => `${u.uom}: ${formatQty(u.orderQty)}`).join(' · ')}>
                {analytics.uomList.slice(0, 2).map(u => `${u.uom}: ${formatQty(u.orderQty)}`).join(' · ') || 'Total ordered'}
              </div>
            </div>

            {/* KPI 3: Dispatched Quantity (Col U) */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-slate-500">Dispatched Qty (Col U)</div>
              <div className="mt-1 text-2xl font-bold text-emerald-700 font-mono tabular-nums">
                {formatQty(analytics.totalDispatchQty)}
              </div>
              <div className="mt-1.5 text-[11px] text-emerald-700 font-semibold font-mono tabular-nums">
                {analytics.dispatchRatePct.toFixed(1)}% fulfilled
                {analytics.totalPartDispatchLogs > 0 && (
                  <span className="text-slate-500 font-normal"> · {analytics.totalPartDispatchLogs} ledger logs</span>
                )}
              </div>
            </div>

            {/* KPI 4: Pending Balance Qty (Col V) */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-slate-500">Balance Pending (Col V)</div>
              <div className="mt-1 text-2xl font-bold text-amber-700 font-mono tabular-nums">
                {formatQty(analytics.totalBalanceQty)}
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
                {analytics.pendingRatePct.toFixed(1)}% remaining
                <span aria-hidden="true"> · </span>
                {analytics.zeroDispatchOpenCount} zero-dispatch
              </div>
            </div>

            {/* KPI 5: Estimated Net Sales Value */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-slate-500">Est. Order Value (Net)</div>
              <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {formatINR(analytics.totalOrderValue)}
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
                Dispatched: <span className="text-emerald-700 font-semibold">{formatINR(analytics.totalDispatchedValue)}</span>
                <span aria-hidden="true"> · </span>
                Disc {analytics.avgDiscountPct.toFixed(1)}%
              </div>
            </div>

            {/* KPI 6: Completion & Delivery Risk */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-slate-500">Order Closure &amp; Due Risk</div>
              <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {analytics.closureRatePct.toFixed(1)}%
              </div>
              <div className="mt-1.5 text-[11px] font-mono tabular-nums">
                <span className={analytics.overdueOpenCount > 0 ? 'text-rose-600 font-semibold' : 'text-emerald-700 font-semibold'}>
                  {analytics.overdueOpenCount} overdue open
                </span>
                <span aria-hidden="true" className="text-slate-400"> · </span>
                <span className="text-slate-500">{analytics.openOrdersCount} active</span>
              </div>
            </div>
          </div>

          {/* 3. PRIMARY CHART ROW: ORDER VS DISPATCH TREND + PIPELINE HEALTH */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Left (8 cols): Interactive Order Qty vs Dispatch Qty Trend */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span>Order Quantity vs Dispatched Quantity Trend</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Hover bars to inspect period volume, dispatch ratio, and net order value
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-[11px] text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
                      Order Qty
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                      Dispatched Qty
                    </span>
                  </div>

                  <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setTrendGranularity('monthly');
                        setHoveredPeriodKey(null);
                      }}
                      className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                        trendGranularity === 'monthly' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTrendGranularity('weekly');
                        setHoveredPeriodKey(null);
                      }}
                      className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                        trendGranularity === 'weekly' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Weekly
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Hovered / Latest Period Readout Strip */}
              {activeHoveredPeriod && (
                <div className="my-2.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-bold text-slate-900">{activeHoveredPeriod.label}</div>
                  <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-[11px]">
                    <span className="text-slate-600">
                      Orders: <strong className="text-slate-900">{activeHoveredPeriod.orders}</strong>
                    </span>
                    <span className="text-blue-700">
                      Ordered: <strong>{formatQty(activeHoveredPeriod.orderQty)}</strong>
                    </span>
                    <span className="text-emerald-700">
                      Dispatched: <strong>{formatQty(activeHoveredPeriod.dispatchQty)}</strong>
                    </span>
                    <span className="text-amber-700">
                      Balance: <strong>{formatQty(activeHoveredPeriod.balanceQty)}</strong>
                    </span>
                    <span className="text-slate-700">
                      Value: <strong>{formatINR(activeHoveredPeriod.value)}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* SVG Grouped Column Chart */}
              {analytics.periodSeries.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-xs text-slate-400">
                  No dated records available for trend chart
                </div>
              ) : (
                <div className="w-full overflow-x-auto fms-sheet-scroll pt-1">
                  <svg
                    viewBox={`0 0 ${Math.max(580, analytics.periodSeries.length * 64 + 60)} 230`}
                    className="w-full h-56 min-w-[480px]"
                    role="img"
                    aria-label="Order vs Dispatch Quantity Trend Chart"
                  >
                    {/* Horizontal Y Gridlines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                      const y = 185 - ratio * 155;
                      const tickVal = maxPeriodQty * ratio;
                      return (
                        <g key={idx}>
                          <line
                            x1={48}
                            y1={y}
                            x2={Math.max(560, analytics.periodSeries.length * 64 + 48)}
                            y2={y}
                            stroke="#E2E8F0"
                            strokeDasharray={ratio === 0 ? undefined : '3 3'}
                          />
                          <text
                            x={42}
                            y={y + 4}
                            textAnchor="end"
                            className="fill-slate-400 text-[10px] font-mono"
                          >
                            {formatShortAxis(tickVal)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Grouped Bars */}
                    {analytics.periodSeries.map((p, idx) => {
                      const chartWidth = Math.max(510, analytics.periodSeries.length * 64);
                      const slotW = chartWidth / analytics.periodSeries.length;
                      const cx = 48 + idx * slotW + slotW / 2;
                      const barW = Math.min(20, Math.max(10, slotW * 0.28));
                      const orderH = Math.max(2, (p.orderQty / maxPeriodQty) * 155);
                      const dispH = Math.max(p.dispatchQty > 0 ? 2 : 0, (p.dispatchQty / maxPeriodQty) * 155);
                      const isActive = activeHoveredPeriod?.key === p.key;

                      return (
                        <g
                          key={p.key}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredPeriodKey(p.key)}
                          onClick={() => setHoveredPeriodKey(p.key)}
                        >
                          {isActive && (
                            <rect
                              x={cx - slotW * 0.42}
                              y={24}
                              width={slotW * 0.84}
                              height={162}
                              rx={6}
                              fill="#F1F5F9"
                            />
                          )}
                          {/* Order Qty Bar */}
                          <rect
                            x={cx - barW - 2}
                            y={185 - orderH}
                            width={barW}
                            height={orderH}
                            rx={3}
                            fill={isActive ? '#1D4ED8' : '#3B82F6'}
                          />
                          {/* Dispatch Qty Bar */}
                          <rect
                            x={cx + 2}
                            y={185 - dispH}
                            width={barW}
                            height={dispH}
                            rx={3}
                            fill={isActive ? '#15803D' : '#16A34A'}
                          />
                          {/* X-Axis Period Label */}
                          <text
                            x={cx}
                            y={204}
                            textAnchor="middle"
                            className={`text-[10px] font-mono ${isActive ? 'fill-slate-900 font-bold' : 'fill-slate-500'}`}
                          >
                            {p.shortLabel}
                          </text>
                          {/* Fulfillment % Mini Label */}
                          <text
                            x={cx}
                            y={218}
                            textAnchor="middle"
                            className="fill-slate-400 text-[9px] font-mono"
                          >
                            {p.orderQty > 0 ? `${Math.round((p.dispatchQty / p.orderQty) * 100)}%` : '0%'}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>

            {/* Right (4 cols): Order Status Pipeline & Dispatch Health */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4 text-emerald-600" />
                  <span>Automation vs Closed Pipeline</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Order lifecycle split across Product Automation &amp; Closed Orders
                </p>
              </div>

              {/* Donut Chart + Center Stat */}
              <div className="flex items-center gap-4 my-4">
                <div className="relative w-32 h-32 shrink-0">
                  <svg viewBox="0 0 130 130" className="w-full h-full -rotate-90">
                    <circle cx="65" cy="65" r="52" fill="none" stroke="#F1F5F9" strokeWidth="14" />
                    {donutSegments.map(seg => (
                      <circle
                        key={seg.label}
                        cx="65"
                        cy="65"
                        r={seg.radius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="14"
                        strokeDasharray={`${seg.len} ${seg.circumference}`}
                        strokeDashoffset={-seg.offset}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                      {analytics.closureRatePct.toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">Completed</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2.5 text-xs min-w-0">
                  {donutSegments.map(seg => (
                    <div key={seg.label} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: seg.color }} />
                        <span className="text-slate-700 truncate">{seg.label}</span>
                      </div>
                      <span className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                        {seg.count} ({seg.pct.toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Open Order Dispatch Readiness Metrics */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-[10px] text-slate-500 font-medium">Zero Dispatch</div>
                  <div className="text-sm font-bold text-rose-700 font-mono tabular-nums mt-0.5">
                    {analytics.zeroDispatchOpenCount}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-[10px] text-slate-500 font-medium">Part Dispatch</div>
                  <div className="text-sm font-bold text-amber-700 font-mono tabular-nums mt-0.5">
                    {analytics.partialDispatchOpenCount}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-[10px] text-slate-500 font-medium">Ready to Close</div>
                  <div className="text-sm font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
                    {analytics.fullDispatchOpenCount}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. EMPLOYEE PERFORMANCE & UNIT-WISE SALE (2-COLUMN SPLIT) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
            {/* Employee Performance Table + Bars (7 cols) */}
            <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-4 flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-700" />
                    <span>Employee Performance (Sales Person)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Click any employee row to filter the entire dashboard · Orders, Dispatch %, Closure Rate &amp; Value
                  </p>
                </div>

                <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-[11px]">
                  {(
                    [
                      ['qty', 'Order Qty'],
                      ['value', 'Value (₹)'],
                      ['dispatchPct', 'Dispatch %'],
                      ['orders', 'Orders']
                    ] as Array<[EmployeeSortKey, string]>
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEmployeeSort(key)}
                      className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                        employeeSort === key ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto fms-sheet-scroll mt-2 flex-1">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] text-slate-500 font-semibold">
                      <th className="py-2 pr-3 text-left">Employee</th>
                      <th className="py-2 px-2 text-right">Orders</th>
                      <th className="py-2 px-2 text-right">Order Qty</th>
                      <th className="py-2 px-2 text-right">Dispatched</th>
                      <th className="py-2 px-2 text-right">Balance</th>
                      <th className="py-2 px-2 text-right">Dispatch %</th>
                      <th className="py-2 pl-2 text-right">Est. Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.employees.map((emp) => {
                      const isSelected = selectedEmployee === emp.name;
                      return (
                        <tr
                          key={emp.name}
                          onClick={() => setSelectedEmployee(prev => prev === emp.name ? 'ALL' : emp.name)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'
                          }`}
                          title={isSelected ? 'Click to clear employee filter' : `Click to filter dashboard by ${emp.name}`}
                        >
                          <td className="py-2.5 pr-3">
                            <div className="font-bold text-slate-900">{emp.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                              {emp.openOrders} open · {emp.closedOrders} closed ({emp.closurePct.toFixed(0)}%)
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-slate-800">
                            {emp.orders}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-blue-700">
                            {formatQty(emp.orderQty)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-emerald-700">
                            {formatQty(emp.dispatchQty)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-amber-700">
                            {formatQty(emp.balanceQty)}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <div className="inline-flex flex-col items-end gap-1 min-w-[68px]">
                              <span className="font-mono tabular-nums font-bold text-slate-800">
                                {emp.dispatchPct.toFixed(1)}%
                              </span>
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-600 rounded-full"
                                  style={{ width: `${Math.min(100, emp.dispatchPct)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 pl-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {formatINR(emp.value)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Unit-Wise Sale Chart + Breakdown (5 cols) */}
            <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-4 flex flex-col">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-700" />
                  <span>Unit-Wise Sale &amp; Dispatch</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Click any manufacturing unit to filter · Order share, Dispatched vs Pending qty &amp; Sales Value
                </p>
              </div>

              <div className="mt-3 space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1 fms-sheet-scroll">
                {analytics.units.map((u) => {
                  const isSelected = selectedUnit === u.unit;
                  const maxUnitQty = analytics.units[0]?.orderQty || 1;
                  const totalWidthPct = Math.max(4, (u.orderQty / maxUnitQty) * 100);
                  const dispRatio = u.orderQty > 0 ? Math.min(100, (u.dispatchQty / u.orderQty) * 100) : 0;

                  return (
                    <button
                      key={u.unit}
                      type="button"
                      onClick={() => setSelectedUnit(prev => prev === u.unit ? 'ALL' : u.unit)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-sky-50 border-sky-300'
                          : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-900 truncate">{u.unit}</span>
                        <span className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                          {formatINR(u.value)}
                        </span>
                      </div>

                      {/* Stacked Horizontal Volume Bar */}
                      <div className="mt-2 w-full h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-200 rounded-full overflow-hidden"
                          style={{ width: `${totalWidthPct}%` }}
                        >
                          <div
                            className="h-full bg-emerald-600"
                            style={{ width: `${dispRatio}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 font-mono tabular-nums">
                        <span>
                          {u.orders} orders ({u.openOrders} open · {u.closedOrders} closed)
                        </span>
                        <span>
                          Ord <strong className="text-blue-700">{formatQty(u.orderQty)}</strong>
                          {' · '}
                          Disp <strong className="text-emerald-700">{formatQty(u.dispatchQty)}</strong>
                          {' '}({u.dispatchPct.toFixed(0)}%)
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5. TOP CUSTOMERS CHART + PRODUCT / COLOR / TRANSPORTER INSIGHTS */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
            {/* Top Customers Horizontal Chart + Share Table (7 cols) */}
            <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-4 flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-slate-700" />
                    <span>Top 10 Customers</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Click any customer to inspect their orders directly inside Product Automation / Closed Orders
                  </p>
                </div>

                <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-[11px]">
                  {(
                    [
                      ['qty', 'Order Qty'],
                      ['value', 'Value (₹)'],
                      ['balance', 'Pending Qty'],
                      ['orders', 'Orders']
                    ] as Array<[CustomerMetricKey, string]>
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCustomerMetric(key)}
                      className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                        customerMetric === key ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 space-y-2.5 flex-1">
                {analytics.customers.slice(0, 10).map((cust, idx) => {
                  const metricVal =
                    customerMetric === 'value' ? cust.value
                    : customerMetric === 'balance' ? cust.balanceQty
                    : customerMetric === 'orders' ? cust.orders
                    : cust.orderQty;
                  const barPct = Math.max(3, (metricVal / maxCustomerMetric) * 100);
                  const targetTab = cust.openOrders > 0 ? 'automation' : 'closed';

                  return (
                    <div
                      key={cust.name}
                      className="group p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono tabular-nums text-[11px] font-bold text-slate-400 w-5 shrink-0">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <button
                            type="button"
                            onClick={() => onNavigateToOrder?.(targetTab, cust.name, 'customer')}
                            className="font-bold text-slate-900 hover:text-blue-700 truncate text-left inline-flex items-center gap-1 cursor-pointer"
                            title={`Open ${cust.name} in ${targetTab === 'automation' ? 'Product Automation' : 'Closed Orders'}`}
                          >
                            <span className="truncate">{cust.name}</span>
                            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0 text-blue-600" />
                          </button>
                        </div>

                        <div className="font-mono tabular-nums text-[11px] text-slate-700 shrink-0">
                          <span className="font-bold text-slate-900">
                            {customerMetric === 'value'
                              ? formatINR(cust.value)
                              : customerMetric === 'orders'
                                ? `${cust.orders} orders`
                                : formatQty(metricVal)}
                          </span>
                          <span className="text-slate-400"> · </span>
                          <span className="text-emerald-700">{cust.dispatchPct.toFixed(0)}% disp</span>
                        </div>
                      </div>

                      <div className="mt-1.5 ml-7 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              customerMetric === 'balance' ? 'bg-amber-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono tabular-nums shrink-0">
                          {cust.openOrders} open / {cust.closedOrders} closed · Bal {formatQty(cust.balanceQty)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right (5 cols): Top Products / Top Colors / Transporters / Unit of Item */}
            <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-4 flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Archive className="w-4 h-4 text-slate-700" />
                  <span>Catalog &amp; Logistics Insights</span>
                </h3>

                <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-[11px]">
                  {(
                    [
                      ['items', 'Top Items'],
                      ['colors', 'Colors'],
                      ['transporters', 'Transporters'],
                      ['uom', 'Unit Type']
                    ] as Array<[BreakdownTabKey, string]>
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBreakdownTab(key)}
                      className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                        breakdownTab === key ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-2 overflow-x-auto fms-sheet-scroll flex-1">
                {breakdownTab === 'items' && (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] text-slate-500 font-semibold">
                        <th className="py-2 pr-2 text-left">Item Name (Col E)</th>
                        <th className="py-2 px-2 text-right">Order Qty</th>
                        <th className="py-2 px-2 text-right">Disp Qty</th>
                        <th className="py-2 pl-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analytics.topItems.map(it => (
                        <tr key={it.itemName} className="hover:bg-slate-50">
                          <td className="py-2 pr-2">
                            <div className="font-semibold text-slate-900 truncate max-w-[190px]" title={it.itemName}>
                              {it.itemName}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                              {it.orders} lines · {it.uom} · {formatINR(it.value)}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums font-bold text-blue-700">
                            {formatQty(it.orderQty)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums font-semibold text-emerald-700">
                            {formatQty(it.dispatchQty)}
                          </td>
                          <td className="py-2 pl-2 text-right font-mono tabular-nums text-amber-700">
                            {formatQty(it.balanceQty)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {breakdownTab === 'colors' && (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] text-slate-500 font-semibold">
                        <th className="py-2 pr-2 text-left">Color (Col F)</th>
                        <th className="py-2 px-2 text-right">Lines</th>
                        <th className="py-2 px-2 text-right">Order Qty</th>
                        <th className="py-2 pl-2 text-right">Dispatched</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analytics.topColors.map(c => (
                        <tr key={c.color} className="hover:bg-slate-50">
                          <td className="py-2 pr-2 font-semibold text-slate-900">{c.color}</td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-600">{c.orders}</td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums font-bold text-blue-700">
                            {formatQty(c.orderQty)}
                          </td>
                          <td className="py-2 pl-2 text-right font-mono tabular-nums font-semibold text-emerald-700">
                            {formatQty(c.dispatchQty)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {breakdownTab === 'transporters' && (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] text-slate-500 font-semibold">
                        <th className="py-2 pr-2 text-left flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          Transporter (Col AK)
                        </th>
                        <th className="py-2 px-2 text-right">Orders</th>
                        <th className="py-2 pl-2 text-right">Dispatched Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analytics.topTransporters.map(tr => (
                        <tr key={tr.name} className="hover:bg-slate-50">
                          <td className="py-2 pr-2 font-semibold text-slate-900">{tr.name}</td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700">{tr.orders}</td>
                          <td className="py-2 pl-2 text-right font-mono tabular-nums font-bold text-emerald-700">
                            {formatQty(tr.dispatchQty)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {breakdownTab === 'uom' && (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] text-slate-500 font-semibold">
                        <th className="py-2 pr-2 text-left">Unit of Item (Col H)</th>
                        <th className="py-2 px-2 text-right">Lines</th>
                        <th className="py-2 px-2 text-right">Order Qty</th>
                        <th className="py-2 px-2 text-right">Dispatched</th>
                        <th className="py-2 pl-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analytics.uomList.map(m => (
                        <tr key={m.uom} className="hover:bg-slate-50">
                          <td className="py-2 pr-2 font-mono font-bold text-slate-900">{m.uom}</td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-600">{m.lines}</td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums font-bold text-blue-700">
                            {formatQty(m.orderQty)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums font-semibold text-emerald-700">
                            {formatQty(m.dispatchQty)}
                          </td>
                          <td className="py-2 pl-2 text-right font-mono tabular-nums text-amber-700">
                            {formatQty(m.balanceQty)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* 6. PRIORITY OPEN ORDERS WATCHLIST (OVERDUE & HIGHEST PENDING BALANCE) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Priority Dispatch Watchlist (Open Orders with Highest Pending / Overdue Qty)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Direct action list from Product Automation sorted by delivery overdue days and remaining balance
                </p>
              </div>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                Showing top {analytics.watchlist.length} pending open orders
              </span>
            </div>

            {analytics.watchlist.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No open pending balance orders in the selected filter scope.
              </div>
            ) : (
              <div className="overflow-x-auto fms-sheet-scroll mt-2">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] text-slate-500 font-semibold">
                      <th className="py-2 pr-3 text-left">Order No</th>
                      <th className="py-2 px-2 text-left">Customer</th>
                      <th className="py-2 px-2 text-left">Employee</th>
                      <th className="py-2 px-2 text-left">Unit</th>
                      <th className="py-2 px-2 text-left">Delivery Due</th>
                      <th className="py-2 px-2 text-right">Order Qty</th>
                      <th className="py-2 px-2 text-right">Dispatched</th>
                      <th className="py-2 px-2 text-right">Pending Bal</th>
                      <th className="py-2 pl-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.watchlist.map(row => (
                      <tr key={row.orderKey} className="hover:bg-slate-50">
                        <td className="py-2 pr-3 font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                          {row.orderNo}
                        </td>
                        <td className="py-2 px-2 font-semibold text-slate-900 max-w-[180px] truncate" title={row.customerName}>
                          {row.customerName}
                        </td>
                        <td className="py-2 px-2 text-slate-700 whitespace-nowrap">{row.salesPerson}</td>
                        <td className="py-2 px-2 text-slate-600 max-w-[130px] truncate" title={row.units}>
                          {row.units}
                        </td>
                        <td className="py-2 px-2 font-mono tabular-nums whitespace-nowrap">
                          <span className={row.daysOverdue > 0 ? 'text-rose-700 font-bold' : 'text-slate-700'}>
                            {row.deliveryDate}
                          </span>
                          {row.daysOverdue > 0 && (
                            <span className="ml-1.5 text-[10px] font-bold text-rose-600">
                              <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                              +{row.daysOverdue}d late
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-blue-700 font-semibold">
                          {formatQty(row.orderQty)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                          {formatQty(row.dispatchQty)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-amber-700 font-bold">
                          {formatQty(row.balanceQty)}
                        </td>
                        <td className="py-2 pl-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onNavigateToOrder?.('automation', row.orderNo !== 'Pending SO#' ? row.orderNo : row.customerName, row.orderNo !== 'Pending SO#' ? 'order_no' : 'customer')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-900 hover:text-white text-[11px] font-semibold text-slate-800 transition-colors cursor-pointer"
                          >
                            <span>Open</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
