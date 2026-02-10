// reactSelectStyles.ts
export const customStyles = {
  control: (provided, state) => ({
    ...provided,
    backgroundColor: "var(--input)",
    borderColor: state.isFocused ? "var(--primary)" : "var(--border)",
    borderRadius: "0.5rem", // rounded-lg
    paddingLeft: "0.75rem", // px-4
    paddingRight: "0.75rem",
    minHeight: "3rem", // py-3 equivalent
    color: "var(--foreground)",
    boxShadow: state.isFocused ? "0 0 0 2px var(--primary)" : "none",
    transition: "all 0.2s ease",
    "&:hover": {
      borderColor: "var(--primary)",
    },
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: "var(--input)",
    borderRadius: "0.5rem",
    border: `1px solid var(--border)`,
    zIndex: 5000,
  }),
  menuPortal: (provided) => ({
    ...provided,
    zIndex: 9999,
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isFocused ? "var(--primary)" : "var(--input)",
    color: state.isFocused ? "#fff" : "var(--foreground)",
    cursor: "pointer",
  }),
  input: (provided) => ({
    ...provided,
    color: "var(--foreground)",
  }),
  placeholder: (provided) => ({
    ...provided,
    color: "var(--foreground)",
    opacity: 0.7,
  }),
  singleValue: (provided) => ({
    ...provided,
    color: "var(--foreground)",
  }),
  multiValue: (provided) => ({
    ...provided,
    backgroundColor: "var(--primary)",
    color: "#fff",
  }),
  multiValueLabel: (provided) => ({
    ...provided,
    color: "#fff",
  }),
  multiValueRemove: (provided) => ({
    ...provided,
    color: "#fff",
    ":hover": {
      backgroundColor: "#DC2626",
      color: "#fff",
    },
  }),
};

// Compact variant for inline table cell editing
export const compactStyles = {
  ...customStyles,
  control: (provided, state) => ({
    ...customStyles.control(provided, state),
    minHeight: "30px",
    paddingLeft: "0.25rem",
    paddingRight: "0.25rem",
    borderRadius: "0.25rem",
    fontSize: "0.875rem",
  }),
  valueContainer: (provided) => ({
    ...provided,
    padding: "0 4px",
  }),
  input: (provided) => ({
    ...provided,
    color: "var(--foreground)",
    margin: 0,
    padding: 0,
  }),
  indicatorsContainer: (provided) => ({
    ...provided,
    height: "28px",
  }),
  dropdownIndicator: (provided) => ({
    ...provided,
    padding: "2px",
  }),
  clearIndicator: (provided) => ({
    ...provided,
    padding: "2px",
  }),
  menu: (provided) => ({
    ...customStyles.menu(provided),
    minWidth: "180px",
  }),
};
