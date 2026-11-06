"use client";
// Same public call name as the existing helper, with a top-level navigation.
export function openAuthPopup(url: string, ..._options: unknown[]): Window | null {
  const target = new URL(url, window.location.origin);
  if (target.pathname.endsWith('/subnexa-auth/login')) {
    target.searchParams.set('return_to', window.location.pathname + window.location.search);
  }
  window.location.assign(target.toString());
  return null;
}
