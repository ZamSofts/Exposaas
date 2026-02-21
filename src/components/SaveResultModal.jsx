import React from "react";
import { Check, PenLine, Star, X } from "lucide-react";

/**
 * Modal displaying diff results after saving a payment confirmation.
 * Shows whether the AI extraction was exact or corrected, per-vehicle field/charge diffs,
 * and prominently prompts to mark the record as golden training data.
 *
 * Golden prompt strategy (Soft HITL):
 * - Both exact_match and corrected records show the golden prompt
 * - Corrected records are especially valuable as training data (they teach the AI what it got wrong)
 * - One-click to add to training data, reducing friction vs navigating to a separate page
 *
 * @param {object} props
 * @param {object} props.saveResult - { paymentConfirmationId, isCorrect, diffSummary, isGolden }
 * @param {() => void} props.onClose - Close the modal
 * @param {() => Promise<void>} props.onMarkGolden - Mark the record as golden
 */
export default function SaveResultModal({ saveResult, onClose, onMarkGolden }) {
  if (!saveResult) return null;

  const isExact = saveResult.isCorrect === "exact_match";
  const isAlreadyGolden = saveResult.isGolden;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {isExact ? (
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Check className="w-6 h-6 text-green-500" />
            </div>
          ) : (
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <PenLine className="w-6 h-6 text-amber-500" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              {isExact ? "Exact Match" : "Corrected"}
            </h3>
            <p className="text-sm text-[var(--secondary-foreground)]">
              {isExact
                ? "AI抽出結果に修正なし"
                : `${saveResult.diffSummary?.totalFieldsChanged || 0}件の修正`}
            </p>
          </div>
        </div>

        {/* Diff Details (only for corrected) */}
        {!isExact && saveResult.diffSummary?.vehicles?.length > 0 && (
          <div className="mb-4 space-y-3 max-h-60 overflow-y-auto">
            {saveResult.diffSummary.vehicles.map((v, vi) => (
              <div key={vi} className="bg-[var(--background)] rounded-lg p-3 border border-[var(--border)]">
                <p className="text-xs font-medium text-[var(--secondary-foreground)] mb-2">
                  車両 {v.index + 1}
                </p>

                {/* Field changes */}
                {Object.entries(v.fields || {}).map(([field, change]) => (
                  <div key={field} className="flex items-center gap-2 text-sm mb-1">
                    <span className="text-[var(--muted-foreground)] w-28 shrink-0">{field}:</span>
                    <span className="text-red-400 line-through">{change.original || "(空)"}</span>
                    <span className="text-[var(--muted-foreground)]">→</span>
                    <span className="text-green-400">{change.corrected || "(空)"}</span>
                  </div>
                ))}

                {/* Charge changes */}
                {v.charges?.changed?.map((c, ci) => (
                  <div key={`changed-${ci}`} className="flex items-center gap-2 text-sm mb-1">
                    <span className="text-[var(--muted-foreground)] w-28 shrink-0">{c.type}:</span>
                    <span className="text-red-400 line-through">{c.original?.toLocaleString()}</span>
                    <span className="text-[var(--muted-foreground)]">→</span>
                    <span className="text-green-400">{c.corrected?.toLocaleString()}</span>
                  </div>
                ))}
                {v.charges?.added?.map((c, ci) => (
                  <div key={`added-${ci}`} className="text-sm mb-1">
                    <span className="text-green-400">+ {c.type}: {c.amount?.toLocaleString()}</span>
                  </div>
                ))}
                {v.charges?.removed?.map((c, ci) => (
                  <div key={`removed-${ci}`} className="text-sm mb-1">
                    <span className="text-red-400">- {c.type}: {c.amount?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Golden Training Data Prompt - prominent placement */}
        {!isAlreadyGolden && (
          <div className="mb-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-[var(--foreground)] mb-3">
              {isExact
                ? "AIの抽出が正確でした。トレーニングデータに追加しますか？"
                : "修正内容をAIの学習に活用できます。トレーニングデータに追加しますか？"}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onMarkGolden}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                <Star className="w-4 h-4" />
                追加する
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--secondary-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                スキップ
              </button>
            </div>
          </div>
        )}

        {/* Already golden indicator */}
        {isAlreadyGolden && (
          <div className="mb-4 flex items-center gap-2 text-amber-500">
            <Star className="w-4 h-4 fill-current" />
            <span className="text-sm font-medium">トレーニングデータに追加済み</span>
          </div>
        )}

        {/* Close button - secondary when golden prompt is showing */}
        {isAlreadyGolden && (
          <div className="flex justify-end pt-3 border-t border-[var(--border)]">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-opacity"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
