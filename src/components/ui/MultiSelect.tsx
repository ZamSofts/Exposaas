import React from "react";
import Select from "react-select";
import { customStyles } from "@/utils/reactSelectStyles"; 

export const MultiSelect=({ roles, rolesId, setRolesId,placeholder = "Select options..." })=> {


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
      placeholder={placeholder}

      classNamePrefix="select"
      styles={customStyles}
    />
  );
}

