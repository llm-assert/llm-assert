import { Badge } from "@/components/ui/badge";

const styles: Record<string, string> = {
  pass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  fail: "bg-red-500/10 text-red-500 border-red-500/20",
  inconclusive: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

export function ResultBadge({ result }: { result: string }) {
  return (
    <Badge variant="outline" className={`${styles[result] ?? ""} capitalize`}>
      {result}
      <span className="sr-only"> result</span>
    </Badge>
  );
}
