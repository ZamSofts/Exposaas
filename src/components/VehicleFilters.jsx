import { useMemo } from "react";
import Select from "react-select";
import { X, Plus } from "lucide-react";
import { compactStyles } from "@/components/ui/reactSelectStyles";
import { FILTERABLE_COLUMNS, FILTER_OPERATORS } from "@/config/vehicleColumns";

// Shared react-select styles & props for portaled menus (avoids z-index clipping)
const portalStyles = {
  ...compactStyles,
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};
const PORTAL_PROPS = {
  menuPortalTarget: typeof document !== "undefined" ? document.body : null,
  menuPosition: "fixed",
  styles: portalStyles,
};

/** Single filter condition row */
function FilterRow({
  filter,
  fieldOptions,
  onFieldChange,
  onOperatorChange,
  onValueChange,
  onRemove,
  valueOptions,
}) {
  const column = FILTERABLE_COLUMNS.find(c => c.prismaPath === filter.field);
  const filterType = column?.filterType || "text";
  const operators = FILTER_OPERATORS[filterType] || FILTER_OPERATORS.text;
  const isEmptyOp = ["isEmpty", "isNotEmpty"].includes(filter.operator);

  // Field selector value
  const fieldValue = fieldOptions.find(o => o.value === filter.field) || null;

  // Operator selector value
  const operatorValue = operators.find(o => o.value === filter.operator) || null;

  return (
    <div className="flex items-center gap-2">
      {/* Field selector */}
      <div style={{ width: 160, flexShrink: 0 }}>
        <Select
          {...PORTAL_PROPS}
          options={fieldOptions}
          value={fieldValue}
          onChange={(opt) => onFieldChange(opt?.value || "")}
          placeholder="Field..."
          isClearable={false}
          isSearchable
        />
      </div>

      {/* Operator selector */}
      <div style={{ width: 150, flexShrink: 0 }}>
        <Select
          {...PORTAL_PROPS}
          options={operators}
          value={operatorValue}
          onChange={(opt) => onOperatorChange(opt?.value || "")}
          placeholder="Operator..."
          isClearable={false}
          isSearchable={false}
        />
      </div>

      {/* Value input — hidden for isEmpty/isNotEmpty */}
      <div style={{ flex: 1, minWidth: 120 }}>
        {!isEmptyOp && (
          <ValueInput
            filter={filter}
            filterType={filterType}
            valueOptions={valueOptions}
            onChange={onValueChange}
          />
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="p-1 rounded hover:bg-[var(--border)] text-[var(--secondary-foreground)]
                   hover:text-red-500 transition-colors flex-shrink-0"
        title="Remove condition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Renders the appropriate value input based on filter type */
function ValueInput({ filter, filterType, valueOptions, onChange }) {
  const baseClass =
    "w-full px-2 py-1 text-xs bg-[var(--input)] border border-[var(--border)] rounded " +
    "text-[var(--foreground)] placeholder-[var(--secondary-foreground)] " +
    "focus:outline-none focus:border-[var(--primary)]";

  // Dropdown / combobox → react-select with options
  if (valueOptions && valueOptions.length > 0 && (filterType === "dropdown" || filterType === "combobox")) {
    const selected = valueOptions.find(o => o.value === filter.value) || null;
    return (
      <Select
        {...PORTAL_PROPS}
        options={valueOptions}
        value={selected}
        onChange={(opt) => onChange(opt?.value || "")}
        placeholder="Select..."
        isClearable
        isSearchable
      />
    );
  }

  // Number input
  if (filterType === "number") {
    return (
      <input
        type="number"
        value={filter.value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Value..."
        className={baseClass}
        style={{ minHeight: 30 }}
      />
    );
  }

  // Date input
  if (filterType === "date") {
    return (
      <input
        type="date"
        value={filter.value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={baseClass}
        style={{ minHeight: 30 }}
      />
    );
  }

  // Default: text input
  return (
    <input
      type="text"
      value={filter.value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value..."
      className={baseClass}
      style={{ minHeight: 30 }}
    />
  );
}

/**
 * Vehicle filter panel (Lark Base style).
 *
 * Props:
 *  - filters: Array<{ id, field, operator, value }>
 *  - conjunction: "and" | "or"
 *  - onFiltersChange: (filters) => void
 *  - onConjunctionChange: (conjunction) => void
 *  - brandOptions: [{ value, label }]
 *  - customerOptions: [{ value, label }]
 *  - suggestions: { auction: [...], transportCompany: [...], ... }
 */
export default function VehicleFilters({
  filters,
  conjunction,
  onFiltersChange,
  onConjunctionChange,
  brandOptions = [],
  customerOptions = [],
  suggestions = {},
}) {
  // Build field options for the field selector
  const fieldOptions = useMemo(
    () => FILTERABLE_COLUMNS.map(c => ({ value: c.prismaPath, label: c.label })),
    []
  );

  // Get value options for a given field
  const getValueOptions = (field) => {
    const column = FILTERABLE_COLUMNS.find(c => c.prismaPath === field);
    if (!column) return null;

    if (column.optionsKey === "brandOptions") {
      return brandOptions.map(o => ({ value: o.label, label: o.label }));
    }
    if (column.optionsKey === "customerOptions") {
      return customerOptions.map(o => ({ value: o.label, label: o.label }));
    }
    if (column.filterType === "combobox" && column.optionsKey) {
      return (suggestions[column.optionsKey] || []).map(v => ({ value: v, label: v }));
    }
    return null;
  };

  const addFilter = () => {
    onFiltersChange([...filters, { id: Date.now(), field: "", operator: "", value: "" }]);
  };

  const removeFilter = (id) => {
    onFiltersChange(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id, updates) => {
    onFiltersChange(filters.map(f => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handleFieldChange = (id, newField) => {
    const column = FILTERABLE_COLUMNS.find(c => c.prismaPath === newField);
    const filterType = column?.filterType || "text";
    const firstOp = (FILTER_OPERATORS[filterType] || FILTER_OPERATORS.text)[0]?.value || "";
    updateFilter(id, { field: newField, operator: firstOp, value: "" });
  };

  const conjunctionOptions = [
    { value: "and", label: "AND" },
    { value: "or", label: "OR" },
  ];

  return (
    <div className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] border-t-0 space-y-2">
      {/* Header with conjunction */}
      <div className="flex items-center gap-2 text-xs text-[var(--secondary-foreground)]">
        <span>Where</span>
        <select
          value={conjunction}
          onChange={(e) => onConjunctionChange(e.target.value)}
          className="px-2 py-0.5 text-xs bg-[var(--input)] border border-[var(--border)] rounded
                     text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
        >
          {conjunctionOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span>of the following conditions match:</span>
      </div>

      {/* Filter rows */}
      {filters.map((filter) => (
        <FilterRow
          key={filter.id}
          filter={filter}
          fieldOptions={fieldOptions}
          onFieldChange={(field) => handleFieldChange(filter.id, field)}
          onOperatorChange={(op) => {
            const updates = { operator: op };
            if (["isEmpty", "isNotEmpty"].includes(op)) updates.value = "";
            updateFilter(filter.id, updates);
          }}
          onValueChange={(val) => updateFilter(filter.id, { value: val })}
          onRemove={() => removeFilter(filter.id)}
          valueOptions={getValueOptions(filter.field)}
        />
      ))}

      {/* Add condition button */}
      <button
        onClick={addFilter}
        className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--primary)]
                   hover:text-[var(--primary-hover)] transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add Condition
      </button>
    </div>
  );
}
