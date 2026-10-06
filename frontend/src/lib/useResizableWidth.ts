"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  min?: number;
  max?: number;
  /** Persists the chosen width across visits when set. */
  storageKey?: string;
}

function loadStored(key: string | undefined, fallback: number): number {
  if (!key || typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Drag-to-resize for a fixed-width side panel anchored to the right edge of
 * its container: dragging the handle left grows it, dragging right shrinks
 * it. Returns the current width plus the mousedown handler for the handle.
 */
export function useResizableWidth(defaultWidth: number, { min = 280, max = 900, storageKey }: Options = {}) {
  const [width, setWidth] = useState(() => loadStored(storageKey, defaultWidth));
  const widthRef = useRef(width);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = widthRef.current;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    []
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX; // dragging left widens the panel
      setWidth(Math.min(max, Math.max(min, startWidth.current + delta)));
    }
    function onMouseUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (storageKey) window.localStorage.setItem(storageKey, String(widthRef.current));
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [min, max, storageKey]);

  return { width, onMouseDown };
}
