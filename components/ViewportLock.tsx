"use client";

import { useEffect } from "react";

/** Blocks pinch zoom. The menu text size is the way to make type larger. */
export function ViewportLock() {
  useEffect(() => {
    const stopGesture = (event: Event) => {
      event.preventDefault();
    };
    const stopPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    document.addEventListener("gesturestart", stopGesture, { passive: false });
    document.addEventListener("gesturechange", stopGesture, { passive: false });
    document.addEventListener("gestureend", stopGesture, { passive: false });
    document.addEventListener("touchmove", stopPinch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", stopGesture);
      document.removeEventListener("gesturechange", stopGesture);
      document.removeEventListener("gestureend", stopGesture);
      document.removeEventListener("touchmove", stopPinch);
    };
  }, []);
  return null;
}
