import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function EvaluationsTableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading evaluations">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Test Name</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Expand</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 25 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-10" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-4" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
