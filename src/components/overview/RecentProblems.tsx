import Link from "next/link";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { getRecentProblems } from "@/mock/services";
import { ExpandableCard } from "@/components/ui/ExpandableCard";

export function RecentProblems() {
  const problems = getRecentProblems();

  return (
    <ExpandableCard title="Recent Problems" bodyClassName="!p-0 divide-y divide-border">
      {problems.map((p) => {
        const Icon = p.severity === "critical" ? OctagonAlert : AlertTriangle;
        return (
          <Link
            key={p.id}
            href={`/explore/logs?service=${encodeURIComponent(p.target)}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover"
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${
                p.severity === "critical" ? "text-status-critical" : "text-status-warning"
              }`}
            />
            <div className="min-w-0">
              <div className="text-sm text-text-primary">{p.title}</div>
              <div className="text-xs text-text-muted">{p.target}</div>
            </div>
          </Link>
        );
      })}
    </ExpandableCard>
  );
}
