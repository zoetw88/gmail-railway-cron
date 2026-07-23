# PWA-001 Audit

## 隱私與安全

- 保存資料：瀏覽器 Push endpoint、p256dh/auth 公鑰材料、建立時間、最後推送摘要 ID。
- 保存期限：訂閱持續至使用者關閉通知；失效 endpoint 在 404/410 時自動刪除。
- 第三方分享：推播供應商只收到通知標題、安全摘要與 Gmail 深層連結，不收到郵件全文。
- 刪除方式：使用者在儀表板關閉通知時，伺服器刪除該裝置訂閱。
- 授權：訂閱新增、查詢與刪除皆要求 ChatGPT 登入且電子郵件在允許清單。
- 濫用防護：每位檢視者最多 10 個裝置；輸入長度與 endpoint 協定受限。
- 金鑰：VAPID 私鑰僅存 Sites secret，不提交版本控制。

## 驗證證據

- `npm test`：建置成功，2/2 儀表板契約測試通過。
- 隔離 Python 環境 `python -m pytest -q`：23/23 通過。
- Web Push 加密 smoke：成功建立 VAPID Authorization 與加密 payload。
- 正式網站 v8 瀏覽器 smoke：標題與 manifest 正確載入；通知元件由初始化狀態切換至瀏覽器權限狀態，無卡住。
- `npm audit --omit=dev`：Next 本體已升級至 16.2.11；仍回報 Next 內含的 PostCSS 與 Sharp 上游弱點，現有套件線無相容修補版。此站不接受使用者 CSS、也不使用不可信圖片轉換，曝險面受限。
