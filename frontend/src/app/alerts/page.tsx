import dynamic from "next/dynamic";

// Alert start times render as "X minutes ago", computed from Date.now() --
// generating that during SSR and again on client hydration produces
// different text and trips React's hydration check. Client-only render
// avoids it; see explore/logs/page.tsx for the fuller explanation.
const AlertsPageContent = dynamic(
  () => import("@/components/alerts/AlertsPageContent").then((m) => m.AlertsPageContent),
  { ssr: false }
);

export default function AlertsPage() {
  return <AlertsPageContent />;
}
