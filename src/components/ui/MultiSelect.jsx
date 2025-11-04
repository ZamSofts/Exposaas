import React from "react";
import Select,{ components } from "react-select";
import { customStyles } from "./reactSelectStyles.jsx"; 

export const MultiSelect=({ roles, rolesId, setRolesId, placeholder = "Select options...", onDropdownToggle })=> {

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
      onMenuOpen={() => onDropdownToggle && onDropdownToggle(true)}
      onMenuClose={() => onDropdownToggle && onDropdownToggle(false)}
      className="basic-multi-select"
      placeholder={placeholder}

      classNamePrefix="select"
      styles={customStyles}
    />
  );
}

export function ReactSelect({ label, value, onChange, options = [], isDisabled = false, placeholder = "", required = false, name, className = "3.7rem" }) {

   const selected =options.flatMap((opt) => (opt.children ? opt.children : opt)).find((o) => o.value === value) || null;
   const menuPortalTarget = typeof document !== "undefined" ? document.body : undefined;

  return (
    <div className={className}>
      {label && (
        <label className="flex items-center gap-1 text-sm font-semibold text-[var(--primary)] mb-2">
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
      )}

      <Select
        name={name}
        options={options}
        value={selected}
        onChange={opt => onChange(opt ? opt.value : "")}
        isDisabled={isDisabled}
        placeholder={placeholder}
        styles={{
          ...customStyles,
          control: (provided, state) => ({
            ...customStyles.control(provided, state),
            minHeight: className,
          })
        }}
        menuPortalTarget={menuPortalTarget}
        menuPosition="fixed"
        isSearchable
        isClearable={false}
      />
    </div>
  );
}
