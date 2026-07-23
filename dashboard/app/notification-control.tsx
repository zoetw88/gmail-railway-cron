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
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    currentSubscription()
      .then((subscription) => {
        if (Notification.permission === "denied") setState("blocked");
        else setState(subscription ? "on" : "off");
      })
      .catch(() => setState("error"));
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
          : state === "working" || state === "checking"
            ? "正在確認通知狀態…"
            : "開啟緊急通知";

  return (
    <section className={`notification-card notification-${state}`} aria-live="polite">
      <div className="notification-icon" aria-hidden="true">!</div>
      <div>
        <strong>{copy}</strong>
        <p>
          {state === "blocked"
            ? "請到瀏覽器網站設定允許通知。"
            : state === "unsupported"
              ? "iPhone 請先將此頁加入主畫面，再從主畫面開啟。"
              : "只在發現緊急郵件時提醒；一般信不打擾你。"}
        </p>
        {message && <small>{message}</small>}
      </div>
      {state === "on" ? (
        <button type="button" onClick={disable}>關閉</button>
      ) : (
        <button
          type="button"
          onClick={enable}
          disabled={state === "checking" || state === "working" || state === "unsupported" || state === "blocked"}
        >
          開啟
        </button>
      )}
    </section>
  );
}
