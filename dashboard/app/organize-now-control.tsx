"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type RunState = "idle" | "starting" | "processing" | "completed" | "delayed" | "cooldown" | "error";

const POLL_INTERVAL_MS = 8_000;
const POLL_TIMEOUT_MS = 180_000;

export function OrganizeNowControl({
  latestRunKey,
  latestRunAt,
}: {
  latestRunKey: string;
  latestRunAt: string;
}) {
  const router = useRouter();
  const baselineRunKey = useRef(latestRunKey);
  const requestedAt = useRef(0);
  const [state, setState] = useState<RunState>("idle");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [message, setMessage] = useState("一次整理四個 Gmail");

  useEffect(() => {
    if (state !== "processing") return;

    const latestRunTimestamp = Date.parse(latestRunAt);
    const isRequestedRun =
      latestRunKey &&
      latestRunKey !== baselineRunKey.current &&
      Number.isFinite(latestRunTimestamp) &&
      latestRunTimestamp >= requestedAt.current - 5_000;
    if (isRequestedRun) {
      setState("completed");
      setMessage("整理完成，摘要已自動更新");
      return;
    }

    const timer = window.setInterval(() => {
      if (Date.now() - requestedAt.current >= POLL_TIMEOUT_MS) {
        setState("delayed");
        setMessage("整理仍在背景執行；稍後重新開啟即可查看");
        return;
      }
      router.refresh();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [latestRunAt, latestRunKey, router, state]);

  useEffect(() => {
    if (state !== "cooldown") return;

    function updateCountdown() {
      const remainingSeconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1_000));
      if (remainingSeconds === 0) {
        setState("idle");
        setMessage("一次整理四個 Gmail");
        return;
      }
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = String(remainingSeconds % 60).padStart(2, "0");
      setMessage(`上一輪已啟動，${minutes}:${seconds} 後可再整理`);
    }

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil, state]);

  useEffect(() => {
    if (state !== "completed") return;
    const timer = window.setTimeout(() => {
      setState("idle");
      setMessage("一次整理四個 Gmail");
    }, 4_000);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function start() {
    baselineRunKey.current = latestRunKey;
    requestedAt.current = Date.now();
    setState("starting");
    setMessage("正在喚醒整理服務…");
    try {
      const response = await fetch("/api/organize-now", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        retryAfterSeconds?: number;
      };
      if (response.status === 429) {
        const retryAfterSeconds = Math.max(1, payload.retryAfterSeconds ?? 300);
        setCooldownUntil(Date.now() + retryAfterSeconds * 1_000);
        setState("cooldown");
        setMessage("上一輪已啟動，正在計算可再次整理時間");
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "start failed");
      setState("processing");
      setMessage("整理中，完成後會自動更新這一頁");
      router.refresh();
    } catch {
      setState("error");
      setMessage("暫時無法啟動；每小時排程仍會正常執行");
    }
  }

  function checkAgain() {
    requestedAt.current = Date.now();
    setState("processing");
    setMessage("正在再次確認整理結果…");
    router.refresh();
  }

  const buttonCopy =
    state === "starting"
      ? "正在啟動"
      : state === "processing"
        ? "整理中"
          : state === "completed"
          ? "再次整理"
          : state === "delayed"
            ? "再次確認"
            : state === "cooldown"
              ? "稍後再整理"
              : state === "error"
                ? "再試一次"
                : "立即整理";

  const disabled = state === "starting" || state === "processing" || state === "cooldown";

  return (
    <div className={`organize-control organize-${state}`} aria-busy={state === "starting" || state === "processing"}>
      <button
        className="organize-button"
        type="button"
        onClick={state === "delayed" ? checkAgain : start}
        disabled={disabled}
      >
        {(state === "starting" || state === "processing") && <span className="button-spinner" aria-hidden="true" />}
        {state === "completed" && <span aria-hidden="true">✓</span>}
        {buttonCopy}
      </button>
      <p className="organize-status" role="status" aria-live="polite">{message}</p>
    </div>
  );
}
