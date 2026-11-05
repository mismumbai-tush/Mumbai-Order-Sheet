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

export const QUERY_SPREADSHEET_ID = "1TksqSeCWat_0CRRPTxA0nAMiQFtUO17xUhtqHJM2JAs";
export const SPREADSHEET_ID = QUERY_SPREADSHEET_ID;
export const SOURCE_TAB_NAME = "Product Automation"; // Default to full 43-column sheet
export const ORDERS_TAB_NAME = "Orders";
export const PRODUCT_ORDER_TAB_NAME = "Product Order";
export const SOURCE_RANGE = "Product Automation!A:AQ";

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

// Convert CSV text from Google Sheet into ProductOrderRow[]
// Auto-detects 43-column Product Automation layout vs 19-column Product Order layout
export function transformOrdersCsvToProductOrderRows(csvText: string): ProductOrderRow[] {
  const parsed = parseCsvRows(csvText);
  if (parsed.length <= 1) return [];

  const results: ProductOrderRow[] = [];
  const header = parsed[0].map(h => (h || '').trim().toLowerCase());

  // Detect format based on column count and headers
  const is43ColFormat = parsed[0].length >= 26 || header.some(h => h.includes('dispatch') || h.includes('balance'));
  const isRawOrdersForm = !is43ColFormat && (header[2]?.includes('customer') || header[13]?.includes('qty'));

  for (let i = 1; i < parsed.length; i++) {
    const r = parsed[i];
    if (!r || r.length < 2) continue;

    // Check if empty line
    if (!r.slice(0, 15).some(v => v.trim() !== '')) continue;

    if (is43ColFormat) {
      // ==============================================================
      // 43-COLUMN "Product Automation" LAYOUT (Columns A to AQ)
      // Col A (0):  Timestamp
      // Col B (1):  Customer Name
      // Col C (2):  Order Date
      // Col D (3):  Unit
      // Col E (4):  Item Name
      // Col F (5):  Color
      // Col G (6):  Width
      // Col H (7):  Unit (of item)
      // Col I (8):  Qty
      // Col J (9):  Rate
      // Col K (10): Discount
      // Col L (11): Delivery Date
      // Col M (12): Remark
      // Col N (13): Customer Number
      // Col O (14): Billing Address
      // Col P (15): Delivery Address
      // Col Q (16): Sales Person Name
      // Col R (17): Sales Person Contact
      // Col S (18): Order No
      // Col T (19): Customer Mail Id
      // Col U (20): Dispatch Qnt (VALUE FROM GOOGLE SHEET FORMULA / ENTRY!)
      // Col V (21): Balance Qnt (=I - U)
      // Col W (22): Status (Operational / Account)
      // Col X (23): Remark
      // Col Y (24): Approval
      // Col Z (25): Approval Timestamp
      // Col AA-AJ: Confirmation & Follow-ups
      // Col AK (36): Transport Name
      // Col AL (37): LR- Number
      // Col AM (38): Open / Close
      // Col AN (39): Delivered Whatspp Msg / Status AN
      // ==============================================================
      const timestamp = (r[0] || '').trim();
      const customerName = (r[1] || '').trim();
      const orderDate = (r[2] || '').trim();
      const unit = (r[3] || '').trim();
      const itemName = (r[4] || '').trim();
      const color = (r[5] || '').trim();
      const width = (r[6] || '').trim();
      const unitOfItem = (r[7] || '').trim();
      const qty = parseFloat((r[8] || '').replace(/,/g, '')) || 0;
      const rate = parseFloat((r[9] || '').replace(/,/g, '')) || 0;
      const discount = parseFloat((r[10] || '').replace(/,/g, '')) || 0;
      const deliveryDate = (r[11] || '').trim();
      const remark = (r[12] || '').trim();
      const customerNumber = (r[13] || '').trim();
      const billingAddress = (r[14] || '').trim();
      const deliveryAddress = (r[15] || '').trim();
      const salesPerson = (r[16] || '').trim();
      const salesPersonContact = (r[17] || '').trim();
      const orderNo = (r[18] || '').trim();
      const customerMailId = (r[19] || '').trim();

      // Parse Col U: Dispatch Qnt (Google Sheet formula or manual value)
      const rawDispatch = r[20] !== undefined ? (r[20] || '').trim() : '';
      const dispatchQty = rawDispatch ? (parseFloat(rawDispatch.replace(/,/g, '')) || 0) : 0;

      // Parse Col V: Balance Qnt (=I - U)
      const rawBalance = r[21] !== undefined ? (r[21] || '').trim() : '';
      const balanceQty = rawBalance !== ''
        ? (parseFloat(rawBalance.replace(/,/g, '')) || Math.max(0, qty - dispatchQty))
        : Math.max(0, qty - dispatchQty);

      const accountStatus = (r[22] || '').trim();
      const operationalRemark = (r[23] || '').trim();
      const approvalStatus = (r[24] || '').trim() || 'APPROVED';
      const orderNoTimestamp = (r[25] || '').trim();
      const transporterName = (r[36] || '').trim();
      const lrNumber = (r[37] || '').trim();

      // Check Col AN (39), Col AM (38), Col W (22) for Complete / Closed status
      const colAN = (r[39] || '').trim().toLowerCase();
      const colAM = (r[38] || '').trim().toLowerCase();
      const colW = (r[22] || '').trim().toLowerCase();

      let statusAN: 'Open' | 'In-Progress' | 'Complete' | 'Closed' = 'Open';
      if (
        colAN === 'complete' || colAN === 'closed' || colAN === 'done' || colAN.includes('complete') ||
        colAM === 'complete' || colAM === 'closed' || colAM === 'done' || colAM.includes('complete') ||
        colW === 'complete' || colW === 'closed' || colW === 'done'
      ) {
        statusAN = 'Complete';
      } else if (
        colAN.includes('progress') || colAM.includes('progress') || colW.includes('progress') ||
        colAN.includes('partial') || colAM.includes('partial')
      ) {
        statusAN = 'In-Progress';
      } else if (balanceQty <= 0 && qty > 0) {
        // Automatic completion when balance reaches zero
        statusAN = 'Complete';
      }

      results.push({
        orderId: `ORD-AUTO-${i}`,
        referenceNo: `REF-${i}`,
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
        orderNo,
        orderNoTimestamp: orderNoTimestamp || (orderNo ? timestamp : ''),
        accountStatus,
        approvalStatus,
        transporterName,
        lrNumber,
        statusAN,
        dispatchQty,
        balanceQty
      });
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
      const qty = parseFloat((r[13] || '').replace(/,/g, '')) || 0;
      const rate = parseFloat((r[14] || '').replace(/,/g, '')) || 0;
      const discount = parseFloat((r[15] || '').replace(/,/g, '')) || 0;
      const deliveryDate = (r[16] || '').trim();
      const remark = (r[17] || '').trim();
      const orderNo = (r[18] || '').trim();

      results.push({
        orderId: `ORD-Q-${i}`,
        referenceNo: `REF-${i}`,
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
      const qty = parseFloat((r[8] || '').replace(/,/g, '')) || 0;
      const rate = parseFloat((r[9] || '').replace(/,/g, '')) || 0;
      const discount = parseFloat((r[10] || '').replace(/,/g, '')) || 0;
      const deliveryDate = (r[11] || '').trim();
      const remark = (r[12] || '').trim();
      const customerNumber = (r[13] || '').trim();
      const billingAddress = (r[14] || '').trim();
      const deliveryAddress = (r[15] || '').trim();
      const salesPerson = (r[16] || '').trim();
      const salesPersonContact = (r[17] || '').trim();
      const orderNo = (r[18] || '').trim();

      results.push({
        orderId: `ORD-PO-${i}`,
        referenceNo: `REF-${i}`,
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

// Fetch live from Google Sheet (supports both Product Automation 43-cols and Product Order)
export async function fetchLiveGoogleQueryData(
  sheetId: string = AUTOMATION_SPREADSHEET_ID,
  tabName: string = AUTOMATION_TAB_NAME
): Promise<{ rows: ProductOrderRow[]; source: 'live' | 'snapshot'; totalCount: number; fetchedAt: string; sheetTab: string }> {
  // Try fetching the requested sheet tab first
  const candidateUrls = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`,
    // Fallback to alternative sheet ID or tab name
    `https://docs.google.com/spreadsheets/d/${AUTOMATION_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Product%20Automation`,
    `https://docs.google.com/spreadsheets/d/${QUERY_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Orders`
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;

      const csvText = await res.text();
      if (!csvText || csvText.startsWith('<!DOCTYPE html>') || csvText.includes('<html')) {
        continue;
      }

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
    } catch (e) {
      // Continue to next candidate URL
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
