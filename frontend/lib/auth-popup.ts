export function openCenteredWindow(url: string, name: string, width = 540, height = 680) {
  if (typeof window === "undefined") return null;
  const dualLeft = window.screenX + (window.outerWidth - width) / 2;
  const dualTop = window.screenY + (window.outerHeight - height) / 2;
  const left = Math.max(0, Math.round(dualLeft));
  const top = Math.max(0, Math.round(dualTop));
  const features = [
    "popup=yes",
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
  return window.open(url, name, features);
}

export function openAuthPopup(url: string) {
  if (typeof window === "undefined") return null;
  const target = new URL(url, window.location.origin);
  if (target.pathname.endsWith("/subnexa-auth/login")) target.searchParams.set("return_to", window.location.pathname + window.location.search);
  window.location.assign(target.toString());
  return null;
}
