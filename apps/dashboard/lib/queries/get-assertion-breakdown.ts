import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface AssertionBreakdownBucket {
  assertion_type: string;
  total: number;
  passed: number;
  failed: number;
  inconclusive: number;
}

export const getAssertionBreakdown = cache(async function getAssertionBreakdown(
  projectId: string,
  days: number = 30,
): Promise<AssertionBreakdownBucket[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_assertion_type_breakdown", {
    p_project_id: projectId,
    p_days: days,
  });

  if (error) {
    console.error(
      "[projects/overview] system_error rpc=get_assertion_type_breakdown code=%s message=%s",
      error.code,
      error.message,
    );
    throw new Error("Failed to load assertion type breakdown");
  }

  return (data as AssertionBreakdownBucket[]) ?? [];
});
