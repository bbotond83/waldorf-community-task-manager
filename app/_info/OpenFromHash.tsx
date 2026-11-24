"use client";

import { useEffect } from "react";

/**
 * Opens the section the address names: a duty card links to `/informacio#<key>`, and a closed disclosure hides its text,
 * so the one whose id matches the hash is opened and scrolled into view, now and whenever the hash changes.
 */
export function OpenFromHash() {
  useEffect(() => {
    function open() {
      const key = decodeURIComponent(window.location.hash.slice(1));
      if (!key) return;
      const target = document.getElementById(key);
      if (target instanceof HTMLDetailsElement) {
        target.open = true;
        target.scrollIntoView({ block: "start" });
      }
    }
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
