"use client";

import { ReactNode, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "./Card";

export function ExpandableCard({
  title,
  controls,
  children,
  bodyClassName,
  className,
}: {
  title: string;
  controls?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center gap-2">
            {controls}
            <button
              onClick={() => setExpanded(true)}
              className="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary"
              aria-label={`Expand ${title}`}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardHeader>
        <CardBody className={bodyClassName}>{children}</CardBody>
      </Card>

      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 p-6">
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
            <button
              onClick={() => setExpanded(false)}
              className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-surface p-4">
            {children}
          </div>
        </div>
      )}
    </>
  );
}
