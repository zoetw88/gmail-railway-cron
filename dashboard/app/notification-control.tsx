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
      setMessage("這台裝置會收到緊急郵件通知。");
    } catch {
      setState("error");
      setMessage("通知暫時無法開啟，請稍後重試。");
    }
  }

  async function disable() {
    setState("working");
    setMessage("");
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("這台裝置的通知已關閉。");
    } catch {
      setState("error");
      setMessage("通知暫時無法關閉，請稍後重試。");
    }
  }

  const copy =
    state === "on"
      ? "緊急通知已開啟"
      : state === "blocked"
        ? "通知已被瀏覽器封鎖"
        : state === "unsupported"
          ? "此瀏覽器不支援推播"
          : state === "working"
            ? "正在更新通知"
            : state === "checking"
              ? "正在確認通知狀態"
              : state === "error"
                ? "通知暫時無法使用"
                : "緊急通知";

  const helper =
    state === "blocked"
      ? "請到瀏覽器網站設定允許通知。"
      : state === "unsupported"
        ? "iPhone 請先將此頁加入主畫面，再從主畫面開啟。"
        : message || "只在發現緊急郵件時提醒；一般信不打擾你。";

  return (
    <section
      className={`action-card action-card-secondary notification-${state}`}
      aria-busy={state === "checking" || state === "working"}
    >
      <div className="action-copy">
        <div className="action-heading">
          <span className="action-icon notification-bell" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M18 9.75a6 6 0 0 0-12 0c0 7-2.5 7-2.5 7h17s-2.5 0-2.5-7Z" />
              <path d="M9.75 20h4.5" />
            </svg>
            {state === "on" && <span className="notification-dot" />}
          </span>
          <div>
            <span className="action-kicker">只提醒緊急信</span>
            <strong>{copy}</strong>
          </div>
        </div>
        <p className="action-status" role="status" aria-live="polite">{helper}</p>
      </div>
      {state === "on" ? (
        <button className="action-button action-button-secondary" type="button" onClick={disable}>
          關閉通知
        </button>
      ) : (
        <button
          className="action-button action-button-secondary"
          type="button"
          onClick={enable}
          disabled={state === "checking" || state === "working" || state === "unsupported" || state === "blocked"}
        >
          {(state === "checking" || state === "working") && (
            <span className="button-spinner" aria-hidden="true" />
          )}
          {state === "checking" || state === "working" ? "請稍候" : state === "error" ? "再試一次" : "開啟通知"}
        </button>
      )}
    </section>
  );
}
