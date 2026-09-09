/**
 * Service worker for OPS browser notifications.
 *
 * Deliberately tiny. A service worker sits between the app and the network for every request in its
 * scope, and a bug in one is unusually expensive: it is cached aggressively by the browser, survives
 * a deploy, and can break the whole app for anyone who has it installed. So this one does exactly
 * two things — show a notification, and handle a click on it — and never touches fetch. Nothing here
 * intercepts, caches or rewrites a single request.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    // A push whose body is not our JSON is not ours to interpret. Showing "undefined" to somebody
    // would be worse than showing nothing.
    return
  }

  const title = payload.title || "CrossFriend OPS"

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Same tag replaces rather than stacks, so a burst while somebody is away does not become a
      // pile of banners to dismiss one at a time.
      tag: payload.tag || "ops-board",
      data: { url: payload.url || "/board" },
      // Not renotify: replacing quietly is the point.
      renotify: false,
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = event.notification.data?.url || "/board"

  /**
   * Focus an existing tab rather than opening another one.
   *
   * Somebody who leaves OPS open all day should not accumulate a tab per notification. The URL is
   * compared by pathname because the open tab may carry query parameters — a filter, an error — and
   * an exact match would miss it and open a duplicate anyway.
   */
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).pathname === target.split("?")[0] && "focus" in client) {
          return client.focus()
        }
      }
      for (const client of clients) {
        if ("navigate" in client) return client.navigate(target).then((c) => c && c.focus())
      }
      return self.clients.openWindow(target)
    })
  )
})
