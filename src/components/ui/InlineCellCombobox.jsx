import { useRef } from "react";
import CreatableSelect from "react-select/creatable";
import { compactStyles } from "./reactSelectStyles";
import {
  useAutoFocusSelect,
  handleEscapeKey,
  formatOptionLabelWithColor,
  SHARED_SELECT_PROPS,
} from "./inlineCellSelectUtils";

export default function InlineCellCombobox({ options, currentValue, onChange, onBlur, onCancel }) {
  const selectRef = useRef(null);
  useAutoFocusSelect(selectRef);

  const selected = currentValue
    ? { value: currentValue, label: currentValue }
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
      isClearable
      placeholder="Type or select..."
      formatCreateLabel={(input) => `Use: ${input}`}
      formatOptionLabel={(option) => formatOptionLabelWithColor(option, { isCreatable: true })}
      {...SHARED_SELECT_PROPS}
    />
  );
}
