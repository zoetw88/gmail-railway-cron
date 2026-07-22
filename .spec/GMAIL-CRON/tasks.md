# Acceptance criteria

- [x] 支援多個 Gmail OAuth 帳號並依序執行。
- [x] 規則式貼標籤與可選封存，未匹配郵件不變。
- [x] dry-run 不產生任何 Gmail 寫入。
- [x] 非 dry-run 完成後寄送逐帳號摘要。
- [x] 個別帳號失敗不阻止後續帳號嘗試，最終以非零狀態退出。
- [x] 四個真實帳號完成 OAuth，並以 Gmail profile API 精確驗證帳號。
- [x] 四個帳號完成只讀 Gmail API smoke test（profile、labels、recent Inbox query）。
- [ ] Railway dry-run logs 與 Gmail 實際畫面驗證（需外部帳號）。
- [x] GLM 僅接收 sender、subject、最長 500 字 snippet，並驗證結構化分類輸出。
- [x] AI 預設關閉且只建議；即使啟用貼標籤也不會由 AI 封存。
- [x] 可選 LINE Messaging API 摘要，未設定不影響 Gmail 整理。
- [x] `railway.json` 宣告台灣每日 21:30 的 UTC cron 與不重啟政策。
- [x] MIT 授權與公開部署、資料分享、停用／刪除說明完整。
- [x] 本機 Python 3.12 隔離環境測試通過（10 tests）。
- [ ] GitHub Actions 測試通過（帳號 billing／spending limit 阻止 runner 啟動）。
- [ ] repository 公開並發布 Railway Template（需使用者確認公開權限變更）。
