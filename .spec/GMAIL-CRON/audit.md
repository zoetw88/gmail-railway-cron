# Audit

## Privacy

- 處理資料：寄件者、主旨、Gmail snippet、搜尋匹配與 message ID；完整信件本文不送至第三方 AI。
- 儲存：程式不持久化郵件內容；Railway logs 僅記錄各標籤數量，不記錄 message ID。
- 第三方分享：Google Gmail API 與 Railway 執行環境；啟用 AI 時，sender、subject 與最長 500 字 snippet 傳給 GLM；啟用 LINE 時，數量與短摘要傳給 LINE。
- 刪除：程式不刪信；封存只移除 `INBOX` 標籤。撤銷 Google OAuth token 可終止存取。

## Blockers

- 尚未在 Railway 實際部署與執行 smoke test。
- 尚未取得使用者 GLM／LINE secrets，因此未做第三方 live smoke test。
- GitHub repository 已公開；Railway Template 已發布為 `gmail-ai-daily-organizer`，公開頁面顯示一個必要變數 `GMAIL_ACCOUNTS_JSON`。
- GitHub Actions run `29894476978` 未啟動 runner：GitHub 回報付款失敗或 spending limit 不足；非測試失敗。本機 `uv --system-certs run --python 3.12 --extra test pytest -q` 為 10 passed。
