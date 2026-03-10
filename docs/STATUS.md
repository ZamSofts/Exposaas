# Current Status & Roadmap

## Metrics (updated: 2026-03-06)

| Metric | Value |
|--------|-------|
| PaymentConfirmation records | 74 |
| Golden records | 33 (across 22 auctions) |
| PromptVersion | v1.0 (schema_default, score: unscored) |
| auctionHouse null records | 24 (need review) |
| Test suite | 104 tests across 5 suites (Vitest) |
| DX audit issues fixed | 44/48 (92%) |

---

## Business Model: AI BPO (AI Agent with Human)

Exposaasは顧客にSaaSを提供するのではなく、**AI BPOサービス**として運営する。

- **顧客のGmail** → Movfax経由でPDFが自動転送される → システムが自動取込
- **AIが主体的に処理** → 分類・抽出を自律実行
- **オペレーター（自分）が確認** → 全顧客のデータを横断的にレビュー・修正
- **修正がAI学習に反映** → 精度が上がり、人の負担が減る改善サイクル

**設計思想:** "Human with AI tools"（人がAIを呼ぶ）ではなく、"AI Agent with Human"（AIが人を呼ぶ）。`needsApproval: true` の向き先がオペレーター。（参考: LayerX AI BPO定義）

### なぜAI BPOか（3つの戦略的利点）

**1. AIの進化を待たずに今すぐ提供できる**
AIの能力はギザギザ（Karpathyの「ゴースト」比喩）。AIが苦手な部分は人がカバーし、今この瞬間から業務を完遂する。裏側ではゴールデンデータを蓄積し、AIの進化に伴い自動化範囲を徐々に拡大。**「先に提供し、後から置き換える」**。

**2. デプロイ速度**
新モデルで能力がアンロックされた時、自社オペレーションを変えるだけで全顧客が恩恵を受ける。SaaSなら各社に「使い方を変えてください」と説得が必要。AI BPOならオペレーション改善が即座に全顧客に反映される。

**3. 営業のシンプル化**
裏側では分類Agent・抽出Agent・復号Agent等が動くが、顧客には「落札書1枚あたりXX円」で提供。業務コストとの直接比較が可能。シンプルなものはスケールする。

### 課金モデル

- **単位:** 落札書1枚（= 1 PaymentConfirmation）あたりの処理費
- **裏側のコスト:** Gemini API + Azure Storage + オペレーター時間
- **スケール:** ゴールデンデータ増加 → AI精度向上 → オペレーター時間減少 → 利益率向上

---

## Priority Queue

### Tier 1: オペレーション効率（今すぐ必要）
1. **オペレーター管理画面** -- 全社横断のワークキュー（未レビューインボイス一覧）、会社切り替え不要の統合ビュー、連続レビューフロー
2. **Golden data accumulation** -- Target: 3+ per major auction house, continue reviewing invoices
3. **auctionHouse null cleanup** -- Review 24 records, assign auction names

### Tier 2: データモート（中期）
4. **ExtractionDiff テーブル** -- フィールド別・オークション別の抽出精度を構造化して集計可能に
5. **市場インテリジェンスAPI** -- 車両価格・手数料の時系列集計（将来の追加価値）
6. **ドキュメントライフサイクル** -- 車両ごとの書類完備状況（落札書・輸出抹消・車検証）

### Tier 3: 拡張（顧客が求めてから）
7. **Payment Deadline Tracking** -- Auto-calculate due dates based on auction-specific rules
8. **Customer Billing** -- CustomerCharge table, separate from VehicleCharge acquisition costs

### Done
- ~~**Embedding Few-Shot Selection**~~ -- Gemini Embedding API cosine similarity + auto-embed on golden toggle + Soft HITL prompt in SaveResultModal
- ~~**Vehicle Audit Trail**~~ -- VehicleAuditLog table, 8 instrumented endpoints/workers, History tab UI, fire-and-forget logging

---

## Known Data Issues

- auctionHouse null: 24 records missing auction name -- limits few-shot matching
- Auction name variants: e.g. "ARAI" / "ARAI AUCTIONS" may be the same
- chassis_number diff was previously suppressed by normalization (fixed: `computeDiff.mjs` now preserves format differences like hyphens)

---

## Recent Changes

### 2026-03-06
- CI/CD: GitHub Actions pipeline (lint, test, build on shahmir push; auto-deploy on main merge)
- Converted all TypeScript files back to JavaScript (production Docker uses Node 22, can't run .ts)
- Added strict rules to CLAUDE.md: no TypeScript, no Dockerfile modifications, never push to main

### 2026-03-05
- Test infrastructure: Vitest with 104 tests across 5 suites (chargeMapping, computeDiff, embedding, invoiceJobUtils, vehicleFilters)
- Dead Letter Queue: pg-boss `ensureQueue()` creates companion `__dlq` queues
- Status enum: `InvoiceJobs.status` migrated from `String` to `JobStatus` enum
- Multi-file upload: `useFileUpload` hook + `FileUploadModal` support multiple file selection
- Audit FK: `Vehicle.createdById/updatedById`, `PaymentConfirmation.reviewedById` changed from `String?` to `Int?`
- Security: login rate limiting, security headers, env validation at startup
- Performance: N+1 fix in evaluationDataset, recharts tree-shaking, vehicle bulk fetch limit 5000→500

### 2026-02-27
- Domain layer extraction: `vehicleDomain.mjs` with `resolveBrands` and `resolveCustomers`
- Moved `parseChargesFromArray` into `chargeMapping.mjs` (was duplicated)
- Bug fix: `paymentConfirmation.js` brand creation P2002 race condition protection

### 2026-02-21
- Added Vehicle Audit Trail (feature #19): VehicleAuditLog model, 8 instrumented endpoints/workers
- Removed unused deps (`@cyntler/react-doc-viewer`, dead exports, unused functions)
