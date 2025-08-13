import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
export { useAuth };
export { useTheme };
export { default as Error } from "@/components/ui/Error";
export { useConfirm } from "@/components/ui/ConfirmModal";
export { default as Skeleton } from "@/components/ui/Skeleton";

export const API = async (method: string, name: string, d = {}) => {
  if (method == "GET" || method == "DELETE") {
    const data = await fetch("/api/" + name, {
      method: method,
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
