import Select from "react-select";
import { customStyles } from "./reactSelectStyles.js"; // adjust path

export function CustomSelect({ data, selectedId, setSelectedId,placeholder = "Select option..." }) {
  const options = data.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const selectedCompany = options.find((o) => o.value === selectedId) || null;

  return (
    
      <Select
        options={options}
        value={selectedCompany}
        onChange={(selected) => setSelectedId(selected?.value || "")}
        placeholder={placeholder}
        isClearable
        styles={customStyles}
        classNamePrefix="rs"
      />
    
  );
}
