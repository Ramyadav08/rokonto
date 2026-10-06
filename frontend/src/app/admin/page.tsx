import Link from "next/link";
import { Server, Users } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Link href="/admin/clusters">
        <Card className="transition-colors hover:border-accent-blue/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Clusters
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm text-text-muted">Register clusters and issue agent tokens.</CardBody>
        </Card>
      </Link>
      <Link href="/admin/users">
        <Card className="transition-colors hover:border-accent-blue/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm text-text-muted">Create users and manage their cluster/namespace access.</CardBody>
        </Card>
      </Link>
    </div>
  );
}
