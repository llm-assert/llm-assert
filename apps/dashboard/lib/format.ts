export function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export function formatDuration(
  startedAt: string,
  finishedAt: string | null,
): string {
  if (!finishedAt) return "In progress";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function formatPassRate(passed: number, failed: number): string {
  const total = passed + failed;
  if (total === 0) return "—";
  return `${((passed / total) * 100).toFixed(1)}%`;
}

export function getPassRateColor(passed: number, failed: number): string {
  const total = passed + failed;
  if (total === 0) return "";
  const rate = (passed / total) * 100;
  if (rate >= 80) return "text-emerald-500";
  if (rate >= 50) return "text-amber-500";
  return "text-red-500";
}
