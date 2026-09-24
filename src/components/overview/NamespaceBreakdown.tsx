import { getNamespaceBreakdown, getNodeDistribution } from "@/mock/overview";
import { ExpandableCard } from "@/components/ui/ExpandableCard";

export function NamespaceBreakdown() {
  const namespaces = getNamespaceBreakdown();
  const nodes = getNodeDistribution();
  const maxNodePercent = Math.max(...nodes.map((n) => n.percent), 1);

  return (
    <ExpandableCard title="Namespace Breakdown" bodyClassName="grid grid-cols-1 gap-4 md:grid-cols-2">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-left text-text-muted">
            <th className="py-1.5 font-medium">Namespace</th>
            <th className="py-1.5 text-right font-medium">Pods</th>
            <th className="py-1.5 text-right font-medium">CPU</th>
            <th className="py-1.5 text-right font-medium">Mem</th>
          </tr>
        </thead>
        <tbody>
          {namespaces.map((ns) => (
            <tr key={ns.namespace} className="border-b border-border/60 last:border-0">
              <td className="py-1.5 text-text-primary">{ns.namespace}</td>
              <td className="py-1.5 text-right tabular-nums text-text-secondary">{ns.pods}</td>
              <td className="py-1.5 text-right tabular-nums text-text-secondary">{ns.cpuPercent}%</td>
              <td className="py-1.5 text-right tabular-nums text-text-secondary">{ns.memPercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <div className="mb-2 text-xs text-text-muted">CPU usage by node</div>
        <div className="space-y-2">
          {nodes.map((n) => (
            <div key={n.node}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-text-secondary">{n.node}</span>
                <span className="font-medium tabular-nums text-text-primary">{n.percent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className="h-full rounded-full bg-accent-purple"
                  style={{ width: `${(n.percent / maxNodePercent) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ExpandableCard>
  );
}
