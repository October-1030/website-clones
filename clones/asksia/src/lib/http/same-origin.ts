import { getCanonicalAppOrigin, getDeploymentMode } from "../cloud/config";

export class RequestOriginError extends Error {
  constructor(message: string, public readonly code = "request_origin_blocked", public readonly status = 403) {
    super(message);
    this.name = "RequestOriginError";
  }
}

export function requireSameOriginMutation(request: Request): void {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const expectedOrigins = new Set<string>();
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
    expectedOrigins.add(requestUrl.origin);
  } catch {
    throw new RequestOriginError("Request origin is invalid.", "request_origin_invalid");
  }

  if (getDeploymentMode() === "public") {
    const canonicalOrigin = getCanonicalAppOrigin();
    if (!canonicalOrigin) throw new RequestOriginError("StudyPal public origin is not configured.", "request_origin_not_configured", 503);
    expectedOrigins.clear();
    expectedOrigins.add(canonicalOrigin);
  } else {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host")?.trim();
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProtocol || requestUrl.protocol.slice(0, -1);
    if (host && /^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(host) && (protocol === "http" || protocol === "https")) {
      expectedOrigins.add(`${protocol}://${host}`);
    }
  }

  if (
    !origin
    || !expectedOrigins.has(origin)
    || (fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "same-site")
  ) {
    throw new RequestOriginError("This action must come from StudyPal.");
  }
}
