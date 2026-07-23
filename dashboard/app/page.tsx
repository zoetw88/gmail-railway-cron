import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
import { getDigestRuns, type DigestRun } from "@/db/digests";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ run?: string }>;

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

function authorized(email: string) {
  const configured = process.env.ALLOWED_VIEWER_EMAILS ?? "";
  return configured
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
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

  if (user && !authorized(user.email)) {
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
  const requested = (await searchParams).run;
  const active = runs.find((run) => run.id === requested) ?? runs[0];

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <span className="brand-mark">ID</span>
          <span className="brand-name">Inbox Daily</span>
        </div>
        <div className="topbar-meta">
          <span>每天 08:00 · 20:00</span>
          {user && <a href={chatGPTSignOutPath("/")}>登出</a>}
        </div>
      </header>

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

          <nav className="timeline" aria-label="歷史摘要">
            {runs.map((run) => (
              <a key={run.id} className={run.id === active.id ? "active" : ""} href={`/?run=${encodeURIComponent(run.id)}`}>
                {formatTime(run.createdAt)}
              </a>
            ))}
          </nav>

          <section className="account-grid">
            {active.accounts.map((account) => (
              <article className="account-card" key={account.email}>
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
                  <h3>AI 重點</h3>
                  {account.aiSuggestions.length ? (
                    <ol>
                      {account.aiSuggestions.slice(0, 5).map((item, index) => (
                        <li key={`${item.threadId}-${index}`}>
                          <span>{item.category}</span>
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
                      ))}
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

      <footer>保存分類統計、郵件標題、Gmail 連結與 AI 短摘要 · 30 天後自動刪除 · 不保存郵件全文</footer>
    </main>
  );
}
