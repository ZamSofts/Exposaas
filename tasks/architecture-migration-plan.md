# アーキテクチャ移行計画

作成日：2026-04-13  
ステータス：未着手

---

## 背景・なぜやるか

現在の InvoiceJobs テーブルは「ページ単位」の処理記録であり、請求書全体（ヘッダー情報）を保持する親エンティティが存在しない。

これにより以下の機能が作れない：
- 支払いカレンダー（会場・金額・支払期日の一覧）
- 陸送依頼書への請求書情報自動入力（会場名・開催回）
- 最終ページが「empty」のとき invoiceTotal が取得できない問題

---

## 目標とする設計

```
AuctionInvoice（新・中心エンティティ）
  ├── InvoiceJobs × n（既存・ページ単位）
  └── Vehicle × n（既存・HITL確定後）
        └── TransportRequest（新・陸送依頼）
```

### AuctionInvoice（新規テーブル）
```prisma
model AuctionInvoice {
  id                Int           @id @default(autoincrement())
  companyId         Int
  parentDocumentUrl String?       // 元PDFのURL（InvoiceJobsと同じ値）
  auctionVenue      String?       // "USS大阪"
  auctionDate       DateTime?
  sessionNumber     String?       // "第1285回"
  invoiceTotal      Int?          // 差引ご請求残高
  paymentDueDate    DateTime?     // 会場ルールで自動計算・手動上書き可
  isPaid            Boolean       @default(false)
  status            String        @default("pending") // pending→completed→verified
  createdAt         DateTime      @default(now())
  company           Company       @relation(...)
  invoiceJobs       InvoiceJobs[]
  vehicles          Vehicle[]
}
```

### InvoiceJobs（既存・変更）
```prisma
// 追加
auctionInvoiceId  Int?
auctionInvoice    AuctionInvoice? @relation(...)

// 削除（AuctionInvoiceに移動）
// invoiceTotal    Int?   ← 削除
// sessionNumber   String? ← 削除
```

### Vehicle（既存・変更）
```prisma
// 追加
auctionInvoiceId    Int?
auctionInvoice      AuctionInvoice? @relation(...)
extractionDeadline  DateTime?       // 搬出期限
```

### TransportRequest（新規テーブル）
```prisma
model TransportRequest {
  id               Int      @id @default(autoincrement())
  vehicleId        Int
  transportCompany String   // "ゼロ"/"ハヤシダ"/"ベスト"/"キャリアメッセ"
  requestedById    Int
  requestedAt      DateTime @default(now())
  destination      String?  // 行き先（お客さん名）
  status           String   @default("pending") // pending/confirmed/delivered
  notes            String?
  vehicle          Vehicle  @relation(...)
  requestedBy      User     @relation(...)
}
```

---

## 実装ステップ

### Step 1: DB スキーマ追加（AuctionInvoice + TransportRequest）
**ファイル：** `prisma/schema.prisma`

やること：
1. `AuctionInvoice` モデルを追加
2. `TransportRequest` モデルを追加
3. `InvoiceJobs` に `auctionInvoiceId` FK を追加、`invoiceTotal` と `sessionNumber` を削除
4. `Vehicle` に `auctionInvoiceId` と `extractionDeadline` を追加
5. `npx prisma db push` で適用（migrate dev は使わない）
6. `npx prisma generate` でクライアント再生成

**注意：** `invoiceTotal` と `sessionNumber` を InvoiceJobs から削除する前に、それらを参照しているコードを全て確認すること。

---

### Step 2: PDF アップロード時に AuctionInvoice を作成
**ファイル：** `extra/workers/invoice.mjs`

やること：
- PDF を分割してページジョブを作成する箇所（既存）に追記
- `AuctionInvoice` を1件作成（status: "pending"）
- 各 `InvoiceJob` に `auctionInvoiceId` を設定

**着手前に確認すること：**
- `invoice.mjs` の現在の処理フロー（PDF分割→InvoiceJob作成の箇所）を読む
- `parentDocumentUrl` がどのタイミングでセットされているか確認

---

### Step 3: InvoiceJobs に auctionInvoiceId FK を紐付け
Step 2 と同時に対応。InvoiceJob 作成時に `auctionInvoiceId` をセットするだけ。

---

### Step 4: 全ページ完了後に gemini-extract-header ジョブを起動
**ファイル：** `extra/workers/invoicePage.mjs`

やること：
- 各ページ処理完了後（status 更新直後）に追記
- 同じ `parentDocumentUrl` で `status IN (pending, processing)` のジョブ数をカウント
- 0になったら `gemini-extract-header` ジョブを送信

```js
const remaining = await prisma.invoiceJobs.count({
  where: {
    parentDocumentUrl: docUrl,
    status: { in: ['pending', 'processing'] }
  }
});
if (remaining === 0) {
  await boss.send("gemini-extract-header", { auctionInvoiceId, docUrl, companyId });
}
```

**着手前に確認すること：**
- `invoicePage.mjs` の現在の処理フロー全体を読む
- status 更新の箇所（行番号）を特定してから追記

---

### Step 5: gemini-extract-header ワーカーを新規作成
**新規ファイル：** `extra/workers/invoiceHeader.mjs`

やること：
- 最終ページのみを Gemini に送る（`rawJsonResponse: true`）
- 抽出対象：`auctionVenue`, `auctionDate`, `sessionNumber`, `invoiceTotal`（差引ご請求残高）
- 結果を `AuctionInvoice` に保存
- `paymentDueDate` を会場ルールで自動計算して保存

**会場別支払いルール（確定済み）：**
| 会場 | ルール |
|------|--------|
| USS | 落札日の6日後 |
| LAA | 落札日の6日後 |
| iAuc | 落札日の6日後 |
| Isuzu | 落札日の6日後 |
| HAA | 翌週金曜日 |
| TAA | 翌週金曜日（要確認） |
| JU | 翌日（会場払い） |

祝日：1〜2日なら前倒し、長期休みは手動対応

**着手前に確認すること：**
- `extra/workers/` の既存ワーカーのひとつ（例：`invoicePage.mjs`）を読んでパターンを把握
- `extra/ai/geminiProcess.mjs` の `rawJsonResponse` オプションの使い方を確認
- `extra/queues/` でキューの登録方法を確認し、`gemini-extract-header` を登録

---

### Step 6: Vehicle に auctionInvoiceId を紐付け
**ファイル：** HITL 確定処理（`src/pages/api/createVehiclesFromInvoice.js` か類似）

やること：
- HITL で「Save & Continue」したとき、Vehicle 作成時に `auctionInvoiceId` をセット
- `AuctionInvoice.status` を "verified" に更新

**着手前に確認すること：**
- HITL 確定フローのAPIを特定（`createVehiclesFromInvoice.js` を読む）

---

## 着手前に必ず読むファイル

```
prisma/schema.prisma                    ← 現在のモデル全体
extra/workers/invoice.mjs              ← PDF分割・InvoiceJob作成
extra/workers/invoicePage.mjs          ← ページ処理（Gemini呼び出し）
extra/workers/invoiceHeader.mjs        ← 存在しない（新規作成）
extra/ai/geminiProcess.mjs             ← rawJsonResponse の使い方
extra/queues/                          ← キュー登録パターン
src/pages/api/createVehiclesFromInvoice.js  ← HITL確定フロー
src/components/InvoiceDataViewer.jsx   ← HITL UI（ヘッダー表示の追加が必要）
```

---

## 注意事項

- `npx prisma migrate dev` は使わない → `npx prisma db push` を使う（shadow DB エラー回避）
- `invoiceTotal` と `sessionNumber` は Phase 1 で InvoiceJobs に追加したが、今回 AuctionInvoice に移動して InvoiceJobs からは削除する
- ワーカーの登録は `npm run dev` 起動スクリプト（`package.json` か `extra/workers/index.mjs` 類）を確認して追加
- 本番は `shahmir` ブランチにプッシュ（`main` には絶対プッシュしない）

---

## 完了後に作れる機能

| 機能 | 依存ステップ |
|------|------------|
| 支払いカレンダー UI | Step 1〜5 完了後 |
| 陸送依頼書生成 | Step 6 完了後 |
| 陸送管理リスト | Step 1（TransportRequest）完了後 |
