import { useRef } from "react";
import Select from "react-select";
import { compactStyles } from "./reactSelectStyles";
import {
  useAutoFocusSelect,
  handleEscapeKey,
  formatOptionLabelWithColor,
  SHARED_SELECT_PROPS,
} from "./inlineCellSelectUtils";

export default function InlineCellDropdown({ options, selectedValue, onChange, onBlur, onCancel, isClearable = false }) {
  const selectRef = useRef(null);
  useAutoFocusSelect(selectRef);

  return (
    <Select
      ref={selectRef}
      options={options}
      value={options.find(o => o.value === selectedValue) || null}
      onChange={(opt) => onChange(opt ? opt.value : null)}
      onBlur={onBlur}
      onKeyDown={handleEscapeKey(onCancel)}
      styles={compactStyles}
      isClearable={isClearable}
      placeholder="Select..."
      formatOptionLabel={formatOptionLabelWithColor}
      {...SHARED_SELECT_PROPS}
    />
  );
}
