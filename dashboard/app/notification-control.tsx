"use client";

import { useEffect, useState } from "react";

type NotificationState = "checking" | "unsupported" | "blocked" | "off" | "on" | "working" | "error";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.register("/sw.js");
  return registration.pushManager.getSubscription();
}

export function NotificationControl() {
  const [state, setState] = useState<NotificationState>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    const nextState = !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)
      ? Promise.resolve<NotificationState>("unsupported")
      : currentSubscription().then((subscription): NotificationState => {
          if (Notification.permission === "denied") return "blocked";
          return subscription ? "on" : "off";
        });

    nextState
      .then((value) => {
        if (mounted) setState(value);
      })
      .catch(() => {
        if (mounted) setState("error");
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!message || (state !== "on" && state !== "off")) return;
    const timer = window.setTimeout(() => setMessage(""), 4_000);
    return () => window.clearTimeout(timer);
  }, [message, state]);

  async function enable() {
    setState("working");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const keyResponse = await fetch("/api/push/key", { cache: "no-store" });
      if (!keyResponse.ok) throw new Error("key unavailable");
      const { publicKey } = (await keyResponse.json()) as { publicKey: string };
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        }));
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("subscription failed");
      setState("on");
      setMessage("這台裝置只會收到緊急郵件通知");
    } catch {
      setState("error");
      setMessage("通知暫時無法開啟");
    }
  }

  async function disable() {
    setState("working");
    setMessage("");
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        const response = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("unsubscribe failed");
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("這台裝置的通知已關閉");
    } catch {
      setState("error");
      setMessage("通知暫時無法更新");
    }
  }

  const copy =
    state === "on"
      ? "緊急通知：開"
      : state === "blocked"
        ? "通知已封鎖"
        : state === "unsupported"
          ? "不支援通知"
          : state === "working"
            ? "正在更新"
            : state === "checking"
              ? "確認通知"
              : state === "error"
                ? "重試通知"
                : "緊急通知：關";

  const helper =
    state === "blocked"
      ? "請到瀏覽器網站設定允許通知"
      : state === "unsupported"
        ? "iPhone 請先將此頁加入主畫面"
        : message || "只提醒緊急郵件";
  const showHelper = state === "blocked" || state === "unsupported" || state === "error" || Boolean(message);
  const disabled = state === "checking" || state === "working" || state === "unsupported" || state === "blocked";
  const notificationAriaLabel =
    state === "on"
      ? "關閉緊急通知"
      : state === "blocked"
        ? "緊急通知已被瀏覽器封鎖"
        : state === "unsupported"
          ? "此瀏覽器不支援緊急通知"
          : state === "working" || state === "checking"
            ? "正在確認緊急通知狀態"
            : state === "error"
              ? "重試開啟緊急通知"
              : "開啟緊急通知";

  return (
    <div className={`notification-control notification-${state}`} aria-busy={state === "checking" || state === "working"}>
      <button
        className="notification-toggle"
        type="button"
        aria-label={notificationAriaLabel}
        aria-pressed={state === "on"}
        onClick={state === "on" ? disable : enable}
        disabled={disabled}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 9.75a6 6 0 0 0-12 0c0 7-2.5 7-2.5 7h17s-2.5 0-2.5-7Z" />
          <path d="M9.75 20h4.5" />
        </svg>
        <span>{copy}</span>
        {state === "on" && <span className="notification-dot" aria-hidden="true" />}
      </button>
      <span className={showHelper ? "notification-note" : "sr-only"} role="status" aria-live="polite">{helper}</span>
    </div>
  );
}
