"use client"

import { useEffect, useState } from "react"

import { removeSubscription, saveSubscription } from "./push-actions"

/**
 * The Enable notifications control.
 *
 * ── Why it never asks on load ──────────────────────────────────────────────────────────────────
 * A permission prompt that appears before anybody has asked for one is the fastest way to get
 * permanently denied — browsers remember a refusal, some now penalise sites that prompt unprompted,
 * and the person cannot easily undo it. So the prompt only ever follows a deliberate click.
 *
 * ── Why the state is read rather than assumed ──────────────────────────────────────────────────
 * Permission and subscription are two different facts and they drift apart constantly: permission is
 * granted but the subscription was wiped with site data, or the row exists server-side while the
 * browser has forgotten. The button reads the browser's actual registration on mount rather than
 * trusting anything stored, so what it says is what is true.
 */

type State = "checking" | "unsupported" | "insecure" | "needs-install" | "blocked" | "off" | "on" | "working"

/**
 * iPhones and iPads, including an iPad reporting itself as a Mac.
 *
 * Every browser on iOS is Safari underneath, so this is a platform test rather than a browser one —
 * Chrome on an iPhone has exactly the same limitation and would be missed by looking for "Safari".
 */
function isApplePhoneOrTablet(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

/** Opened from the Home Screen rather than in a browser tab. */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** VAPID keys travel as base64url; PushManager wants raw bytes. */
/* Returns an ArrayBuffer rather than a Uint8Array: TypeScript types applicationServerKey as
   BufferSource backed by a real ArrayBuffer, and a Uint8Array is typed over ArrayBufferLike, which
   includes SharedArrayBuffer and so does not satisfy it. The bytes are identical either way. */
function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(normalised)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output.buffer
}

export default function EnableNotifications({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("checking")
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const read = async () => {
      if (typeof window === "undefined") return

      /**
       * When notifications are unavailable, say which of the three reasons it is.
       *
       * "This browser cannot show notifications" was true and useless: two of the three causes are
       * things the person can fix in under a minute, and the message sent them away believing it was
       * impossible. On iOS in particular the API is simply absent in a normal tab and appears once
       * the page is on the Home Screen — the same browser, a different answer.
       */
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (cancelled) return
        // Service workers exist only in a secure context, so http is indistinguishable from an old
        // browser unless it is checked first.
        if (!window.isSecureContext) setState("insecure")
        else if (isApplePhoneOrTablet() && !isStandalone()) setState("needs-install")
        else setState("unsupported")
        return
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked")
        return
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration("/sw.js")
        const existing = await registration?.pushManager.getSubscription()
        if (!cancelled) setState(existing ? "on" : "off")
      } catch {
        if (!cancelled) setState("off")
      }
    }

    void read()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = async () => {
    if (!publicKey) {
      setNote("Notifications are not configured on the server yet.")
      return
    }
    setState("working")
    setNote(null)

    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off")
        return
      }

      const registration = await navigator.serviceWorker.register("/sw.js")
      // register() resolves before the worker is usable; ready waits for it to be active, and
      // subscribing against a worker that is still installing fails intermittently.
      await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        // Non-optional in practice: Chrome refuses a subscription without it, and a silent push is
        // exactly the capability browsers spent years removing.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
      })

      const json = subscription.toJSON()
      const result = await saveSubscription({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      })

      if (!result.ok) {
        setNote("Could not save this device. Try again.")
        setState("off")
        return
      }

      setState("on")
      setNote("This device will now be notified.")
    } catch (error) {
      console.error("[push] enable failed", error)
      setNote("Your browser refused to enable notifications here.")
      setState("off")
    }
  }

  const disable = async () => {
    setState("working")
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js")
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await removeSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setState("off")
      setNote("This device will no longer be notified.")
    } catch {
      setState("on")
      setNote("Could not turn them off. Try again.")
    }
  }

  if (state === "checking") return null

  if (state === "unsupported") {
    return (
      <Row tone="muted">
        This browser cannot show notifications. The unread count beside Team board still works
        everywhere.
      </Row>
    )
  }

  if (state === "insecure") {
    return (
      <Row tone="muted">
        Notifications need a secure connection. Open this page over <strong>https</strong> and
        reload.
      </Row>
    )
  }

  if (state === "needs-install") {
    return (
      <Row tone="muted">
        {/* Not a limitation of this app: iOS exposes the push API only to a web app launched from
            the Home Screen, so there is nothing to click here until that is done. */}
        On iPhone and iPad, add this page to your Home Screen first — <strong>Share</strong> →{" "}
        <strong>Add to Home Screen</strong> — then open it from there and press Enable.
      </Row>
    )
  }

  if (state === "blocked") {
    return (
      <Row tone="muted">
        {/* The site cannot undo a denial — only the person can, in browser settings. Saying so is
            more use than a button that would do nothing. */}
        Notifications are blocked for this site. Turn them back on in your browser&rsquo;s site
        settings, then reload.
      </Row>
    )
  }

  return (
    <Row tone={state === "on" ? "on" : "off"}>
      <span className="flex-1">
        {state === "on"
          ? "Notifications are on for this device."
          : "Get notified on this device when someone posts or assigns you a task."}
        {note && <span className="ml-1 text-slate-400">{note}</span>}
      </span>
      <button
        type="button"
        disabled={state === "working"}
        onClick={state === "on" ? disable : enable}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 ${
          state === "on"
            ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            : "bg-slate-900 text-white hover:bg-slate-700"
        }`}
      >
        {state === "working" ? "…" : state === "on" ? "Turn off" : "Enable"}
      </button>
    </Row>
  )
}

function Row({ children, tone }: { children: React.ReactNode; tone: "on" | "off" | "muted" }) {
  const style =
    tone === "on"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "off"
        ? "border-slate-200 bg-white text-slate-600"
        : "border-slate-200 bg-slate-50 text-slate-500"

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-xs ${style}`}>
      {children}
    </div>
  )
}
