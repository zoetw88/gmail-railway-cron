import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
import { getDigestRuns, type DigestRun } from "@/db/digests";
import { NotificationControl } from "./notification-control";
import { isAllowedViewer } from "./viewer-access";
import { OrganizeNowControl } from "./organize-now-control";

export const dynamic = "force-dynamic";

type CombinedSuggestion = DigestRun["accounts"][number]["aiSuggestions"][number] & {
  accountName: string;
  accountEmail: string;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function totalMatched(run: DigestRun) {
  return run.accounts.reduce(
    (sum, account) => sum + Object.values(account.matched).reduce((value, count) => value + count, 0),
    0,
  );
}

function gmailThreadUrl(email: string, threadId: string) {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email)}#all/${encodeURIComponent(threadId)}`;
}

const priorityOrder = { urgent: 0, important: 1, normal: 2 } as const;
const priorityLabel = { urgent: "緊急", important: "重要", normal: "一般" } as const;
const categoryLabel: Record<string, string> = {
  Security: "安全",
  Billing: "財務",
  "Job Alerts": "求職",
  Reading: "閱讀",
  Courses: "課程",
  Promotions: "促銷",
  Other: "其他",
};

function normalizedPriority(value: string | undefined): keyof typeof priorityOrder {
  return value === "urgent" || value === "important" ? value : "normal";
}

function HighlightList({ items, empty }: { items: CombinedSuggestion[]; empty: string }) {
  if (!items.length) return <p className="highlight-empty">{empty}</p>;
  return (
    <ol className="highlight-list">
      {items.map((item, index) => {
        const priority = normalizedPriority(item.priority);
        return (
          <li key={`${item.accountEmail}-${item.threadId}-${index}`}>
            <div className="highlight-meta">
              <span className={`priority priority-${priority}`}>{priorityLabel[priority]}</span>
              <span className="account-chip">Gmail {item.accountName}</span>
              <span className="category-badge">{categoryLabel[item.category] ?? item.category}</span>
            </div>
            <a
              className="highlight-link"
              href={gmailThreadUrl(item.accountEmail, item.threadId)}
              target="_blank"
              rel="noreferrer"
            >
              {item.subject || "開啟這封郵件"} ↗
            </a>
            <p>{item.summary}</p>
          </li>
        );
      })}
    </ol>
  );
}

function accountActivity(account: DigestRun["accounts"][number]) {
  const matchedCount = Object.values(account.matched).reduce((sum, count) => sum + count, 0);
  const parts = [];
  if (matchedCount) parts.push(`${matchedCount} 分類`);
  if (account.archived) parts.push(`${account.archived} 封存`);
  if (account.aiSuggestions.length) parts.push(`${account.aiSuggestions.length} 重點`);
  return parts.length ? parts.join(" · ") : "沒有新內容";
}

export default async function Home() {
  const user = await getChatGPTUser();
  const localPreview = process.env.NODE_ENV === "development";

  if (!user && !localPreview) {
    return (
      <main className="gate">
        <div className="gate-card">
          <span className="gate-label">私人信箱摘要</span>
          <h1>四個信箱，整理成一頁安靜的重點。</h1>
          <p>登入後查看緊急郵件、重要提醒與自動整理結果。</p>
          <a className="primary-action" href={chatGPTSignInPath("/")}>使用 ChatGPT 登入</a>
        </div>
      </main>
    );
  }

  if (user && !isAllowedViewer(user.email)) {
    return (
      <main className="gate">
        <div className="gate-card">
          <span className="gate-label">無法開啟</span>
          <h1>這個帳號沒有查看權限。</h1>
          <p>{user.email}</p>
          <a className="text-link" href={chatGPTSignOutPath("/")}>改用其他帳號登入</a>
        </div>
      </main>
    );
  }

  const runs = await getDigestRuns();
  const active = runs[0];
  const combined = active
    ? active.accounts
        .flatMap((account) =>
          account.aiSuggestions.map((item) => ({
            ...item,
            accountName: account.name,
            accountEmail: account.email,
          })),
        )
        .sort(
          (left, right) =>
            priorityOrder[normalizedPriority(left.priority)] -
            priorityOrder[normalizedPriority(right.priority)],
        )
    : [];
  const urgent = combined.filter((item) => normalizedPriority(item.priority) === "urgent");
  const important = combined.filter((item) => normalizedPriority(item.priority) === "important");
  const normal = combined.filter((item) => normalizedPriority(item.priority) === "normal");
  const archived = active?.accounts.reduce((sum, item) => sum + item.archived, 0) ?? 0;
  const verdictTone = urgent.length ? "urgent" : important.length ? "review" : "calm";
  const verdict = urgent.length
    ? `有 ${urgent.length} 封需要現在處理。`
    : important.length
      ? `目前沒有急信，今天有 ${important.length} 封值得確認。`
      : "目前沒有需要處理的信。";
  const verdictDetail = urgent.length
    ? "緊急郵件已排在最前面，點擊標題即可開啟 Gmail。"
    : normal.length
      ? `${normal.length} 封一般資訊已收好，不需要立即處理。`
      : "四個信箱都已整理完成。";
  const latestRunKey = active ? `${active.id}:${active.createdAt}` : "";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Z</span>
          <span className="brand-name">Zoe Inbox</span>
        </div>
        <div className="topbar-actions">
          <NotificationControl />
          {user && <a className="signout-link" href={chatGPTSignOutPath("/")}>登出</a>}
        </div>
      </header>

      {!active ? (
        <section className="empty-state">
          <div>
            <span className="last-run">等待第一份摘要</span>
            <h1>信箱編輯台已準備好。</h1>
            <p>現在可以整理四個 Gmail；完成後，值得注意的郵件會出現在這裡。</p>
          </div>
          <OrganizeNowControl latestRunKey="" latestRunAt="" />
        </section>
      ) : (
        <>
          <section className={`briefing briefing-${verdictTone}`} aria-labelledby="verdict-title">
            <div className="briefing-copy">
              <p className="last-run">
                最後整理 <time dateTime={active.createdAt}>{formatTime(active.createdAt)}</time>
                <span aria-hidden="true"> · </span>
                四個信箱
                {active.dryRun && <span className="dry-run">測試摘要</span>}
              </p>
              <h1 id="verdict-title">{verdict}</h1>
              <p className="verdict-detail">{verdictDetail}</p>
              <p className="run-summary">
                本輪分類 {totalMatched(active)} 封
                <span aria-hidden="true"> · </span>
                自動封存 {archived} 封
                <span aria-hidden="true"> · </span>
                每小時整點自動整理
              </p>
            </div>
            <OrganizeNowControl latestRunKey={latestRunKey} latestRunAt={active.createdAt} />
          </section>

          <section className="triage-feed" aria-label="郵件重點">
            {urgent.length ? (
              <section className="priority-group urgent-group" aria-labelledby="urgent-title">
                <header>
                  <h2 id="urgent-title">現在需要處理</h2>
                  <span>{urgent.length} 封</span>
                </header>
                <HighlightList items={urgent.slice(0, 12)} empty="" />
              </section>
            ) : (
              <p className="safe-line"><span aria-hidden="true">✓</span>目前沒有緊急郵件</p>
            )}

            {important.length > 0 && (
              <section className="priority-group important-group" aria-labelledby="important-title">
                <header>
                  <h2 id="important-title">今天值得確認</h2>
                  <span>{important.length} 封</span>
                </header>
                <HighlightList items={important.slice(0, 12)} empty="" />
              </section>
            )}

            <details className="normal-disclosure">
              <summary>
                <span>一般資訊</span>
                <span className="summary-note">不需要立即處理</span>
                <strong>{normal.length} 封</strong>
                <span className="disclosure-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="normal-content">
                <HighlightList items={normal.slice(0, 16)} empty="這次沒有一般資訊。" />
              </div>
            </details>
          </section>

          <section className="source-section" aria-label="來源信箱">
            <details className="source-disclosure">
              <summary>
                <div>
                  <strong>來源信箱</strong>
                  <span>查看四個帳號的整理紀錄</span>
                </div>
                <span className="source-count">{active.accounts.length} 個</span>
                <span className="disclosure-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="source-list">
                {active.accounts.map((account) => (
                  <details className="source-account" key={account.email}>
                    <summary>
                      <span className="account-letter" aria-hidden="true">{account.name}</span>
                      <span className="source-identity">
                        <strong>{account.email}</strong>
                        <small>Gmail {account.name}</small>
                      </span>
                      <span className={account.aiError ? "source-activity warning" : "source-activity"}>
                        {account.aiError ? "AI 略過 · " : ""}{accountActivity(account)}
                      </span>
                      <span className="disclosure-chevron" aria-hidden="true">⌄</span>
                    </summary>

                    <div className="source-detail">
                      <div className="category-row">
                        {Object.entries(account.matched).filter(([, count]) => count > 0).map(([label, count]) => (
                          <span key={label}>{categoryLabel[label] ?? label}<strong>{count}</strong></span>
                        ))}
                        {Object.values(account.matched).every((count) => count === 0) && <span>沒有規則分類</span>}
                      </div>

                      <div className="archive-line"><span>本次封存</span><strong>{account.archived} 封</strong></div>

                      <div className="ai-section">
                        <h3>
                          重點郵件
                          {account.aiLabelsApplied > 0 && <small>已自動貼標籤 {account.aiLabelsApplied} 封</small>}
                        </h3>
                        {account.aiSuggestions.length ? (
                          <ol>
                            {[...account.aiSuggestions]
                              .sort(
                                (left, right) =>
                                  priorityOrder[normalizedPriority(left.priority)] -
                                  priorityOrder[normalizedPriority(right.priority)],
                              )
                              .slice(0, 5)
                              .map((item, index) => {
                                const priority = normalizedPriority(item.priority);
                                return (
                                  <li key={`${item.threadId}-${index}`}>
                                    <div className="badge-stack">
                                      <span className={`priority priority-${priority}`}>
                                        {priorityLabel[priority]}
                                      </span>
                                      <span className="category-badge">{categoryLabel[item.category] ?? item.category}</span>
                                    </div>
                                    <div>
                                      <a
                                        className="mail-link"
                                        href={gmailThreadUrl(account.email, item.threadId)}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {item.subject || "開啟這封郵件"} ↗
                                      </a>
                                      <p>{item.summary}</p>
                                    </div>
                                  </li>
                                );
                              })}
                          </ol>
                        ) : (
                          <p className="quiet">{account.aiError ? "AI 暫時無法使用，規則整理仍已完成。" : "這次沒有額外重點。"}</p>
                        )}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          </section>
        </>
      )}

      <footer>摘要保留 30 天 · 不保存郵件全文 · 只推播緊急郵件</footer>
    </main>
  );
}
