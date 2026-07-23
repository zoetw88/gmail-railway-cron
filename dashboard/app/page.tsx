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
    month: "short",
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

export default async function Home() {
  const user = await getChatGPTUser();
  const localPreview = process.env.NODE_ENV === "development";

  if (!user && !localPreview) {
    return (
      <main className="gate">
        <div className="gate-card">
          <span className="eyebrow">PRIVATE INBOX JOURNAL</span>
          <h1>你的信箱，整理成一天兩次的安靜摘要。</h1>
          <p>登入後查看四個 Gmail 帳號的分類、封存數量與 AI 重點。</p>
          <a className="primary-action" href={chatGPTSignInPath("/")}>使用 ChatGPT 登入</a>
        </div>
      </main>
    );
  }

  if (user && !isAllowedViewer(user.email)) {
    return (
      <main className="gate">
        <div className="gate-card">
          <span className="eyebrow">ACCESS DENIED</span>
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
  const general = combined.filter((item) => normalizedPriority(item.priority) !== "urgent");

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <span className="brand-mark">ID</span>
          <span className="brand-name">Inbox Daily</span>
        </div>
        <div className="topbar-meta">
          <span>每小時整點整理</span>
          {user && <a href={chatGPTSignOutPath("/")}>登出</a>}
        </div>
      </header>

      <NotificationControl />
      <OrganizeNowControl />

      {!active ? (
        <section className="empty-state">
          <span className="eyebrow">READY</span>
          <h1>儀表板已準備好。</h1>
          <p>下一次 Railway 整理完成後，摘要會自動出現在這裡。</p>
        </section>
      ) : (
        <>
          <section className="hero">
            <div>
              <span className="eyebrow">{active.dryRun ? "測試摘要" : "最新整理"}</span>
              <h1>{formatTime(active.createdAt)}</h1>
              <p>四個收件匣，收斂成今天真正值得看的內容。</p>
            </div>
            <div className="hero-stats">
              <div><strong>{totalMatched(active)}</strong><span>規則分類</span></div>
              <div><strong>{active.accounts.reduce((sum, item) => sum + item.archived, 0)}</strong><span>已封存</span></div>
              <div><strong>{active.accounts.reduce((sum, item) => sum + item.aiSuggestions.length, 0)}</strong><span>AI 重點</span></div>
            </div>
          </section>

          <section className="combined-overview" aria-labelledby="combined-title">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ALL MAILBOXES</span>
                <h2 id="combined-title">四個信箱，一次看完</h2>
              </div>
              <p>緊急信優先；每封都標示來源信箱與分類。</p>
            </div>
            <div className="priority-columns">
              <article className="priority-panel urgent-panel">
                <header>
                  <div><span className="signal-dot" />需要先處理</div>
                  <strong>{urgent.length}</strong>
                </header>
                <HighlightList items={urgent.slice(0, 12)} empty="目前沒有緊急郵件。" />
              </article>
              <article className="priority-panel general-panel">
                <header>
                  <div>重要與一般</div>
                  <strong>{general.length}</strong>
                </header>
                <HighlightList items={general.slice(0, 16)} empty="這次沒有其他摘要。" />
              </article>
            </div>
          </section>

          <section className="account-grid">
            {active.accounts.map((account) => (
              <article className="account-card compact-account" key={account.email}>
                <header>
                  <div className="account-letter">{account.name}</div>
                  <div><h2>{account.email}</h2><p>Gmail {account.name}</p></div>
                  <span className={account.aiError ? "status warning" : "status"}>{account.aiError ? "AI 略過" : "完成"}</span>
                </header>

                <div className="category-row">
                  {Object.entries(account.matched).filter(([, count]) => count > 0).map(([label, count]) => (
                    <span key={label}>{label}<strong>{count}</strong></span>
                  ))}
                  {Object.values(account.matched).every((count) => count === 0) && <span>沒有規則分類</span>}
                </div>

                <div className="archive-line"><span>本次封存</span><strong>{account.archived} 封</strong></div>

                <div className="ai-section">
                  <h3>
                    AI 緊急重點
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
                            <span className="category-badge">{item.category}</span>
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
              </article>
            ))}
          </section>
        </>
      )}

      <footer>緊急信優先 · 高信心 AI 自動貼標籤 · 30 天後自動刪除 · 不保存郵件全文</footer>
    </main>
  );
}
