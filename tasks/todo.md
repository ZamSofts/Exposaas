# Current TODO

## DX Improvements (in progress)

- [x] B. Domain layer extraction — `vehicleDomain.mjs` (resolveBrands, resolveCustomers), `parseChargesFromArray` moved to chargeMapping.mjs
- [x] A. TypeScript migration Phase 1 — domain layer (4 files) + config (2 files) converted to .ts, tsconfig.json added
- [ ] A. TypeScript migration Phase 2 — API routes, workers, remaining utils
- [ ] C. Data fetching modernization — React Query introduction
- [ ] D. Component splitting — InvoiceDataViewer, EditVehicle, Sidebar
- [ ] E. AI pipeline improvements — Zod schemas, Structured Output

## User-Facing Features (pending design decisions)

- [ ] Payment deadline auto-calculation (USS → Next Monday, etc.)
- [ ] High-confidence review skip UI
- [ ] Document completion status dashboard
- [ ] Customer billing (CustomerCharge table)

---

## English Language Support (i18n) — Plan

**Goal:** Add English UI alongside Japanese. Toggle in sidebar. Persist via cookie.

**Approach:** Custom lightweight i18n. JSON dictionaries + React Context + `useT()` hook. No external library.

### Scope summary
- ~460 UI strings across 28 files in `src/`
- ~120 strings remain in Japanese permanently (business data: auction venues, transport company names, AI prompts in `extra/`, print/export documents for Japanese recipients)

### Phase 0 — Infrastructure (no string changes yet)
- [ ] Create `src/i18n/LocaleProvider.jsx` (Provider + `useT()` + `useLocale()` + `setLocale()`)
- [ ] Create `src/i18n/dictionaries/ja.json` and `en.json` (empty skeletons with `common.*`)
- [ ] Create `src/i18n/resolveLocale.js` (pure cookie/localStorage resolver, testable)
- [ ] Create `src/i18n/index.js` (re-exports)
- [ ] Edit `src/pages/_app.jsx` — wrap in `LocaleProvider` between `SessionProvider` and `ErrorBoundary`
- [ ] Edit `src/pages/_document.jsx` — read `NEXT_LOCALE` cookie via `getInitialProps`, set `<Html lang>` dynamically (default `ja`)
- [ ] Create `src/components/sidebar/LanguageToggle.jsx` and render it in `SidebarSettings.jsx` above the logout button
- [ ] Edit `src/hooks/wrapper.js` — recognize `errorCode` in API responses and translate via `t('errors.<code>')`
- [ ] Add `src/lib/__tests__/i18n.test.js` (resolver fallback, missing-key fallback, interpolation)

### Phase 1 — Shell UI (always visible)
- [ ] `src/components/Sidebar.jsx` — `ALL_SIDEBAR_SECTIONS` labels (lines 76-107)
- [ ] `src/components/sidebar/SidebarSettings.jsx` — "ログアウト"
- [ ] `src/pages/home.jsx` — greeting, stat cards, banner, recent docs panel, `formatDateJa` becomes locale-aware
- [ ] `<Head><title>` tags across pages

### Phase 2 — Vehicle ledger (core daily workflow)
- [ ] `src/config/vehicleColumns.js` — convert `label` → `labelKey` referencing `fields.*` namespace
- [ ] `src/pages/vehicle.jsx` — toasts, "列を表示", merge `FIELD_LABELS` into shared `fields.*` dictionary
- [ ] `src/components/VehicleRow.jsx` — icon tooltips ("輸出抹消", "統合済み" etc.)
- [ ] `src/components/VehicleHistory.jsx` — `FIELD_LABELS` (de-duplicate with vehicle.jsx)
- [ ] `src/components/ui/DataTable.jsx` — "全件"

### Phase 3 — Documents + Invoice review
- [ ] `src/pages/documents.jsx` — table headers, banners, error-code lookup, modals
- [ ] `src/components/InvoiceDataViewer.jsx` — header labels ("会場", "支払期日" etc.), placeholders
- [ ] `src/components/SaveResultModal.jsx`
- [ ] `src/components/DocumentViewer.jsx` — switch existing `labelJa`/`labelEn` to `useT()`
- [ ] `src/components/invoice/DetailModeEditor.jsx`
- [ ] `src/lib/invoiceJobUtils.js` — `STATUS_CONFIG` "要確認"

### Phase 4 — Export templates
- [ ] `src/pages/exportTemplates.jsx` — toasts, modals, empty state
- [ ] `src/components/export/ColumnPicker.jsx`
- [ ] `src/components/export/ExportDropdown.jsx`
- [ ] `src/components/export/ExportTemplateEditor.jsx`
- [ ] `src/components/export/FooterRowEditor.jsx`
- [ ] `src/components/export/FormulaBuilder.jsx` — share `fields.*` dictionary

### Phase 5 — Transport
- [ ] `src/pages/transport.jsx` — filter labels, modal, alerts
- [ ] `src/pages/transport/print.jsx` — UI buttons only; print layout stays Japanese (B2B output for Japanese carriers)

### Phase 6 — Calendar + Prompts + audit log
- [ ] `src/pages/calendar.jsx` — `WEEKDAYS`, `PAYMENT_TYPES`, legend
- [ ] `src/pages/prompts.jsx` — 3 toasts
- [ ] `src/pages/api/vehicleAuditLog.js` — return raw codes (`create`, `export_cert` etc.); translate client-side in VehicleHistory
- [ ] `src/pages/api/linkDocumentToVehicle.js` — return docType code, translate client-side

### Phase 7 — Polish
- [ ] Native `alert()` / `confirm()` calls in transport.jsx
- [ ] Migrate user-facing API endpoints to `errorCode` pattern (~8 endpoints: role, promptVersion, vehicle, transportRequests etc.)
- [ ] Lint script: grep for Japanese characters in `src/components/**.jsx` and `src/pages/**.jsx` to prevent regression

### Decisions made (recommendations to confirm)
- **Persistence:** cookie (`NEXT_LOCALE`) + localStorage mirror. No DB field in v1.
- **SSR:** read cookie in `_document.getInitialProps` to set `<Html lang>` and avoid flash.
- **Default locale:** `ja` (preserve current UX). No browser auto-detection.
- **Print/Excel exports:** stay Japanese (recipients are Japanese carriers).
- **AI prompts in `extra/`:** stay Japanese (Gemini performance depends on it).
- **Currency:** keep `¥` symbol (JPY business reality).
- **Native `alert()`:** translate string at call site (don't replace with modals in v1).

### Open questions for user
1. English date format: `Apr 21, 2026` (US) or `21 Apr 2026` (UK)?
2. Should we add a `User.locale` DB field now or defer (cookie-only is fine for v1)?
3. Confirm: print/export documents stay Japanese even when UI is English?
4. Should Phase 0 be one PR (infra only, English not visible yet), or batch with Phase 1?
