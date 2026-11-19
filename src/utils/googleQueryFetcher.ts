import { ProductOrderRow } from '../types/fms';
import staticQueryOrders from '../data/ordersQueryData.json';

export const DEFAULT_QUERY_FORMULA = `=QUERY(
  IMPORTRANGE("1TksqSeCWat_0CRRPTxA0nAMiQFtUO17xUhtqHJM2JAs", "Orders!A:R"),
  "select Col1, Col2,Col8,Col9, Col10, Col11, Col12, Col13, Col14, Col15, Col16, Col17, Col18, Col3, Col4, Col5, Col6, Col7 ",
  1
)`;



export interface QueryColumnMapping {
  queryCol: string;         // e.g. "Col1"
  sourceColLetter: string;  // e.g. "A"
  sourceColIndex: number;   // 1-based (1..18)
  sourceHeader: string;     // e.g. "Timestamp"
  targetColLetter: string;  // e.g. "A"
  targetColIndex: number;   // 1-based (1..18)
  targetField: keyof ProductOrderRow;
  targetHeader: string;
  category: 'identity' | 'product' | 'customer' | 'logistics';
  description: string;
}

export const QUERY_COLUMN_MAPPINGS: QueryColumnMapping[] = [
  {
    queryCol: 'Col1',
    sourceColLetter: 'A',
    sourceColIndex: 1,
    sourceHeader: 'Timestamp',
    targetColLetter: 'A',
    targetColIndex: 1,
    targetField: 'timestamp',
    targetHeader: 'Timestamp',
    category: 'identity',
    description: 'Exact submission timestamp of the order'
  },
  {
    queryCol: 'Col2',
    sourceColLetter: 'B',
    sourceColIndex: 2,
    sourceHeader: 'Customer Name',
    targetColLetter: 'B',
    targetColIndex: 2,
    targetField: 'customerName',
    targetHeader: 'Customer Name',
    category: 'customer',
    description: 'Customer or buyer account name'
  },
  {
    queryCol: 'Col8',
    sourceColLetter: 'H',
    sourceColIndex: 8,
    sourceHeader: 'Order Date',
    targetColLetter: 'C',
    targetColIndex: 3,
    targetField: 'orderDate',
    targetHeader: 'Order Date',
    category: 'identity',
    description: 'Date the order was placed'
  },
  {
    queryCol: 'Col9',
    sourceColLetter: 'I',
    sourceColIndex: 9,
    sourceHeader: 'Unit',
    targetColLetter: 'D',
    targetColIndex: 4,
    targetField: 'unit',
    targetHeader: 'Unit',
    category: 'product',
    description: 'Manufacturing unit (e.g. WARP, EMB, TLU, CKU)'
  },
  {
    queryCol: 'Col10',
    sourceColLetter: 'J',
    sourceColIndex: 10,
    sourceHeader: 'Item Name',
    targetColLetter: 'E',
    targetColIndex: 5,
    targetField: 'itemName',
    targetHeader: 'Item Name',
    category: 'product',
    description: 'Fabric / product code or article name'
  },
  {
    queryCol: 'Col11',
    sourceColLetter: 'K',
    sourceColIndex: 11,
    sourceHeader: 'Color',
    targetColLetter: 'F',
    targetColIndex: 6,
    targetField: 'color',
    targetHeader: 'Color',
    category: 'product',
    description: 'Dye color, shade, or raw greige/RFD'
  },
  {
    queryCol: 'Col12',
    sourceColLetter: 'L',
    sourceColIndex: 12,
    sourceHeader: 'Width',
    targetColLetter: 'G',
    targetColIndex: 7,
    targetField: 'width',
    targetHeader: 'Width',
    category: 'product',
    description: 'Fabric width specification in inches'
  },
  {
    queryCol: 'Col13',
    sourceColLetter: 'M',
    sourceColIndex: 13,
    sourceHeader: 'Unit (of item)',
    targetColLetter: 'H',
    targetColIndex: 8,
    targetField: 'unitOfItem',
    targetHeader: 'Unit (of item)',
    category: 'product',
    description: 'Measurement unit (MTR, KG, PCS)'
  },
  {
    queryCol: 'Col14',
    sourceColLetter: 'N',
    sourceColIndex: 14,
    sourceHeader: 'Qty',
    targetColLetter: 'I',
    targetColIndex: 9,
    targetField: 'qty',
    targetHeader: 'Qty',
    category: 'product',
    description: 'Total quantity booked by customer'
  },
  {
    queryCol: 'Col15',
    sourceColLetter: 'O',
    sourceColIndex: 15,
    sourceHeader: 'Rate',
    targetColLetter: 'J',
    targetColIndex: 10,
    targetField: 'rate',
    targetHeader: 'Rate',
    category: 'product',
    description: 'Unit rate in INR (₹)'
  },
  {
    queryCol: 'Col16',
    sourceColLetter: 'P',
    sourceColIndex: 16,
    sourceHeader: 'Discount',
    targetColLetter: 'K',
    targetColIndex: 11,
    targetField: 'discount',
    targetHeader: 'Discount',
    category: 'product',
    description: 'Special trade discount percentage (%)'
  },
  {
    queryCol: 'Col17',
    sourceColLetter: 'Q',
    sourceColIndex: 17,
    sourceHeader: 'Delivery Date',
    targetColLetter: 'L',
    targetColIndex: 12,
    targetField: 'deliveryDate',
    targetHeader: 'Delivery Date',
    category: 'identity',
    description: 'Committed delivery date for shipment'
  },
  {
    queryCol: 'Col18',
    sourceColLetter: 'R',
    sourceColIndex: 18,
    sourceHeader: 'Remark',
    targetColLetter: 'M',
    targetColIndex: 13,
    targetField: 'remark',
    targetHeader: 'Remark',
    category: 'logistics',
    description: 'Special packing or transport instructions'
  },
  {
    queryCol: 'Col3',
    sourceColLetter: 'C',
    sourceColIndex: 3,
    sourceHeader: 'Customer Number',
    targetColLetter: 'N',
    targetColIndex: 14,
    targetField: 'customerNumber',
    targetHeader: 'Customer Number',
    category: 'customer',
    description: 'Client contact number for WhatsApp & notifications'
  },
  {
    queryCol: 'Col4',
    sourceColLetter: 'D',
    sourceColIndex: 4,
    sourceHeader: 'Billing Address',
    targetColLetter: 'O',
    targetColIndex: 15,
    targetField: 'billingAddress',
    targetHeader: 'Billing Address',
    category: 'customer',
    description: 'GST invoice registered billing address'
  },
  {
    queryCol: 'Col5',
    sourceColLetter: 'E',
    sourceColIndex: 5,
    sourceHeader: 'Delivery Address',
    targetColLetter: 'P',
    targetColIndex: 16,
    targetField: 'deliveryAddress',
    targetHeader: 'Delivery Address',
    category: 'logistics',
    description: 'Delivery destination / godown address'
  },
  {
    queryCol: 'Col6',
    sourceColLetter: 'F',
    sourceColIndex: 6,
    sourceHeader: 'Sales Person Name',
    targetColLetter: 'Q',
    targetColIndex: 17,
    targetField: 'salesPerson',
    targetHeader: 'Sales Person Name',
    category: 'logistics',
    description: 'Executive managing this client order'
  },
  {
    queryCol: 'Col7',
    sourceColLetter: 'G',
    sourceColIndex: 7,
    sourceHeader: 'Sales Person Contact',
    targetColLetter: 'R',
    targetColIndex: 18,
    targetField: 'salesPersonContact',
    targetHeader: 'Sales Person Contact',
    category: 'logistics',
    description: 'Sales person direct phone number'
  }
];

// Dual Google Spreadsheet IDs & Tab Configurations
export const AUTOMATION_SPREADSHEET_ID = "1xSSZ6DyQarQJOd8UpOfCV-tjdKL1oQq_IKuXJkcRv5Q";
export const AUTOMATION_TAB_NAME = "Product Automation";
export const PRODUCT_ORDER_GID = "0";
export const PRODUCT_AUTOMATION_GID = "1541274744";

export const QUERY_SPREADSHEET_ID = "1TksqSeCWat_0CRRPTxA0nAMiQFtUO17xUhtqHJM2JAs";
export const SPREADSHEET_ID = QUERY_SPREADSHEET_ID;
export const SOURCE_TAB_NAME = "Product Automation"; // Default to full 43-column sheet
export const ORDERS_TAB_NAME = "Orders";
export const PRODUCT_ORDER_TAB_NAME = "Product Order";
export const SOURCE_RANGE = "Product Automation!A:AQ";
export const WEB_APP_URL_STORAGE_KEY = "ginza_fms_apps_script_webapp_url_v1";

// Helper: robust CSV string parser handling quoted multiline cells
export function parseCsvRows(text: string): string[][] {
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
    } else if (char === ',' && !inQuotes) {
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
}

const splitLines = (val?: string): string[] => {
  if (!val) return [];
  return val.split(/\r?\n/).map(s => s.trim());
};

const parseNum = (val?: string): number => {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

// Convert CSV text from Google Sheet into ProductOrderRow[]
// Auto-detects 43-column Product Automation layout (including multi-line item cells) vs 19-column Product Order layout
export function transformOrdersCsvToProductOrderRows(csvText: string): ProductOrderRow[] {
  const parsed = parseCsvRows(csvText);
  if (parsed.length <= 1) return [];

  const results: ProductOrderRow[] = [];
  const header = parsed[0].map(h => (h || '').trim().toLowerCase());

  // Detect format based on column count and headers
  const is43ColFormat =
    parsed[0].length >= 26 ||
    header.some(h => h.includes('dispatch') || h.includes('balance') || h.includes('open / close'));
  const isRawOrdersForm = !is43ColFormat && (header[2]?.includes('customer') || header[13]?.includes('qty'));

  for (let i = 1; i < parsed.length; i++) {
    const r = parsed[i];
    if (!r || r.length < 2) continue;

    // Skip completely empty or checkbox-only trailing template rows
    if (!r.slice(0, 19).some(v => v.trim() !== '')) continue;

    const sheetRowIndex = i + 1; // 1-based Google Sheet row number (row 1 = header)

    if (is43ColFormat) {
      // 43-COLUMN "Product Automation" LAYOUT (Cols A to AQ)
      const timestamp = (r[0] || '').trim();
      const customerName = (r[1] || '').trim();
      const orderDate = (r[2] || '').trim();
      const remark = (r[12] || '').trim();
      const customerNumber = (r[13] || '').trim();
      const billingAddress = (r[14] || '').trim();
      const deliveryAddress = (r[15] || '').trim();
      const salesPerson = (r[16] || '').trim();
      const salesPersonContact = (r[17] || '').trim();
      const orderNo = (r[18] || '').trim();
      const customerMailId = (r[19] || '').trim();

      const accountStatus = (r[22] || '').trim();        // Col W
      const operationalRemark = (r[23] || '').trim();    // Col X
      const approvalStatus = (r[24] || '').trim() || 'APPROVED'; // Col Y
      const orderNoTimestamp = (r[25] || '').trim();     // Col Z
      const confirmationMsg = (r[28] || '').trim();      // Col AC
      const followUp1Raw = (r[30] || '').trim().toLowerCase(); // Col AE
      const followUp1 = followUp1Raw === 'true' || followUp1Raw === '✓' || followUp1Raw === 'yes';
      const followUp1Timestamp = (r[31] || '').trim();   // Col AF
      const followUp1Remark = (r[32] || '').trim();      // Col AG
      const followUp2Raw = (r[33] || '').trim().toLowerCase(); // Col AH
      const followUp2 = followUp2Raw === 'true' || followUp2Raw === '✓' || followUp2Raw === 'yes';
      const followUp2Timestamp = (r[34] || '').trim();   // Col AI
      const followUp2Remark = (r[35] || '').trim();      // Col AJ
      const transporterName = (r[36] || '').trim();      // Col AK
      const lrNumber = (r[37] || '').trim();             // Col AL

      // STRICT COL AM (index 38): "Open / Close" -> Complete vs Open
      const colAM = (r[38] || '').trim().toLowerCase();
      let statusAM: 'Open' | 'In-Progress' | 'Complete' | 'Closed' = 'Open';
      if (colAM === 'complete' || colAM === 'completed' || colAM === 'closed' || colAM === 'close' || colAM === 'done') {
        statusAM = 'Complete';
      } else if (colAM.includes('progress') || colAM.includes('partial')) {
        statusAM = 'In-Progress';
      } else {
        statusAM = 'Open';
      }

      // Col AN (index 39): Delivered WhatsApp Msg ("Sent" / "Message Sent" / "")
      const rawAN = (r[39] || '').trim();
      const deliveredWhatsappMsg = rawAN.toLowerCase() === 'sent' ? 'Message Sent' : (rawAN || 'Pending');
      const deliveryEmail = (r[41] || '').trim();        // Col AP

      // Multi-line item cells (Cols D..L, U, V)
      const units = splitLines(r[3]);
      const items = splitLines(r[4]);
      const colors = splitLines(r[5]);
      const widths = splitLines(r[6]);
      const uoms = splitLines(r[7]);
      const qtys = splitLines(r[8]);
      const rates = splitLines(r[9]);
      const discounts = splitLines(r[10]);
      const delivDates = splitLines(r[11]);
      const dispatches = splitLines(r[20]);
      const balances = splitLines(r[21]);

      const lineCount = Math.max(1, items.length, qtys.length);
      const orderGroupKey = `PA_R${sheetRowIndex}_${orderNo || timestamp}_${customerName}`;

      for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
        const unit = units[lineIdx] ?? units[0] ?? '';
        const itemName = items[lineIdx] ?? items[0] ?? '';
        const color = colors[lineIdx] ?? colors[0] ?? '';
        const width = widths[lineIdx] ?? widths[0] ?? '';
        const unitOfItem = uoms[lineIdx] ?? uoms[0] ?? 'MTR';
        const qty = parseNum(qtys[lineIdx] ?? qtys[0]);
        const rate = parseNum(rates[lineIdx] ?? rates[0]);
        const discount = parseNum(discounts[lineIdx] ?? discounts[0]);
        const deliveryDate = delivDates[lineIdx] ?? delivDates[0] ?? '';

        const rawDispStr = dispatches[lineIdx] !== undefined ? dispatches[lineIdx] : (lineCount === 1 ? dispatches[0] : '');
        const dispatchQty = parseNum(rawDispStr);

        const rawBalStr = balances[lineIdx] !== undefined ? balances[lineIdx] : (lineCount === 1 ? balances[0] : '');
        const balanceQty = rawBalStr !== '' ? parseNum(rawBalStr) : Number((qty - dispatchQty).toFixed(4));

        results.push({
          orderId: `ORD-AUTO-${sheetRowIndex}-${lineIdx + 1}`,
          referenceNo: `ROW-${sheetRowIndex}`,
          sheetRowIndex,
          orderGroupKey,
          timestamp,
          customerName,
          customerNumber,
          customerEmail: customerMailId,
          customerMailId,
          billingAddress,
          deliveryAddress,
          salesPerson,
          salesPersonContact,
          orderDate,
          unit,
          itemName,
          color,
          width,
          unitOfItem: unitOfItem || 'MTR',
          qty,
          rate,
          discount,
          deliveryDate,
          remark: remark || operationalRemark,
          operationalRemark,
          orderNo,
          orderNoTimestamp: orderNoTimestamp || (orderNo ? timestamp : ''),
          accountStatus,
          approvalStatus,
          transporterName,
          lrNumber,
          confirmationMsg,
          followUp1,
          followUp1Timestamp,
          followUp1Remark,
          followUp2,
          followUp2Timestamp,
          followUp2Remark,
          deliveredWhatsappMsg,
          deliveryEmail,
          statusAN: statusAM,
          dispatchQty,
          balanceQty
        });
      }
    } else if (isRawOrdersForm) {
      // Raw Google Form "Orders!A:R" layout
      const timestamp = (r[0] || '').trim();
      const customerName = (r[1] || '').trim();
      const customerNumber = (r[2] || '').trim();
      const billingAddress = (r[3] || '').trim();
      const deliveryAddress = (r[4] || '').trim();
      const salesPerson = (r[5] || '').trim();
      const salesPersonContact = (r[6] || '').trim();
      const orderDate = (r[7] || '').trim();
      const unit = (r[8] || '').trim();
      const itemName = (r[9] || '').trim();
      const color = (r[10] || '').trim();
      const width = (r[11] || '').trim();
      const unitOfItem = (r[12] || '').trim();
      const qty = parseNum(r[13]);
      const rate = parseNum(r[14]);
      const discount = parseNum(r[15]);
      const deliveryDate = (r[16] || '').trim();
      const remark = (r[17] || '').trim();
      const orderNo = (r[18] || '').trim();

      results.push({
        orderId: `ORD-Q-${sheetRowIndex}`,
        referenceNo: `ROW-${sheetRowIndex}`,
        sheetRowIndex,
        timestamp,
        customerName,
        customerNumber,
        billingAddress,
        deliveryAddress,
        salesPerson,
        salesPersonContact,
        orderDate,
        unit,
        itemName,
        color,
        width,
        unitOfItem: unitOfItem || 'MTR',
        qty,
        rate,
        discount,
        deliveryDate,
        remark,
        orderNo,
        orderNoTimestamp: orderNo ? timestamp : '',
        statusAN: 'Open',
        dispatchQty: 0,
        balanceQty: qty
      });
    } else {
      // Standard 19-Column "Product Order" layout (Cols A to S)
      const timestamp = (r[0] || '').trim();
      const customerName = (r[1] || '').trim();
      const orderDate = (r[2] || '').trim();
      const unit = (r[3] || '').trim();
      const itemName = (r[4] || '').trim();
      const color = (r[5] || '').trim();
      const width = (r[6] || '').trim();
      const unitOfItem = (r[7] || '').trim();
      const qty = parseNum(r[8]);
      const rate = parseNum(r[9]);
      const discount = parseNum(r[10]);
      const deliveryDate = (r[11] || '').trim();
      const remark = (r[12] || '').trim();
      const customerNumber = (r[13] || '').trim();
      const billingAddress = (r[14] || '').trim();
      const deliveryAddress = (r[15] || '').trim();
      const salesPerson = (r[16] || '').trim();
      const salesPersonContact = (r[17] || '').trim();
      const orderNo = (r[18] || '').trim();

      results.push({
        orderId: `ORD-PO-${sheetRowIndex}`,
        referenceNo: `ROW-${sheetRowIndex}`,
        sheetRowIndex,
        timestamp,
        customerName,
        customerNumber,
        billingAddress,
        deliveryAddress,
        salesPerson,
        salesPersonContact,
        orderDate,
        unit,
        itemName,
        color,
        width,
        unitOfItem: unitOfItem || 'MTR',
        qty,
        rate,
        discount,
        deliveryDate,
        remark,
        orderNo,
        orderNoTimestamp: orderNo ? timestamp : '',
        statusAN: 'Open',
        dispatchQty: 0,
        balanceQty: qty
      });
    }
  }

  return results;
}

// Fetch CSV using Google Export endpoint (preserves all rows & multi-line cells) with gviz fallback
async function fetchSheetCsvByGidOrName(
  sheetId: string,
  gid?: string,
  tabName?: string
): Promise<string | null> {
  const urls: string[] = [];
  if (gid !== undefined && gid !== '') {
    urls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`);
  }
  if (tabName) {
    urls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`);
  }

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const txt = await res.text();
      if (!txt || txt.startsWith('<!DOCTYPE html>') || txt.includes('<html')) continue;
      return txt;
    } catch (e) {
      // try next URL
    }
  }
  return null;
}

// Fetch BOTH "Product Order" (gid=0) AND "Product Automation" (gid=1541274744) live in parallel!
export async function fetchBothLiveGoogleSheets(
  sheetId: string = AUTOMATION_SPREADSHEET_ID
): Promise<{
  productOrderRows: ProductOrderRow[];
  automationRows: ProductOrderRow[];
  source: 'live' | 'snapshot';
  fetchedAt: string;
}> {
  const [poCsv, paCsv] = await Promise.all([
    fetchSheetCsvByGidOrName(sheetId, PRODUCT_ORDER_GID, PRODUCT_ORDER_TAB_NAME),
    fetchSheetCsvByGidOrName(sheetId, PRODUCT_AUTOMATION_GID, AUTOMATION_TAB_NAME)
  ]);

  const parsedPO = poCsv ? transformOrdersCsvToProductOrderRows(poCsv) : [];
  const parsedPA = paCsv ? transformOrdersCsvToProductOrderRows(paCsv) : [];

  if (parsedPO.length > 0 || parsedPA.length > 0) {
    const staticRows = (staticQueryOrders as any[]) as ProductOrderRow[];
    return {
      productOrderRows: parsedPO.length > 0 ? parsedPO : staticRows,
      automationRows: parsedPA,
      source: 'live',
      fetchedAt: new Date().toLocaleTimeString('en-IN', { hour12: true })
    };
  }

  const staticRows = (staticQueryOrders as any[]) as ProductOrderRow[];
  return {
    productOrderRows: staticRows,
    automationRows: [],
    source: 'snapshot',
    fetchedAt: new Date().toLocaleTimeString('en-IN', { hour12: true })
  };
}

// Fetch live from Google Sheet (supports both Product Automation 43-cols and Product Order)
export async function fetchLiveGoogleQueryData(
  sheetId: string = AUTOMATION_SPREADSHEET_ID,
  tabName: string = AUTOMATION_TAB_NAME
): Promise<{ rows: ProductOrderRow[]; source: 'live' | 'snapshot'; totalCount: number; fetchedAt: string; sheetTab: string }> {
  const isProductOrderTab = tabName.toLowerCase().includes('product order');
  const gid = sheetId === AUTOMATION_SPREADSHEET_ID
    ? (isProductOrderTab ? PRODUCT_ORDER_GID : PRODUCT_AUTOMATION_GID)
    : undefined;

  const csvText = await fetchSheetCsvByGidOrName(sheetId, gid, tabName);
  if (csvText) {
    const rows = transformOrdersCsvToProductOrderRows(csvText);
    if (rows.length > 0) {
      return {
        rows,
        source: 'live',
        totalCount: rows.length,
        fetchedAt: new Date().toLocaleTimeString('en-IN', { hour12: true }),
        sheetTab: tabName
      };
    }
  }

  // Fallback to static snapshot if offline or permissions error
  console.warn('Live Google Sheet fetch failed, using static snapshot fallback');
  const staticRows = (staticQueryOrders as any[]) as ProductOrderRow[];
  return {
    rows: staticRows,
    source: 'snapshot',
    totalCount: staticRows.length,
    fetchedAt: new Date().toLocaleTimeString('en-IN', { hour12: true }),
    sheetTab: 'Snapshot'
  };
}

export interface SheetWritePayload {
  action: 'updateOrderNo' | 'updateDispatchQty' | 'updateStatusAM' | 'addOrderRow';
  sheetRowIndex?: number;
  timestamp?: string;
  customerName?: string;
  itemName?: string;
  orderNo?: string;
  dispatchQty?: number;
  statusAM?: string;
  rowData?: Partial<ProductOrderRow>;
}

// Push write-back updates from App -> Google Sheet via Apps Script Web App
export async function pushOrderUpdateToGoogleSheet(
  webAppUrl: string,
  payload: SheetWritePayload
): Promise<{ ok: boolean; message: string }> {
  if (!webAppUrl || !webAppUrl.trim().startsWith('https://script.google.com/')) {
    return { ok: false, message: 'Apps Script Web App URL not configured.' };
  }

  try {
    // text/plain avoids CORS preflight on Google Apps Script Web Apps
    const res = await fetch(webAppUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      return { ok: false, message: `Google Apps Script returned HTTP ${res.status}` };
    }

    try {
      const data = await res.json();
      return {
        ok: data.status === 'success' || data.ok === true,
        message: data.message || 'Saved to Google Sheet!'
      };
    } catch {
      return { ok: true, message: 'Synced to Google Sheet!' };
    }
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Network error while writing to Google Sheet.'
    };
  }
}
