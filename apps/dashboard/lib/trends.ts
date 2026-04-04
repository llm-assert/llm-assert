export const VALID_RANGES = ["7d", "30d", "90d"] as const;
export type Range = (typeof VALID_RANGES)[number];

const RANGE_TO_DAYS: Record<Range, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export function validateRange(value: string | undefined): Range {
  if (!value) return "30d";
  return VALID_RANGES.includes(value as Range) ? (value as Range) : "30d";
}

export function rangeToDays(range: Range): number {
  return RANGE_TO_DAYS[range];
}

export interface TrendBucket {
  bucket: string;
  total: number;
  passed: number;
  failed: number;
  inconclusive: number;
  avg_score: number | null;
}
