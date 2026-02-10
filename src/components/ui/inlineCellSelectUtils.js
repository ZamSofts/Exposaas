import { useEffect } from "react";
import { getColorForValue } from "@/lib/colorLabel";

/** Auto-focus a react-select ref on mount. */
export function useAutoFocusSelect(selectRef) {
  useEffect(() => {
    if (selectRef.current) {
      selectRef.current.focus();
    }
  }, []);
}

/** Create an Escape key handler that calls onCancel. */
export function handleEscapeKey(onCancel) {
  return (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel?.();
    }
  };
}

/**
 * Format option label with a color dot.
 * @param {boolean} isCreatable — if true, skip color for __isNew__ options
 */
export function formatOptionLabelWithColor(option, { isCreatable = false } = {}) {
  if (isCreatable && option.__isNew__) return option.label;
  const dotColor = getColorForValue(option.label);
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {dotColor && (
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          backgroundColor: dotColor, flexShrink: 0,
        }} />
      )}
      {option.label}
    </span>
  );
}

/** Shared react-select props for portaled inline menus. */
export const SHARED_SELECT_PROPS = {
  menuPortalTarget: typeof document !== "undefined" ? document.body : null,
  menuPosition: "fixed",
  menuIsOpen: true,
  classNamePrefix: "rs",
};
