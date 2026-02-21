import { useAuth } from "@/hooks/useAuth";
export { useAuth };
export { default as Error } from "@/components/ui/Error";
export { useConfirm } from "@/components/ui/ConfirmModal";
export { MultiSelect } from "@/components/ui/MultiSelect";
export { CustomSelect } from "@/components/ui/SingleSelecter";
export { CustomButton } from "@/components/ui/CustomButton";
export { Toast } from "@/components/ui/CustomToast";
export { FilePreviewer } from "@/components/ui/FilePreviewer";
export { Loader } from "@/components/ui/Loader";
export { EditVehicle } from "@/components/EditVehicle";
export { InvoiceDataViewer } from "@/components/InvoiceDataViewer";
export { PermissionSelector } from "@/components/ui/PermissionSelector";
export { default as DataTable } from "@/components/ui/DataTable";

export const API = async (method, name, d = {}, isFile= false) => {
  if (method == "GET" || method == "DELETE") {
    const data = await fetch("/api/" + name, {
      method: method,
    });
    return await data.json();
  }

  if (isFile && d instanceof FormData) {
    const data = await fetch("/api/" + name, {
      method,
      body: d,
    });
    return await data.json();
  }

  const data = await fetch("/api/" + name, {
    method: method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(d),
  });
  return await data.json();
};

export const isValid = (fieldsObj, setError) => {
  for (const [fieldName, value] of Object.entries(fieldsObj)) {
    // Trim the value in-place if it's a string
    if (typeof value === "string") {
      fieldsObj[fieldName] = value.trim();
    }
    // Check if required field is empty after trimming
    if (!fieldsObj[fieldName]?.toString().trim()) {
      const errorMsg = `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      setError(errorMsg);
      return false;
    }

    if (["titleTransferDeadline", "auctionDate"].includes(fieldName)) {
      if (!isValidDate(value)) {
        const errorMsg = `Invalid date for ${fieldName}`;
        setError(errorMsg);
        return false;
      }
    }
  }
  setError("");
  return true;
};

function isValidDate(dateString) {
  if (!dateString) return false;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false; // invalid date

  const year = date.getFullYear();
  if (year < 1900 || year > 2100) return false;

  return true;
}



export const isAllowed = (required = [], session) => {
  if (!session || !Array.isArray(required) || required.length === 0) return false;
  const permissions = Array.isArray(session.permissions) ? session.permissions : [];
  const roles = Array.isArray(session.roles) ? session.roles : [];
  for (const item of required) {
    if (permissions.includes(item) || roles.includes(item)) return true;
  }
  return false;
};
