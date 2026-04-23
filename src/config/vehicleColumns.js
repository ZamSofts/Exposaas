// ── Functions ──

export const formatCurrency = (value) => {
  if (value === null || value === undefined) return "-";
  const num = parseFloat(String(value));
  if (isNaN(num)) return "-";
  return `¥${num.toLocaleString()}`;
};

// ── Column Definitions ──
// `label` remains Japanese and is used for Excel export (stays Japanese per business requirement).
// `labelKey` is the i18n key used for UI display via `useT()`.

export const VEHICLE_COLUMNS = [
  { id: "id",                   label: "ID",             labelKey: "fields.id",                 width: 60,  type: "static",                   visible: true },
  { id: "chassisNumber",        label: "車台番号",        labelKey: "fields.chassisNumber",      width: 170, type: "text",     field: "chassisNumber",  visible: true },
  { id: "brand",                label: "ブランド",        labelKey: "fields.brand",              width: 120, type: "combobox", field: "brandId",        visible: true, displayValueFn: (v) => v.brand?.name, optionsKey: "brandOptions", isRelation: true },
  { id: "lotNumber",            label: "ロット番号",      labelKey: "fields.lotNumber",          width: 80,  type: "text",     field: "lotNumber",      visible: false },
  { id: "auctionDate",          label: "日付",            labelKey: "fields.auctionDate",        width: 100, type: "text",     field: "auctionDate",    visible: true },
  { id: "session",              label: "セッション",      labelKey: "fields.session",            width: 90,  type: "text",     field: "session",        visible: false },
  { id: "auction",              label: "オークション",    labelKey: "fields.auction",            width: 140, type: "combobox", field: "auction",        visible: true, optionsKey: "auction" },
  { id: "invoice",              label: "請求書",          labelKey: "fields.invoice",            width: 60,  type: "static",                   visible: true,  noSort: true },
  { id: "docs",                 label: "書類",            labelKey: "fields.docs",               width: 90,  type: "static",                   visible: true,  noSort: true },
  { id: "bidAmount",            label: "落札金額",        labelKey: "fields.bidAmount",          width: 120, type: "number",   field: "bidAmount",      visible: true },
  { id: "auctionFee",           label: "オークション手数料", labelKey: "fields.auctionFee",      width: 115, type: "number", field: "auctionFee",     visible: false },
  { id: "insuranceFee",         label: "保険料",          labelKey: "fields.insuranceFee",       width: 105, type: "number",   field: "insuranceFee",   visible: false },
  { id: "recyclingFee",         label: "リサイクル料",    labelKey: "fields.recyclingFee",       width: 110, type: "number",   field: "recyclingFee",   visible: false },
  { id: "transportFee",         label: "輸送費",          labelKey: "fields.transportFee",       width: 105, type: "number",   field: "transportFee",   visible: false },
  { id: "otherFees",            label: "その他費用",      labelKey: "fields.otherFees",          width: 100, type: "number",   field: "otherFees",      visible: false },
  { id: "taxSum",               label: "税金",            labelKey: "fields.taxSum",             width: 110, type: "readonly-currency",         field: "taxSum",         visible: false },
  { id: "totalCost",            label: "合計金額",        labelKey: "fields.totalCost",          width: 120, type: "readonly-currency-primary", field: "totalCost",      visible: false },
  { id: "length",               label: "全長(cm)",        labelKey: "fields.length",             width: 80,  type: "number",   field: "length",         visible: false },
  { id: "width",                label: "全幅(cm)",        labelKey: "fields.width",              width: 80,  type: "number",   field: "width",          visible: false },
  { id: "height",               label: "全高(cm)",        labelKey: "fields.height",             width: 80,  type: "number",   field: "height",         visible: false },
  { id: "m3",                   label: "M3",              labelKey: "fields.m3",                 width: 80,  type: "number",   field: "m3",             visible: false },
  { id: "engineModel",          label: "原動機型式",       labelKey: "fields.engineModel",       width: 110, type: "text",     field: "engineModel",    visible: false },
  { id: "vehicleWeight",        label: "車両重量(kg)",     labelKey: "fields.vehicleWeight",     width: 100, type: "number",   field: "vehicleWeight",  visible: false },
  { id: "grossVehicleWeight",   label: "車両総重量(kg)",   labelKey: "fields.grossVehicleWeight", width: 110, type: "number", field: "grossVehicleWeight", visible: false },
  { id: "engineDisplacement",   label: "排気量(cc)",       labelKey: "fields.engineDisplacement", width: 95, type: "number",   field: "engineDisplacement", visible: false },
  { id: "firstRegistrationDate",label: "初度登録",         labelKey: "fields.firstRegistrationDate", width: 100, type: "text", field: "firstRegistrationDate", visible: false },
  { id: "customer",             label: "顧客",            labelKey: "fields.customer",           width: 130, type: "combobox", field: "customerId",     visible: false, displayValueFn: (v) => v.customer?.name, optionsKey: "customerOptions", isClearable: true, isRelation: true },
  { id: "transportCompany",     label: "輸送会社",        labelKey: "fields.transportCompany",   width: 120, type: "combobox", field: "transportCompany", visible: false, optionsKey: "transportCompany" },
  { id: "deliverTo",            label: "納品先",          labelKey: "fields.deliverTo",          width: 120, type: "combobox", field: "deliverTo",      visible: false, optionsKey: "deliverTo" },
  { id: "numberPlate",          label: "ナンバープレート", labelKey: "fields.numberPlate",        width: 100, type: "text",    field: "numberPlate",    visible: false },
  { id: "titleTransferDeadline",label: "名義変更期限",    labelKey: "fields.titleTransferDeadline", width: 130, type: "date", field: "titleTransferDeadline", visible: false },
  { id: "containerNumber",      label: "コンテナ番号",    labelKey: "fields.containerNumber",    width: 115, type: "text",     field: "containerNumber", visible: false },
  { id: "etd",                  label: "ETD",             labelKey: "fields.etd",                width: 90,  type: "text",     field: "etd",            visible: false },
  { id: "documentStatus",       label: "書類状態",        labelKey: "fields.documentStatus",     width: 120, type: "combobox", field: "documentStatus", visible: false, optionsKey: "documentStatus" },
  { id: "memo",                 label: "メモ",            labelKey: "fields.memo",               width: 150, type: "text",     field: "memo",           visible: false },
  { id: "createdAt",            label: "作成日",          labelKey: "fields.createdAt",          width: 100, type: "static",                   visible: false },
  { id: "actions",              label: "",               labelKey: null,                         width: 70,  type: "actions",  requirePermission: ["edit:vehicle"] },
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
      labelKey: col.labelKey,
      field: col.field,
      filterType,
      optionsKey: col.optionsKey || null,
      prismaPath,
    };
  });
