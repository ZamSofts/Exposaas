import { useState, useMemo } from "react";

export function PermissionSelector({
  static_permissions,
  permissions,
  setPermission,
  isFullAccess,
  setIsFullAccess,
}) {
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [toasts, setToasts] = useState([]);

  // Group permissions by entity
  const grouped = useMemo(() => {
    const groups = {};
    static_permissions.forEach((p) => {
      const [action, entity] = p.name.split(":");
      const group = entity || action;
      if (!groups[group]) groups[group] = [];
      groups[group].push(p);
    });
    Object.keys(groups).forEach((key) => {
      groups[key] = groups[key].sort((a, b) => a.name.localeCompare(b.name));
    });
    return groups;
  }, [static_permissions]);

  // Select/Deselect single
  const handlePermissionChange = (id, checked) => {
    setPermission(
      checked
        ? [...permissions, id]
        : permissions.filter((pid) => pid !== id)
    );
  };

  // Full access toggle
  const toggleFullAccess = () => {
    if (isFullAccess) {
      setPermission([]);
      setIsFullAccess(false);
    } else {
      setPermission(static_permissions.map((p) => p.id));
      setIsFullAccess(true);
    }
  };

  // Toast handler
  const pushToast = (message) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };

  return (
    <div className="min-h-full max-w-5xl mx-auto px-2 py-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search permissions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-style max-w-xs"
        />

        <button
          type="button"
          onClick={toggleFullAccess}
          className="btn-primary"
        >
          {isFullAccess ? "Deselect All" : "Select All"}
        </button>

        <button
          id="clearAll"
          className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] text-[var(--secondary-foreground)] rounded-lg font-medium transition-all duration-200"
          onClick={() => {
            setPermission([]);
            pushToast("Cleared permissions");
          }}
        >
          Clear
        </button>
      </div>

      {/* Groups */}
      <div className="divide-y divide-[var(--border)]">
        {Object.entries(grouped).map(([group, perms]) => {
          const filtered = perms.filter((p) =>
            p.name.toLowerCase().includes(search.toLowerCase())
          );
          if (filtered.length === 0) return null;

          const ids = perms.map((p) => p.id);
          const selectedCount = ids.filter((id) =>
            permissions.includes(id)
          ).length;
          const allSelected = selectedCount === ids.length;
          const indeterminate =
            selectedCount > 0 && selectedCount < ids.length;
          const expanded = search ? true : expandedGroups[group] ?? true;

          return (
            <div
              key={group}
              className="py-3 px-4 rounded-lg hover:bg-[var(--input)] transition-all"
            >
              {/* Group Header */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => el && (el.indeterminate = indeterminate)}
                    onChange={(e) =>
                      setPermission(
                        e.target.checked
                          ? [...new Set([...permissions, ...ids])]
                          : permissions.filter((id) => !ids.includes(id))
                      )
                    }
                    className="accent-[var(--primary)] w-4 h-4"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGroups((prev) => ({
                        ...prev,
                        [group]: !expanded,
                      }))
                    }
                    className="flex items-center gap-2 font-semibold text-[var(--foreground)]"
                  >
                    {group.charAt(0).toUpperCase() + group.slice(1)}
                    <span className="text-sm font-medium text-[var(--secondary-foreground)]">
                      {selectedCount}/{ids.length}
                    </span>
                    <span
                      className={`transition-transform ml-1 ${
                        expanded ? "rotate-90" : ""
                      }`}
                    >
                      ▶
                    </span>
                  </button>
                </div>
              </div>

              {/* Group Items */}
              {expanded && (
                <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
                  {filtered.map((p) => {
                    const [action, entity] = p.name.split(":");
                    const label = `${action.charAt(0).toUpperCase() + action.slice(1)}`;
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--input)] transition-all cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="accent-[var(--primary)] w-4 h-4"
                          checked={permissions.includes(p.id)}
                          onChange={(e) =>
                            handlePermissionChange(p.id, e.target.checked)
                          }
                        />
                        <span className="text-sm font-medium text-[var(--secondary-foreground)]">
                          {label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
