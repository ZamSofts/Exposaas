// ── Functions ──

export const formatCurrency = (value) => {
  if (value === null || value === undefined) return "-";
  const num = parseFloat(String(value));
  if (isNaN(num)) return "-";
  return `¥${num.toLocaleString()}`;
};

// ── Column Definitions ──

export const VEHICLE_COLUMNS = [
  { id: "id",                   label: "ID",             width: 60,  type: "static",                   visible: true },
  { id: "chassisNumber",        label: "車台番号",        width: 170, type: "text",     field: "chassisNumber",  visible: true },
  { id: "brand",                label: "ブランド",        width: 120, type: "combobox", field: "brandId",        visible: true, displayValueFn: (v) => v.brand?.name, optionsKey: "brandOptions", isRelation: true },
  { id: "lotNumber",            label: "ロット番号",      width: 80,  type: "text",     field: "lotNumber",      visible: false },
  { id: "auctionDate",          label: "日付",            width: 100, type: "text",     field: "auctionDate",    visible: true },
  { id: "session",              label: "セッション",      width: 90,  type: "text",     field: "session",        visible: false },
  { id: "auction",              label: "オークション",    width: 140, type: "combobox", field: "auction",        visible: true, optionsKey: "auction" },
  { id: "invoice",              label: "請求書",          width: 60,  type: "static",                   visible: true,  noSort: true },
  { id: "docs",                 label: "書類",            width: 90,  type: "static",                   visible: true,  noSort: true },
  { id: "bidAmount",            label: "落札金額",        width: 120, type: "number",   field: "bidAmount",      visible: true },
  { id: "auctionFee",           label: "オークション手数料", width: 115, type: "number", field: "auctionFee",     visible: false },
  { id: "insuranceFee",         label: "保険料",          width: 105, type: "number",   field: "insuranceFee",   visible: false },
  { id: "recyclingFee",         label: "リサイクル料",    width: 110, type: "number",   field: "recyclingFee",   visible: false },
  { id: "transportFee",         label: "輸送費",          width: 105, type: "number",   field: "transportFee",   visible: false },
  { id: "otherFees",            label: "その他費用",      width: 100, type: "number",   field: "otherFees",      visible: false },
  { id: "taxSum",               label: "税金",            width: 110, type: "readonly-currency",         field: "taxSum",         visible: false },
  { id: "totalCost",            label: "合計金額",        width: 120, type: "readonly-currency-primary", field: "totalCost",      visible: false },
  { id: "length",               label: "全長(cm)",        width: 80,  type: "number",   field: "length",         visible: false },
  { id: "width",                label: "全幅(cm)",        width: 80,  type: "number",   field: "width",          visible: false },
  { id: "height",               label: "全高(cm)",        width: 80,  type: "number",   field: "height",         visible: false },
  { id: "m3",                   label: "M3",              width: 80,  type: "number",   field: "m3",             visible: false },
  { id: "customer",             label: "顧客",            width: 130, type: "combobox", field: "customerId",     visible: false, displayValueFn: (v) => v.customer?.name, optionsKey: "customerOptions", isClearable: true, isRelation: true },
  { id: "transportCompany",     label: "輸送会社",        width: 120, type: "combobox", field: "transportCompany", visible: false, optionsKey: "transportCompany" },
  { id: "deliverTo",            label: "納品先",          width: 120, type: "combobox", field: "deliverTo",      visible: false, optionsKey: "deliverTo" },
  { id: "numberPlate",          label: "ナンバープレート", width: 100, type: "text",    field: "numberPlate",    visible: false },
  { id: "titleTransferDeadline",label: "名義変更期限",    width: 130, type: "date",     field: "titleTransferDeadline", visible: false },
  { id: "containerNumber",      label: "コンテナ番号",    width: 115, type: "text",     field: "containerNumber", visible: false },
  { id: "etd",                  label: "ETD",             width: 90,  type: "text",     field: "etd",            visible: false },
  { id: "documentStatus",       label: "書類状態",        width: 120, type: "combobox", field: "documentStatus", visible: false, optionsKey: "documentStatus" },
  { id: "memo",                 label: "メモ",            width: 150, type: "text",     field: "memo",           visible: false },
  { id: "createdAt",            label: "作成日",          width: 100, type: "static",                   visible: false },
  { id: "actions",              label: "",               width: 70,  type: "actions",  requirePermission: ["edit:vehicle"] },
];

// ── Filter Operators ──

export const FILTER_OPERATORS = {
  text: [
    { value: "is", label: "Is" },
    { value: "isNot", label: "Is not" },
    { value: "contains", label: "Contains" },
    { value: "doesNotContain", label: "Does not contain" },
    { value: "isEmpty", label: "Is empty" },
    { value: "isNotEmpty", label: "Is not empty" },
  ],
  number: [
    { value: "is", label: "=" },
    { value: "isNot", label: "!=" },
    { value: "isGreater", label: ">" },
    { value: "isGreaterEqual", label: ">=" },
    { value: "isLess", label: "<" },
    { value: "isLessEqual", label: "<=" },
    { value: "isEmpty", label: "Is empty" },
    { value: "isNotEmpty", label: "Is not empty" },
  ],
  dropdown: [
    { value: "is", label: "Is" },
    { value: "isNot", label: "Is not" },
    { value: "isEmpty", label: "Is empty" },
    { value: "isNotEmpty", label: "Is not empty" },
  ],
  combobox: [
    { value: "is", label: "Is" },
    { value: "isNot", label: "Is not" },
    { value: "contains", label: "Contains" },
    { value: "doesNotContain", label: "Does not contain" },
    { value: "isEmpty", label: "Is empty" },
    { value: "isNotEmpty", label: "Is not empty" },
  ],
  date: [
    { value: "is", label: "Is" },
    { value: "isNot", label: "Is not" },
    { value: "isGreater", label: "After" },
    { value: "isGreaterEqual", label: "On or after" },
    { value: "isLess", label: "Before" },
    { value: "isLessEqual", label: "On or before" },
    { value: "isEmpty", label: "Is empty" },
    { value: "isNotEmpty", label: "Is not empty" },
  ],
};

// ── Filterable Columns (derived) ──

export const FILTERABLE_COLUMNS = VEHICLE_COLUMNS
  .filter(col => !["static", "actions"].includes(col.type))
  .map(col => {
    let filterType = col.type;
    if (filterType === "readonly-currency" || filterType === "readonly-currency-primary") {
      filterType = "number";
    }

    let prismaPath = col.field;
    if (col.id === "brand") prismaPath = "brand.name";
    else if (col.id === "customer") prismaPath = "customer.name";

    return {
      id: col.id,
      label: col.label,
      field: col.field,
      filterType,
      optionsKey: col.optionsKey || null,
      prismaPath,
    };
  });
