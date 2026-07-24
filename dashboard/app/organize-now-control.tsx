"use client";

import { useState } from "react";

type RunState = "idle" | "starting" | "started" | "cooldown" | "error";

export function OrganizeNowControl() {
  const [state, setState] = useState<RunState>("idle");
  const [message, setMessage] = useState("四個 Gmail 一次整理，完成後自動更新摘要。");

  async function start() {
    setState("starting");
    setMessage("正在啟動整理工作…");
    try {
      const response = await fetch("/api/organize-now", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        retryAfterSeconds?: number;
      };
      if (response.status === 429) {
        const minutes = Math.max(1, Math.ceil((payload.retryAfterSeconds ?? 300) / 60));
        setState("cooldown");
        setMessage(`上一輪已啟動，請約 ${minutes} 分鐘後再試。`);
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "start failed");
      setState("started");
      setMessage("已啟動。通常 1–3 分鐘完成，稍後重新整理即可看到最新結果。");
    } catch {
      setState("error");
      setMessage("暫時無法啟動，請稍後再試；每小時排程仍會正常執行。");
    }
  }

  const buttonCopy =
    state === "starting"
      ? "整理啟動中"
      : state === "started"
        ? "已開始整理"
        : state === "cooldown"
          ? "稍後可再整理"
          : state === "error"
            ? "再試一次"
            : "立即整理全部信箱";

  return (
    <section
      className={`action-card action-card-primary organize-${state}`}
      aria-busy={state === "starting"}
    >
      <div className="action-copy">
        <div className="action-heading">
          <span className="action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4.75 8.5a7.5 7.5 0 0 1 12.8-2.8L19.8 8M19.25 15.5a7.5 7.5 0 0 1-12.8 2.8L4.2 16" />
              <path d="M19.8 4.5V8h-3.5M4.2 19.5V16h3.5" />
            </svg>
          </span>
          <div>
            <span className="action-kicker">全部信箱</span>
            <strong>現在整理最新郵件</strong>
          </div>
        </div>
        <p className="action-status" role="status" aria-live="polite">{message}</p>
      </div>
      <button
        className="action-button action-button-primary"
        type="button"
        onClick={start}
        disabled={state === "starting" || state === "started" || state === "cooldown"}
      >
        {state === "starting" && <span className="button-spinner" aria-hidden="true" />}
        {state === "started" && <span aria-hidden="true">✓</span>}
        {buttonCopy}
      </button>
    </section>
  );
}
