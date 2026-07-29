export class RequestLimitError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 413) {
    super(message);
    this.name = "RequestLimitError";
  }
}

export function requireDeclaredBodySize(request: Request, maximumBytes: number, allowEmpty = false): number {
  const raw = request.headers.get("content-length");
  if (raw === null) {
    if (allowEmpty && request.body === null) return 0;
    throw new RequestLimitError("A declared request size is required.", "request_length_required", 411);
  }
  if (!/^\d+$/.test(raw.trim())) throw new RequestLimitError("Request size is invalid.", "request_length_invalid", 400);
  const length = Number(raw);
  if (!Number.isSafeInteger(length) || length < 0) throw new RequestLimitError("Request size is invalid.", "request_length_invalid", 400);
  if (length > maximumBytes) throw new RequestLimitError("Request is too large.", "request_too_large", 413);
  return length;
}
