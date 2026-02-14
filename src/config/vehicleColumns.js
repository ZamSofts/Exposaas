export const formatCurrency = (value) => {
  if (value === null || value === undefined) return "-";
  const num = parseFloat(value);
  if (isNaN(num)) return "-";
  return `¥${num.toLocaleString()}`;
};

export const VEHICLE_COLUMNS = [
  {
    id: "id",
    label: "ID",
    width: 60,
    type: "static",
  },
  {
    id: "chassisNumber",
    label: "Chassis",
    width: 170,
    type: "text",
    field: "chassisNumber",
  },
  {
    id: "brand",
    label: "Brand",
    width: 120,
    type: "combobox",
    field: "brandId",
    displayValueFn: (v) => v.brand?.name,
    optionsKey: "brandOptions",
    isRelation: true,
  },
  {
    id: "lotNumber",
    label: "Lot #",
    width: 80,
    type: "text",
    field: "lotNumber",
  },
  {
    id: "auctionDate",
    label: "Date",
    width: 100,
    type: "text",
    field: "auctionDate",
  },
  {
    id: "session",
    label: "Session",
    width: 90,
    type: "text",
    field: "session",
  },
  {
    id: "auction",
    label: "Auction",
    width: 140,
    type: "combobox",
    field: "auction",
    optionsKey: "auction",
  },
  {
    id: "invoice",
    label: "Inv.",
    width: 60,
    type: "static",
  },
  {
    id: "bidAmount",
    label: "Bid ¥",
    width: 120,
    type: "number",
    field: "bidAmount",
  },
  {
    id: "auctionFee",
    label: "Auc. Fee ¥",
    width: 115,
    type: "number",
    field: "auctionFee",
  },
  {
    id: "insuranceFee",
    label: "Insur. ¥",
    width: 105,
    type: "number",
    field: "insuranceFee",
  },
  {
    id: "recyclingFee",
    label: "Recycle ¥",
    width: 110,
    type: "number",
    field: "recyclingFee",
  },
  {
    id: "transportFee",
    label: "Trans. ¥",
    width: 105,
    type: "number",
    field: "transportFee",
  },
  {
    id: "otherFees",
    label: "Other ¥",
    width: 100,
    type: "number",
    field: "otherFees",
  },
  {
    id: "taxSum",
    label: "Tax ¥",
    width: 110,
    type: "readonly-currency",
    field: "taxSum",
  },
  {
    id: "totalCost",
    label: "Total ¥",
    width: 120,
    type: "readonly-currency-primary",
    field: "totalCost",
  },
  {
    id: "customer",
    label: "Customer",
    width: 130,
    type: "combobox",
    field: "customerId",
    displayValueFn: (v) => v.customer?.name,
    optionsKey: "customerOptions",
    isClearable: true,
    isRelation: true,
  },
  {
    id: "transportCompany",
    label: "Transport",
    width: 120,
    type: "combobox",
    field: "transportCompany",
    optionsKey: "transportCompany",
  },
  {
    id: "deliverTo",
    label: "Deliver To",
    width: 120,
    type: "combobox",
    field: "deliverTo",
    optionsKey: "deliverTo",
  },
  {
    id: "numberPlate",
    label: "Plate #",
    width: 100,
    type: "text",
    field: "numberPlate",
  },
  {
    id: "titleTransferDeadline",
    label: "Title Deadline",
    width: 130,
    type: "date",
    field: "titleTransferDeadline",
  },
  {
    id: "containerNumber",
    label: "Container",
    width: 115,
    type: "text",
    field: "containerNumber",
  },
  {
    id: "etd",
    label: "ETD",
    width: 90,
    type: "text",
    field: "etd",
  },
  {
    id: "documentStatus",
    label: "Doc Status",
    width: 120,
    type: "combobox",
    field: "documentStatus",
    optionsKey: "documentStatus",
  },
  {
    id: "memo",
    label: "Memo",
    width: 150,
    type: "text",
    field: "memo",
  },
  {
    id: "createdAt",
    label: "Created",
    width: 100,
    type: "static",
  },
  {
    id: "actions",
    label: "",
    width: 70,
    type: "actions",
    requirePermission: ["edit:vehicle"],
  },
];

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
