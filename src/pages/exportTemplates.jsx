import { useState } from "react";
import Head from "next/head";
import { useAuth, API, useConfirm, Error, Loader, Toast, usePaginatedList, queryKeys } from "@/hooks/wrapper";
import { useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import ExportTemplateEditor from "@/components/export/ExportTemplateEditor";
import { Plus, Edit, Trash2, FileSpreadsheet, Columns3, Calculator, ListEnd } from "lucide-react";

export default function ExportTemplates() {
  const { session } = useAuth(["view:vehicle"]);
  const { confirm, ConfirmComponent } = useConfirm();
  const queryClient = useQueryClient();

  // ── Data fetching ──
  const {
    items: templates, total, isLoading, error: listError,
    handleSearch, handleSort, handlePageChange,
  } = usePaginatedList(queryKeys.exportTemplates, "exportTemplate", {
    defaultPerPage: 20,
    select: (res) => ({
      items: res.templates || [],
      total: res.total || 0,
    }),
  });

  // ── Form state ──
  const [edit, setEdit] = useState(null); // null=list, 0=create, id=edit
  const [editData, setEditData] = useState(null); // template data for editing
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["exportTemplates"] });

  const showToast = (message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  };

  // ── Load template for editing ──
  const loadForEdit = async (id) => {
    const data = await API("GET", `exportTemplate?id=${id}`);
    if (data.error) {
      showToast(data.error, "error");
      return;
    }
    setEditData(data);
    setEdit(id);
  };

  // ── Save (create or update) ──
  const handleSave = async (formData) => {
    setIsSaving(true);
    setError("");

    const payload = {
      ...formData,
      companyId: Number(session?.companyId),
    };

    try {
      if (edit === 0) {
        // Create
        const data = await API("PUT", "exportTemplate", payload);
        if (data.error) {
          setError(data.error);
          showToast(data.error, "error");
          setIsSaving(false);
          return;
        }
        showToast("テンプレートを作成しました", "success");
      } else {
        // Update
        const data = await API("POST", "exportTemplate", { ...payload, id: edit });
        if (data.error) {
          setError(data.error);
          showToast(data.error, "error");
          setIsSaving(false);
          return;
        }
        showToast("テンプレートを更新しました", "success");
      }

      setEdit(null);
      setEditData(null);
      setIsSaving(false);
      invalidate();
    } catch (err) {
      setError(err.message || "保存に失敗しました");
      setIsSaving(false);
    }
  };

  // ── Delete ──
  const deleteIt = async (id) => {
    const confirmed = await confirm({
      title: "テンプレート削除",
      message: "このエクスポートテンプレートを削除しますか？この操作は取り消せません。",
      confirmText: "削除",
      type: "danger",
    });
    if (!confirmed) return;

    const data = await API("DELETE", `exportTemplate?id=${id}`);
    if (data.error) {
      showToast(data.error, "error");
      return;
    }
    showToast("テンプレートを削除しました", "success");
    invalidate();
  };

  return (
    <>
      <Head>
        <title>Export Templates - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="p-4 sm:p-6 bg-[var(--background)] min-h-screen">
          <Error message={listError || error} />

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-lg font-bold text-[var(--foreground)]">
                <FileSpreadsheet className="inline-block w-5 h-5 mr-2 -mt-0.5" />
                エクスポートテンプレート
              </h1>
              <p className="text-xs text-[var(--secondary-foreground)] mt-1">
                車両データのExcelエクスポート用テンプレートを管理します
              </p>
            </div>
            {edit === null && (
              <button
                onClick={() => { setEdit(0); setEditData(null); setError(""); }}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium
                           bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)]
                           transition-colors"
              >
                <Plus className="w-4 h-4" /> 新規作成
              </button>
            )}
          </div>

          {/* Editor Form */}
          {edit !== null && (
            <div className="mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
              <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">
                {edit === 0 ? "新規テンプレート作成" : "テンプレート編集"}
              </h2>
              <ExportTemplateEditor
                template={editData}
                onSave={handleSave}
                onCancel={() => { setEdit(null); setEditData(null); setError(""); }}
                isSaving={isSaving}
              />
            </div>
          )}

          {/* Template List */}
          {edit === null && (
            <>
              {isLoading ? (
                <Loader />
              ) : templates.length === 0 ? (
                <div className="text-center py-16 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-[var(--secondary-foreground)] mb-3" />
                  <p className="text-sm text-[var(--secondary-foreground)]">
                    テンプレートがまだありません
                  </p>
                  <p className="text-xs text-[var(--secondary-foreground)] mt-1">
                    「新規作成」ボタンからテンプレートを作成してください
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-3 hover:border-[var(--primary)]/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-[var(--foreground)] truncate">
                          {t.name}
                        </h3>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="flex items-center gap-1 text-[10px] text-[var(--secondary-foreground)]">
                            <Columns3 className="w-3 h-3" />
                            {(t.columns || []).length} カラム
                          </span>
                          {(t.computedColumns || []).length > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-[var(--secondary-foreground)]">
                              <Calculator className="w-3 h-3" />
                              {t.computedColumns.length} 計算
                            </span>
                          )}
                          {(t.footerRows || []).length > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-[var(--secondary-foreground)]">
                              <ListEnd className="w-3 h-3" />
                              {t.footerRows.length} フッター
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--secondary-foreground)]">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => loadForEdit(t.id)}
                          className="p-1.5 rounded hover:bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:text-[var(--foreground)] transition-colors"
                          title="編集"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteIt(t.id)}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--secondary-foreground)] hover:text-red-500 transition-colors"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Sidebar>

      <ConfirmComponent />
      <Toast
        id={toast.id}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast({ id: 0, message: "", type: "success" })}
      />
    </>
  );
}
