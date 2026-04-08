import type { PlanTransitionRow } from "@/lib/supabase/queries/plan-transitions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const REASON_LABELS: Record<string, string> = {
  checkout_completed: "Checkout",
  subscription_updated: "Plan change",
  subscription_deleted: "Canceled",
  payment_failed: "Payment failed",
  payment_recovered: "Payment recovered",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PlanBadge({ plan }: { plan: string | null }) {
  if (!plan) return <span className="text-muted-foreground">-</span>;
  return (
    <Badge variant="outline" className="capitalize">
      {plan}
    </Badge>
  );
}

export function PlanTransitionHistory({
  transitions,
}: {
  transitions: PlanTransitionRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan History</CardTitle>
      </CardHeader>
      <CardContent>
        {transitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No plan changes yet</p>
        ) : (
          <Table
            aria-label="Plan transition history"
            data-testid="plan-transitions-table"
          >
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Date</TableHead>
                <TableHead scope="col">Previous Plan</TableHead>
                <TableHead scope="col">New Plan</TableHead>
                <TableHead scope="col">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transitions.map((t) => (
                <TableRow key={t.id} data-testid={`transition-row-${t.id}`}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(t.created_at)}
                  </TableCell>
                  <TableCell>
                    <PlanBadge plan={t.old_plan} />
                  </TableCell>
                  <TableCell>
                    <PlanBadge plan={t.new_plan} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {REASON_LABELS[t.reason] ?? t.reason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
