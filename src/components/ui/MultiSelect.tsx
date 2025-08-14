import React from "react";
import Select from "react-select";

export const MultiSelect=({ roles, rolesId, setRolesId })=> {
  const customStyles = {
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
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isFocused ? "var(--primary)" : "var(--input)",
      color: state.isFocused ? "#fff" : "var(--foreground)",
      cursor: "pointer",
    }),
    placeholder: (provided) => ({
      ...provided,
      color: "var(--foreground)",
      opacity: 0.7,
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

  return (
    <Select
      isMulti
      options={roles.map((role) => ({
        value: role.id,
        label: role.name,
      }))}
      value={rolesId.map((id) => {
        const role = roles.find((r) => r.id === id);
        return { value: id, label: role ? role.name : "" };
      })}
      onChange={(selected) =>
        setRolesId(selected ? selected.map((s) => s.value) : [])
      }
      className="basic-multi-select"
      classNamePrefix="select"
      styles={customStyles}
    />
  );
}

