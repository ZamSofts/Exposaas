import { useRef } from "react";
import CreatableSelect from "react-select/creatable";
import { compactStyles } from "./reactSelectStyles";
import {
  useAutoFocusSelect,
  handleEscapeKey,
  formatOptionLabelWithColor,
  SHARED_SELECT_PROPS,
} from "./inlineCellSelectUtils";

export default function InlineCellCombobox({ options, currentValue, onChange, onBlur, onCancel, isClearable = true }) {
  const selectRef = useRef(null);
  useAutoFocusSelect(selectRef);

  // Resolve selected: find by value (supports both ID-based and string-based options)
  const selected = currentValue != null
    ? options.find(o => o.value === currentValue) || { value: currentValue, label: currentValue }
    : null;

  return (
    <CreatableSelect
      ref={selectRef}
      options={options}
      value={selected}
      onChange={(opt) => onChange(opt ? opt.value : null)}
      onBlur={onBlur}
      onKeyDown={handleEscapeKey(onCancel)}
      styles={compactStyles}
      isClearable={isClearable}
      placeholder="Type or select..."
      formatCreateLabel={(input) => `Add: ${input}`}
      formatOptionLabel={(option) => formatOptionLabelWithColor(option, { isCreatable: true })}
      {...SHARED_SELECT_PROPS}
    />
  );
}
