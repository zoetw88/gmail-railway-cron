# Audit

## Privacy

- 處理資料：寄件者、Gmail 搜尋匹配與 message ID；信件本文不送至第三方 AI。
- 儲存：程式不持久化郵件內容；Railway logs 僅記錄各標籤數量，不記錄 message ID。
- 第三方分享：Google Gmail API 與 Railway 執行環境；無 AI provider。
- 刪除：程式不刪信；封存只移除 `INBOX` 標籤。撤銷 Google OAuth token 可終止存取。

## Blockers

- 尚未在 Railway 實際部署與執行 smoke test。
