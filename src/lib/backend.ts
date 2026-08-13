/**
 * Calls to the CrossFriend backend's service-key-protected `/ops/*` endpoints.
 *
 * OPS reads the database directly for everything it displays, but anything that has to go through
 * Medusa's own services — creating a product, changing what is on sale, issuing a credential — has
 * to be asked of the backend. Those operations fire Medusa hooks, events and search indexing that
 * raw SQL from here would silently skip.
 *
 * Centralised because the interesting part is the failure message, and it was worth writing once.
 */

export interface BackendCallResult<T> {
  data: T | null
  error: string | null
}

/**
 * Names the variable that is actually missing, rather than listing all of them and leaving whoever
 * is on the server to check each one.
 *
 * Compared falsy, not undefined: docker compose substitutes an absent `${VAR}` with an EMPTY STRING
 * and still sets the variable, so a container can have every one of these "present" and none of them
 * usable — which looks identical to this check, and is the common cause in a deployed instance.
 */
function missingEnvError(names: string[]): string {
  return `This OPS instance is missing ${names.join(" and ")}. Set ${
    names.length > 1 ? "them" : "it"
  } in the server's .env next to docker-compose.yml, then run: docker compose up -d`
}

export async function callBackend<T = unknown>(
  path: string,
  body: unknown = {}
): Promise<BackendCallResult<T>> {
  const backendUrl = process.env.MEDUSA_BACKEND_URL
  const serviceKey = process.env.OPS_SERVICE_KEY

  if (!backendUrl || !serviceKey) {
    const missing = [
      !backendUrl && "MEDUSA_BACKEND_URL",
      !serviceKey && "OPS_SERVICE_KEY",
    ].filter((name): name is string => Boolean(name))
    return { data: null, error: missingEnvError(missing) }
  }

  let res: Response
  try {
    res = await fetch(`${backendUrl.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-service-key": serviceKey },
      body: JSON.stringify(body),
      cache: "no-store",
    })
  } catch {
    return { data: null, error: "Couldn't reach the CrossFriend backend." }
  }

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    return { data: null, error: (data as { error?: string })?.error ?? "The backend rejected that request." }
  }

  return { data: data as T, error: null }
}
