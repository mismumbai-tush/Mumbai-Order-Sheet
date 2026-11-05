import { GroupedOrder, ProductOrderRow, ColumnMapItem } from '../types/fms';
import staticQueryOrders from './ordersQueryData.json';

// Exact 19 Columns for the "Product Order" sheet (A-S)
export const productOrderColumns: Array<{ id: string; label: string; index: number; colLetter: string; minWidth?: string }> = [
  { id: 'timestamp', label: 'Timestamp', index: 1, colLetter: 'A', minWidth: '105px' },
  { id: 'customerName', label: 'Customer Name', index: 2, colLetter: 'B', minWidth: '130px' },
  { id: 'orderDate', label: 'Order Date', index: 3, colLetter: 'C', minWidth: '80px' },
  { id: 'unit', label: 'Unit', index: 4, colLetter: 'D', minWidth: '85px' },
  { id: 'itemName', label: 'Item Name', index: 5, colLetter: 'E', minWidth: '120px' },
  { id: 'color', label: 'Color', index: 6, colLetter: 'F', minWidth: '65px' },
  { id: 'width', label: 'Width', index: 7, colLetter: 'G', minWidth: '60px' },
  { id: 'unitOfItem', label: 'Unit (of item)', index: 8, colLetter: 'H', minWidth: '60px' },
  { id: 'qty', label: 'Qty', index: 9, colLetter: 'I', minWidth: '65px' },
  { id: 'rate', label: 'Rate', index: 10, colLetter: 'J', minWidth: '65px' },
  { id: 'discount', label: 'Discount', index: 11, colLetter: 'K', minWidth: '60px' },
  { id: 'deliveryDate', label: 'Delivery Date', index: 12, colLetter: 'L', minWidth: '80px' },
  { id: 'remark', label: 'Remark', index: 13, colLetter: 'M', minWidth: '110px' },
  { id: 'customerNumber', label: 'Customer Number', index: 14, colLetter: 'N', minWidth: '95px' },
  { id: 'billingAddress', label: 'Billing Address', index: 15, colLetter: 'O', minWidth: '120px' },
  { id: 'deliveryAddress', label: 'Delivery Address', index: 16, colLetter: 'P', minWidth: '120px' },
  { id: 'salesPerson', label: 'Sales Person Name', index: 17, colLetter: 'Q', minWidth: '100px' },
  { id: 'salesPersonContact', label: 'Sales Person Contact', index: 18, colLetter: 'R', minWidth: '95px' },
  { id: 'orderNo', label: 'Order Number', index: 19, colLetter: 'S', minWidth: '110px' }
];

// Locked Real Orders Synced from Google Sheet 1TksqSeCWat_0CRRPTxA0nAMiQFtUO17xUhtqHJM2JAs (Orders!A:R)
// Zero Delhi mock data — 100% genuine Mumbai / HO live orders
export const initialRawResponses: ProductOrderRow[] = (staticQueryOrders as ProductOrderRow[]) || [];

// Initial pre-existing dispatch values for Column Y
export const initialExistingDispatch: Record<string, number> = {};

// Complete 43-Column Architecture Mapping (A to AQ)
export const fmsColumnMapping: ColumnMapItem[] = [
  { sheetCol: "A", colIndex1Based: 1, arrayIndex0Based: 0, name: "Timestamp", category: "header-merge", description: "Submission date and time", example: "9/13/2025 13:37:15" },
  { sheetCol: "B", colIndex1Based: 2, arrayIndex0Based: 1, name: "Customer Name", category: "header-merge", description: "Registered Client / Firm Name", example: "Manju Creation (Santacruz) Mumbai" },
  { sheetCol: "C", colIndex1Based: 3, arrayIndex0Based: 2, name: "Order Date", category: "header-merge", description: "Date of order booking", example: "2025-09-13" },
  { sheetCol: "D", colIndex1Based: 4, arrayIndex0Based: 3, name: "Unit", category: "item-row", description: "Manufacturing Plant / Unit", example: "TLU" },
  { sheetCol: "E", colIndex1Based: 5, arrayIndex0Based: 4, name: "Item Name", category: "item-row", description: "Fabric / Elastic Description", example: "TC 129" },
  { sheetCol: "F", colIndex1Based: 6, arrayIndex0Based: 5, name: "Color", category: "item-row", description: "Color shade / code", example: "Greige" },
  { sheetCol: "G", colIndex1Based: 7, arrayIndex0Based: 6, name: "Width", category: "item-row", description: "Fabric / material width", example: "56\"" },
  { sheetCol: "H", colIndex1Based: 8, arrayIndex0Based: 7, name: "Unit (of item)", category: "item-row", description: "UOM (MTR / KG / PCS)", example: "MTR" },
  { sheetCol: "I", colIndex1Based: 9, arrayIndex0Based: 8, name: "Qty", category: "item-row", description: "Total Ordered Quantity", example: "1000" },
  { sheetCol: "J", colIndex1Based: 10, arrayIndex0Based: 9, name: "Rate", category: "item-row", description: "Unit price / rate in INR", example: "2.5" },
  { sheetCol: "K", colIndex1Based: 11, arrayIndex0Based: 10, name: "Discount", category: "item-row", description: "Discount %", example: "0%" },
  { sheetCol: "L", colIndex1Based: 12, arrayIndex0Based: 11, name: "Delivery Date", category: "item-row", description: "Committed delivery target date", example: "9/13/2025" },
  { sheetCol: "M", colIndex1Based: 13, arrayIndex0Based: 12, name: "Remark", category: "header-merge", description: "Order remarks", example: "Pls dispatch as soon as possible" },
  { sheetCol: "N", colIndex1Based: 14, arrayIndex0Based: 13, name: "Customer Number", category: "header-merge", description: "Contact mobile number", example: "9823073535" },
  { sheetCol: "O", colIndex1Based: 15, arrayIndex0Based: 14, name: "Billing Address", category: "header-merge", description: "Registered GST billing address", example: "Santacruz (W), Mumbai" },
  { sheetCol: "P", colIndex1Based: 16, arrayIndex0Based: 15, name: "Delivery Address", category: "header-merge", description: "Consignee delivery godown address", example: "Bhiwandi / Sewree Mumbai" },
  { sheetCol: "Q", colIndex1Based: 17, arrayIndex0Based: 16, name: "Sales Person Name", category: "header-merge", description: "Sales representative handling account", example: "Santosh Pachratkar" },
  { sheetCol: "R", colIndex1Based: 18, arrayIndex0Based: 17, name: "Sales Person Contact", category: "header-merge", description: "Sales representative contact", example: "9320167523" },
  { sheetCol: "S", colIndex1Based: 19, arrayIndex0Based: 18, name: "Order No", category: "header-merge", description: "Assigned Order Number", example: "438" },
  { sheetCol: "T", colIndex1Based: 20, arrayIndex0Based: 19, name: "Customer Mail Id", category: "header-merge", description: "Customer Email Address", example: "orders@ginzalimited.com" },
  { sheetCol: "U", colIndex1Based: 21, arrayIndex0Based: 20, name: "Dispatch Qnt", category: "dispatch-balance", description: "Quantity already dispatched", example: "1000" },
  { sheetCol: "V", colIndex1Based: 22, arrayIndex0Based: 21, name: "Balance Qnt", category: "dispatch-balance", description: "Formula: =I2-U2", example: "0" },
  { sheetCol: "W", colIndex1Based: 23, arrayIndex0Based: 22, name: "Status", category: "header-merge", description: "Operational Status", example: "Open / In-Progress" },
  { sheetCol: "X", colIndex1Based: 24, arrayIndex0Based: 23, name: "Remark", category: "header-merge", description: "Automation Remark", example: "Production in line" },
  { sheetCol: "Y", colIndex1Based: 25, arrayIndex0Based: 24, name: "Approval", category: "header-merge", description: "Approval status", example: "APPROVED" },
  { sheetCol: "Z", colIndex1Based: 26, arrayIndex0Based: 25, name: "Timestamp", category: "header-merge", description: "Approval timestamp", example: "9/13/2025, 02:15:00 pm" },
  { sheetCol: "AA", colIndex1Based: 27, arrayIndex0Based: 26, name: "Confirmation Mail", category: "header-merge", description: "Mail trigger status", example: "Sent" },
  { sheetCol: "AB", colIndex1Based: 28, arrayIndex0Based: 27, name: "Mail Status", category: "header-merge", description: "Mail delivery receipt", example: "Delivered" },
  { sheetCol: "AC", colIndex1Based: 29, arrayIndex0Based: 28, name: "Confirmation Msg", category: "header-merge", description: "SMS / WhatsApp confirmation", example: "Message Sent" },
  { sheetCol: "AD", colIndex1Based: 30, arrayIndex0Based: 29, name: "Whatspp Link", category: "header-merge", description: "WhatsApp chat link", example: "https://api.whatsapp.com/..." },
  { sheetCol: "AE", colIndex1Based: 31, arrayIndex0Based: 30, name: "Follow-up 1", category: "header-merge", description: "First follow-up checkbox", example: "✓" },
  { sheetCol: "AF", colIndex1Based: 32, arrayIndex0Based: 31, name: "Timestamp", category: "header-merge", description: "Follow-up 1 timestamp", example: "9/14/2025, 11:20:00 am" },
  { sheetCol: "AG", colIndex1Based: 33, arrayIndex0Based: 32, name: "Follow-up 1 Remark", category: "header-merge", description: "Follow-up 1 discussion summary", example: "Delivery scheduled" },
  { sheetCol: "AH", colIndex1Based: 34, arrayIndex0Based: 33, name: "Follow-up 2", category: "header-merge", description: "Second follow-up checkbox", example: "✓" },
  { sheetCol: "AI", colIndex1Based: 35, arrayIndex0Based: 34, name: "Timestamp", category: "header-merge", description: "Follow-up 2 timestamp", example: "9/15/2025, 10:15:00 am" },
  { sheetCol: "AJ", colIndex1Based: 36, arrayIndex0Based: 35, name: "Follow-up 2 Remark", category: "header-merge", description: "Follow-up 2 discussion summary", example: "Balance ready" },
  { sheetCol: "AK", colIndex1Based: 37, arrayIndex0Based: 36, name: "Transport Name", category: "header-merge", description: "Transport agency", example: "Shiv Shakti Carrier" },
  { sheetCol: "AL", colIndex1Based: 38, arrayIndex0Based: 37, name: "LR- Number", category: "header-merge", description: "Lorry Receipt number", example: "LR-558921" },
  { sheetCol: "AM", colIndex1Based: 39, arrayIndex0Based: 38, name: "Open / Close", category: "item-row", description: "Lifecycle Status: Open, In-Progress, Complete", example: "Open" },
  { sheetCol: "AN", colIndex1Based: 40, arrayIndex0Based: 39, name: "Status AN / WA Msg", category: "header-merge", description: "Lifecycle / WA Status: Complete, Open, Message Sent", example: "Complete" },
  { sheetCol: "AO", colIndex1Based: 41, arrayIndex0Based: 40, name: "Whatspp Link", category: "header-merge", description: "Dispatch WhatsApp link", example: "Sent Message" },
  { sheetCol: "AP", colIndex1Based: 42, arrayIndex0Based: 41, name: "Delivery Email", category: "header-merge", description: "Delivery email address", example: "orders@ginzalimited.com" },
  { sheetCol: "AQ", colIndex1Based: 43, arrayIndex0Based: 42, name: "Delivery Email Link", category: "header-merge", description: "Mailto link", example: "Send Email" }
];
