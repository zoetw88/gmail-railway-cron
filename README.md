# Gmail A/B/C/D 每日整理器

每天由 Railway Cron 啟動，依序整理多個 Gmail 帳號、貼標籤、封存明確促銷信，寄出摘要後退出。規則採 first-match：同一封信只會套用第一個匹配規則。

## 安全預設

- 預設 `DRY_RUN=true`，不修改、不寄信。
- 不刪除、不回覆、不退訂。
- 不匹配的郵件留在 Inbox。
- OAuth secret／refresh token 只放 Railway Variables。
- 程式僅查詢 `in:inbox newer_than:1d`，避免第一次執行掃完整個信箱。

## Google Cloud 設定

1. 建立 Google Cloud project，啟用 **Gmail API**。
2. 設定 OAuth consent screen；若是 External／Testing，把 A、B、C 三個地址加入 Test users。
3. 建立 Desktop app OAuth client。
4. 每個 Gmail 帳號各自授權 `gmail.modify` 與 `gmail.send`，取得 refresh token。
5. 將四組資料組成 `.env.example` 所示的 `GMAIL_ACCOUNTS_JSON`。

不要把 OAuth client secret 或 refresh token 貼到聊天、GitHub、Railway logs。

## Railway

1. 將此目錄推到私人 GitHub repository，從 Railway 建立 service。
2. 新增 `GMAIL_ACCOUNTS_JSON`、`DRY_RUN=true`、`LOOKBACK=1d`。
3. Settings → Cron Schedule 設成 `30 13 * * *`（UTC，即台灣每日 21:30）。
4. 手動 Run 一次，從 logs 核對每帳號的匹配數；dry-run 不會建立標籤或寄摘要。
5. 規則確認後才把 `DRY_RUN=false`，再手動 Run 並檢查 Gmail。

Cron 執行完成後程式會退出；任一帳號失敗會留下 error log 並以非零狀態退出。

## 本機驗證

```powershell
python -m pip install -e '.[test]'
pytest -q
```

## 修改規則

編輯 `rules.json`。規則由上而下執行，越具體者應放越前面。`archive: true` 代表移除 `INBOX` 標籤；不是刪除。
