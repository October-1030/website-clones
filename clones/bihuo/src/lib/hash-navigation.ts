export function navigateToHash(hash: string) {
  const next = new URL(window.location.href);
  next.hash = hash;
  window.history.pushState(null, "", next);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
