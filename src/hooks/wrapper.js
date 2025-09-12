import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
export { useAuth };
export { useTheme };
export { default as Error } from "@/components/ui/Error";
export { useConfirm } from "@/components/ui/ConfirmModal";
export { default as Skeleton } from "@/components/ui/Skeleton";
export { MultiSelect } from "@/components/ui/MultiSelect";
export { CustomSelect } from "@/components/ui/SingleSelecter";
export { CustomButton } from "@/components/ui/CustomButton";
export { Toast } from "@/components/ui/CustomToast";
export { FilePreviewer } from "@/components/ui/FilePreviewer";
export { Loader } from "@/components/ui/Loader";
export { EditVehicle } from "@/components/EditVehicle";

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