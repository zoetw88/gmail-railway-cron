# Gmail A/B/C/D 每日整理器

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/gmail-ai-daily-organizer)

每天由 Railway Cron 啟動，依序整理多個 Gmail 帳號、貼標籤、封存明確促銷信，寄出摘要後退出。可選用 GLM 分類未匹配郵件，並把每日摘要推送到 LINE。規則採 first-match：同一封信只會套用第一個匹配規則。

## 安全預設

- 預設 `DRY_RUN=true`，不修改、不寄信。
- 不刪除、不回覆、不退訂。
- 不匹配的郵件留在 Inbox。
- OAuth secret／refresh token 只放 Railway Variables。
- 程式僅查詢 `in:inbox newer_than:1d`，避免第一次執行掃完整個信箱。
- AI 預設關閉；開啟後也只提供建議，不會由 AI 封存郵件。
- GLM 只接收寄件者、主旨與最多 500 字 Gmail snippet，不接收完整信件本文。

## Railway 部署

`railway.json` 已把排程固定為 `30 13 * * *`（UTC，即台灣每日 21:30），並設定執行完不重啟。點上方按鈕即可從公開 Railway Template 部署。

部署後至少設定：

- `GMAIL_ACCOUNTS_JSON`：一個或多個 Gmail OAuth 帳號。
- `DRY_RUN=true`：第一次務必保持試跑。
- `LOOKBACK=1d`：只處理最近一天。

先手動 Run，從 logs 核對每個帳號的匹配數；確認規則後才把 `DRY_RUN=false`。Cron 執行完成後程式會退出；任一帳號失敗會留下 error log 並以非零狀態退出。

## Google Cloud 設定

1. 建立 Google Cloud project，啟用 **Gmail API**。
2. 設定 OAuth consent screen；若是 External／Testing，把 A、B、C 三個地址加入 Test users。
3. 建立 Desktop app OAuth client。
4. 每個 Gmail 帳號各自授權 `gmail.modify` 與 `gmail.send`，取得 refresh token。
5. 將四組資料組成 `.env.example` 所示的 `GMAIL_ACCOUNTS_JSON`。

不要把 OAuth client secret 或 refresh token 貼到聊天、GitHub、Railway logs。

## 選用 GLM AI

在 Railway Variables 設定：

- `AI_ENABLED=true`
- `GLM_API_KEY`：你的 GLM API key，切勿提交到 GitHub。
- `GLM_MODEL=glm-4.7-flashx`（可自行更換相容模型）
- `AI_APPLY_LABELS=false`（建議先保持只建議）

如果日後設成 `AI_APPLY_LABELS=true`，只有信心高於 `AI_CONFIDENCE_THRESHOLD` 的分類才會貼標籤；仍不會封存。

## 選用 LINE 摘要

LINE Notify 已終止，本專案使用 LINE Messaging API。建立 LINE Official Account 與 Messaging API channel 後，在 Railway Variables 設定：

- `LINE_ENABLED=true`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_USER_ID`（`U` 加 32 個字元）

摘要會在所有 Gmail 帳號成功處理後推送。LINE 設定錯誤會讓該次 job 以失敗結束，方便從 Railway logs 發現。

## 資料與隱私

- Gmail：程式透過 Google OAuth 讀取郵件中繼資料、貼標籤、封存及寄摘要；不刪信。
- Railway：執行環境持有 secrets；logs 只記帳號代號、分類與數量，不記 token 或 message ID。
- GLM（選用）：寄件者、主旨、最多 500 字 snippet 會傳給你設定的 GLM API；程式不持久保存內容。
- LINE（選用）：分類數量與 AI 短摘要會傳給 LINE Messaging API。
- 停用／刪除：關閉相應環境變數即可停止第三方分享；撤銷 Google OAuth token 可終止 Gmail 存取；刪除 Railway service 可移除其 variables。

## 本機驗證

```powershell
python -m pip install -e '.[test]'
pytest -q
```

## 修改規則

編輯 `rules.json`。規則由上而下執行，越具體者應放越前面。`archive: true` 代表移除 `INBOX` 標籤；不是刪除。
