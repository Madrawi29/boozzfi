"use client";

import { useEffect, useState } from "react";

type DisplayMode = "desktop" | "mobile";

const STORAGE_KEY = "boozzfi-display-mode";

function isDisplayMode(value: string | null): value is DisplayMode {
  return value === "desktop" || value === "mobile";
}

function DesktopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

export function DisplayModeToggle() {
  const [mode, setMode] = useState<DisplayMode>("desktop");

  useEffect(() => {
    const savedMode = window.localStorage.getItem(STORAGE_KEY);
    const nextMode = isDisplayMode(savedMode)
      ? savedMode
      : window.matchMedia("(max-width: 720px)").matches
        ? "mobile"
        : "desktop";

    setMode(nextMode);
  }, []);

  useEffect(() => {
    document.body.dataset.displayMode = mode;
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  return (
    <div
      aria-label="Display mode"
      className="display-mode-toggle"
      role="group"
    >
      <button
        aria-pressed={mode === "desktop"}
        className={mode === "desktop" ? "is-active" : undefined}
        onClick={() => setMode("desktop")}
        title="Desktop mode"
        type="button"
      >
        <DesktopIcon />
        <span>Desktop</span>
      </button>
      <button
        aria-pressed={mode === "mobile"}
        className={mode === "mobile" ? "is-active" : undefined}
        onClick={() => setMode("mobile")}
        title="Mobile mode"
        type="button"
      >
        <MobileIcon />
        <span>Mobile</span>
      </button>
    </div>
  );
}
