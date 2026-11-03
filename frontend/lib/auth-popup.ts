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
  const popup = openCenteredWindow(url, "subnexa-google-auth", 540, 680);
  if (!popup) {
    window.location.href = url;
    return null;
  }
  popup.focus();
  const timer = window.setInterval(() => {
    if (popup.closed) {
      window.clearInterval(timer);
      window.dispatchEvent(new Event("subnexa-session-changed"));
    }
  }, 800);
  return popup;
}
