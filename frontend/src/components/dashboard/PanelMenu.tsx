"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface PanelMenuProps {
  editable: boolean;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

export function PanelMenu({ editable, onView, onEdit, onDuplicate, onRemove }: PanelMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const items = [
    { label: "View", icon: Eye, action: onView, show: true },
    { label: "Edit", icon: Pencil, action: onEdit, show: editable },
    { label: "Duplicate", icon: Copy, action: onDuplicate, show: editable },
    { label: "Remove", icon: Trash2, action: onRemove, show: editable, danger: true },
  ].filter((item) => item.show);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded p-0.5 text-text-muted hover:bg-surface-hover hover:text-text-primary"
        aria-label="Panel menu"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-20 w-36 rounded-md border border-border bg-surface-raised py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.action();
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-surface-hover",
                item.danger ? "text-status-critical" : "text-text-secondary hover:text-text-primary"
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
