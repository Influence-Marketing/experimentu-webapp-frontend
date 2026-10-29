// Kiosk mode for venue devices: turned on with ?kiosk=1 (off with ?kiosk=0),
// remembered on the device. While on, an idle guest is warned and then the
// device is wiped for the next guest (see components/KioskMode.tsx).

const KEY = "u-score-kiosk-v1";

export const KIOSK_IDLE_SECONDS = 90;
export const KIOSK_WARN_SECONDS = 15;

export function isKiosk(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setKiosk(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Applies ?kiosk=1 / ?kiosk=0 from the current URL; returns whether kiosk mode is on afterwards. */
export function applyKioskParam(): boolean {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("kiosk");
  if (value === "1") setKiosk(true);
  if (value === "0") setKiosk(false);
  return isKiosk();
}
