# Lessons Learned

## 2026-02-27: Domain Layer Extraction

### Lesson: Don't over-abstract
- Vehicle upsert logic looks similar across `createVehiclesFromInvoice.js` and `vehicle.mjs`, but the differences (batching, metadata fields, auctionDate handling) make a shared abstraction more complex than the originals.
- Only extract what is **genuinely identical**. Brand/customer find-or-create was truly duplicated. Vehicle upsert was not.

### Lesson: paymentConfirmation.js is fundamentally different
- It uses find-then-create (never updates), charges go to VehiclePayments table (not Vehicle columns), and has no tax calculation.
- Don't force unification with the upsert-based flows in createVehiclesFromInvoice and vehicle.mjs.

### Lesson: Check for missing race condition protection
- `paymentConfirmation.js` brand creation lacked P2002 catch — a real bug found during the extraction. Always check if concurrent-safe patterns are consistently applied.

## 2026-02-27: TypeScript Migration Phase 1

### Lesson: Node 24 has native .ts support — tsx is unnecessary
- Node.js v24 can import `.ts` files directly from `.mjs` files without any loader or transpiler.
- `tsx` (TypeScript Execute) actually **conflicted** with Node 24's native handling when used with `-r dotenv/config`.
- **Rule: Check Node.js version before adding tsx/ts-node.** Node 22.6+ has `--experimental-strip-types`, Node 24+ has it enabled by default.

### Lesson: .mjs files need explicit .ts extensions in imports
- `.mjs` files enforce strict ESM resolution — extensionless imports like `from "../utils/auditLog"` don't resolve to `.ts` files.
- `.js` files in Next.js API routes go through webpack, which resolves extensionless → `.ts` automatically.
- **Rule: In `.mjs` worker files, always use explicit `.ts` extension** (e.g., `from "../utils/auditLog.ts"`). In `.js` API routes, extensionless is fine.

### Lesson: Use structural typing (interfaces) instead of importing PrismaClient in shared utils
- `extra/utils/` files can't easily import from `src/generated/prisma/` (path mismatch between API routes and workers).
- Solution: Define minimal interfaces (`AuditPrisma`, `BrandPrisma`) that describe only the methods needed.
- This is more flexible (works with any object matching the shape) and avoids import path headaches.

### Lesson: MODULE_TYPELESS_PACKAGE_JSON warning is harmless
- Node 24 warns when a `.ts` file has no `"type": "module"` in its nearest package.json.
- Adding `"type": "module"` to root package.json would fix it but could break other things.
- The warning doesn't affect functionality — ignore it for now.

---

### Lesson: DX improvements vs user-facing features
- User pointed out that all proposed architectural changes (TypeScript, domain layer, React Query, App Router, component splitting) change zero user experience.
- **Rule: Always state whether a proposed change affects users or only developers.** Prioritize user-facing work unless explicitly told to focus on DX.

## 2026-02-27: Architecture Redesign Discussion

### Lesson: 「ゼロから再設計するなら」に理想論で答えない
- 5つの改善（App Router, Hono RPC, ドメイン分離, Full TS, テスト）を全部並べたら実質full rewrite。自分で「リスクの方が重要」と言いながら矛盾した提案をした。
- **Rule: 提案する改善は「今の実害」に対応するものに絞る。理想のアーキテクチャと実行可能な改善を明確に分ける。**

### Lesson: Pages Routerは「レガシー」ではない
- Next.js 15でPages Routerは完全サポートされている。App Routerへの移行は、21個のAPI Route書き直し＋Server Components対応で工数が巨大。得られるメリット（SSRパフォーマンス等）は現規模では問題になっていない。
- **Rule: 「公式がレガシーと呼んでいる」だけで移行を提案しない。実害があるかを先に確認する。**

### Lesson: 型安全はフレームワーク導入より型定義追加が先
- tRPC/Hono RPCはAPI型安全を提供するが導入コストが高い。APIレスポンスにTypeScript型を付けるだけで8割の問題は解決する。
- **Rule: 新しいフレームワーク/ライブラリを提案する前に、既存ツールの範囲内でどこまで解決できるかを先に示す。**
