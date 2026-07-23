"use client";

import { useState } from "react";

type RunState = "idle" | "starting" | "started" | "cooldown" | "error";

export function OrganizeNowControl() {
  const [state, setState] = useState<RunState>("idle");
  const [message, setMessage] = useState("同時整理四個 Gmail，完成後會更新這一頁。");

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

  return (
    <section className={`organize-now organize-${state}`} aria-live="polite">
      <div>
        <span className="eyebrow">ON DEMAND</span>
        <strong>現在整理全部信箱</strong>
        <p>{message}</p>
      </div>
      <button
        type="button"
        onClick={start}
        disabled={state === "starting" || state === "started" || state === "cooldown"}
      >
        {state === "starting" ? "啟動中…" : state === "started" ? "已啟動" : "立即整理"}
      </button>
    </section>
  );
}

