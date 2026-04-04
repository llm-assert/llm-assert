import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { TrendBucket } from "@/lib/trends";

export { validateRange, rangeToDays } from "@/lib/trends";
export type { TrendBucket, Range } from "@/lib/trends";

export const getProjectTrends = cache(async function getProjectTrends(
  projectId: string,
  days: number,
): Promise<TrendBucket[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_project_trends", {
    p_project_id: projectId,
    p_bucket: "day",
    p_days: days,
  });

  if (error) {
    console.error(
      "[projects/trends] system_error rpc=get_project_trends code=%s message=%s",
      error.code,
      error.message,
    );
    throw new Error("Failed to load project trends");
  }

  return (data as TrendBucket[]) ?? [];
});
