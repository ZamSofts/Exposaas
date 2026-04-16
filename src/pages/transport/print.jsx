import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { getPosNumber } from "@/config/venuePosNumbers";

function toDateDisplay(val) {
  if (!val) return "—";
  const d = new Date(val);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
}

export default function TransportPrintPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const { company, requester, orderDate, ids } = router.query;

  useEffect(() => {
    if (!ids) return;
    const idList = ids.split(",").map(Number).filter(Boolean);
    if (idList.length === 0) return;

    // Fetch vehicle details from transport API
    fetch(`/api/transportRequests?status=all`)
      .then(r => r.json())
      .then(data => {
        const all = data?.data ?? [];
        const filtered = idList.map(id => all.find(v => v.id === id)).filter(Boolean);
        setVehicles(filtered);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ids]);

  const displayDate = orderDate
    ? orderDate.replace(/-/g, "/")
    : toDateDisplay(new Date());

  if (loading) {
    return <div className="p-8 text-center text-gray-400">読み込み中...</div>;
  }

  return (
    <>
      <Head>
        <title>陸送依頼書 — {company}</title>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { margin: 0; }
            @page { size: A4 portrait; margin: 12mm; }
            .print-wrap { max-width: 100% !important; padding: 0 !important; }
            table { font-size: 10px; }
          }
          body { font-family: "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif; }
        `}</style>
      </Head>

      <div className="max-w-2xl mx-auto p-6 print-wrap">

        {/* 印刷ボタン */}
        <div className="no-print flex justify-end gap-3 mb-6">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            印刷 / PDF保存
          </button>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            閉じる
          </button>
        </div>

        {/* 依頼書本体 */}
        <div className="border border-gray-400 p-6">

          {/* タイトル */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-widest">陸　送　依　頼　書</h1>
          </div>

          {/* ヘッダー情報 */}
          <div className="flex justify-between mb-6 text-sm">
            <div className="space-y-1">
              <div>
                <span className="font-bold text-base">{company}</span>
                <span className="ml-2 text-gray-500">御中</span>
              </div>
            </div>
            <div className="text-right space-y-1 text-gray-700">
              <div>依頼日：{displayDate}</div>
              {requester && <div>依頼者：{requester}</div>}
            </div>
          </div>

          {/* 車両テーブル */}
          <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "4%" }} />   {/* No. */}
              <col style={{ width: "19%" }} />  {/* 車体番号 */}
              <col style={{ width: "8%" }} />   {/* 出品番号 */}
              <col style={{ width: "9%" }} />   {/* 開催回 */}
              <col style={{ width: "15%" }} />  {/* 会場 */}
              <col style={{ width: "9%" }} />   {/* POS番号 */}
              <col style={{ width: "12%" }} />  {/* 開催日 */}
              <col style={{ width: "12%" }} />  {/* 搬出期限 */}
              <col style={{ width: "12%" }} />  {/* 行き先 */}
            </colgroup>
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 px-2 py-2 text-center text-xs">No.</th>
                <th className="border border-gray-400 px-2 py-2 text-left text-xs">車体番号</th>
                <th className="border border-gray-400 px-2 py-2 text-left text-xs">出品番号</th>
                <th className="border border-gray-400 px-2 py-2 text-left text-xs">開催回</th>
                <th className="border border-gray-400 px-2 py-2 text-left text-xs">会場</th>
                <th className="border border-gray-400 px-2 py-2 text-left text-xs">POS番号</th>
                <th className="border border-gray-400 px-2 py-2 text-left text-xs">開催日</th>
                <th className="border border-gray-400 px-2 py-2 text-left text-xs">搬出期限</th>
                <th className="border border-gray-400 px-2 py-2 text-left text-xs">行き先</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v, i) => {
                const dest = v.transportRequest?.destination ?? v.deliverTo ?? v.customer?.name ?? "";
                const posNumber = getPosNumber(v.auction);
                return (
                  <tr key={v.id} className={i % 2 === 0 ? "" : "bg-gray-50"}>
                    <td className="border border-gray-400 px-2 py-2 text-center text-gray-500 text-xs">{i + 1}</td>
                    <td className="border border-gray-400 px-2 py-2 font-mono font-bold text-xs">{v.chassisNumber}</td>
                    <td className="border border-gray-400 px-2 py-2 text-xs">{v.lotNumber ?? "—"}</td>
                    <td className="border border-gray-400 px-2 py-2 text-xs">{v.session ?? v.auctionInvoice?.sessionNumber ?? "—"}</td>
                    <td className="border border-gray-400 px-2 py-2 text-xs">{v.auction ?? "—"}</td>
                    <td className="border border-gray-400 px-2 py-2 text-xs font-medium">{posNumber ?? "—"}</td>
                    <td className="border border-gray-400 px-2 py-2 text-xs whitespace-nowrap">{v.auctionDate ?? "—"}</td>
                    <td className="border border-gray-400 px-2 py-2 text-xs whitespace-nowrap">
                      {v.extractionDeadline ? toDateDisplay(v.extractionDeadline) : "—"}
                    </td>
                    <td className="border border-gray-400 px-2 py-2 text-xs">{dest || "—"}</td>
                  </tr>
                );
              })}
              {/* 空行パディング（最低5行） */}
              {Array.from({ length: Math.max(0, 5 - vehicles.length) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-gray-400 px-2 py-3 text-center text-gray-300 text-xs">{vehicles.length + i + 1}</td>
                  <td className="border border-gray-400 px-2 py-3" />
                  <td className="border border-gray-400 px-2 py-3" />
                  <td className="border border-gray-400 px-2 py-3" />
                  <td className="border border-gray-400 px-2 py-3" />
                  <td className="border border-gray-400 px-2 py-3" />
                  <td className="border border-gray-400 px-2 py-3" />
                  <td className="border border-gray-400 px-2 py-3" />
                  <td className="border border-gray-400 px-2 py-3" />
                </tr>
              ))}
            </tbody>
          </table>

          {/* フッター */}
          <div className="mt-6 text-sm text-gray-600">
            <p>合計：{vehicles.length} 台</p>
          </div>

          {/* 備考欄（クリックして直接入力可） */}
          <div className="mt-4">
            <div className="text-sm font-bold mb-1">
              備考
              <span className="no-print ml-2 text-xs text-gray-400 font-normal">※ クリックして入力できます</span>
            </div>
            <div
              contentEditable
              suppressContentEditableWarning
              className="border border-gray-400 h-16 p-2 text-sm outline-none focus:border-blue-400"
              style={{ minHeight: "4rem" }}
            />
          </div>

        </div>
      </div>
    </>
  );
}
