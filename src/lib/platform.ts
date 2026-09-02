function isMacLike(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac/i.test(navigator.platform ?? "") || /mac/i.test(navigator.userAgent);
}

/** Modifier key label for the platform the app is running on. */
export function modKeyLabel(): string {
  return isMacLike() ? "⌘" : "Ctrl";
}
