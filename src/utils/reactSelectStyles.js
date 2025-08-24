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
    zIndex: 50,
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
