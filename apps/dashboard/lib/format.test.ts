import {
  formatRelativeTime,
  formatDuration,
  formatPassRate,
  formatScore,
  formatCost,
  formatLatency,
  getPassRateColor,
} from "./format";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for timestamps less than 1 minute ago", () => {
    expect(formatRelativeTime("2026-04-02T11:59:30Z")).toBe("just now");
  });

  it("returns minutes for timestamps less than 1 hour ago", () => {
    expect(formatRelativeTime("2026-04-02T11:45:00Z")).toBe("15m ago");
  });

  it("returns hours for timestamps less than 1 day ago", () => {
    expect(formatRelativeTime("2026-04-02T06:00:00Z")).toBe("6h ago");
  });

  it("returns days for timestamps less than 30 days ago", () => {
    expect(formatRelativeTime("2026-03-30T12:00:00Z")).toBe("3d ago");
  });

  it("returns formatted date for timestamps 30+ days ago", () => {
    const result = formatRelativeTime("2026-02-01T12:00:00Z");
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});

describe("formatDuration", () => {
  it("returns 'In progress' when finishedAt is null", () => {
    expect(formatDuration("2026-04-02T12:00:00Z", null)).toBe("In progress");
  });

  it("formats seconds for durations under 60s", () => {
    expect(formatDuration("2026-04-02T12:00:00Z", "2026-04-02T12:00:45Z")).toBe(
      "45s",
    );
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration("2026-04-02T12:00:00Z", "2026-04-02T12:05:30Z")).toBe(
      "5m 30s",
    );
  });

  it("formats hours and minutes", () => {
    expect(formatDuration("2026-04-02T12:00:00Z", "2026-04-02T14:15:00Z")).toBe(
      "2h 15m",
    );
  });

  it("returns 0s for identical timestamps", () => {
    expect(formatDuration("2026-04-02T12:00:00Z", "2026-04-02T12:00:00Z")).toBe(
      "0s",
    );
  });
});

describe("formatPassRate", () => {
  it("returns dash for zero total", () => {
    expect(formatPassRate(0, 0)).toBe("—");
  });

  it("formats percentage with one decimal", () => {
    expect(formatPassRate(8, 2)).toBe("80.0%");
  });

  it("returns 100.0% for all passing", () => {
    expect(formatPassRate(10, 0)).toBe("100.0%");
  });

  it("returns 0.0% for all failing", () => {
    expect(formatPassRate(0, 10)).toBe("0.0%");
  });
});

describe("formatScore", () => {
  it("returns dash for null", () => {
    expect(formatScore(null)).toBe("—");
  });

  it("formats to 2 decimal places", () => {
    expect(formatScore(0.956)).toBe("0.96");
  });

  it("formats 0 as 0.00", () => {
    expect(formatScore(0)).toBe("0.00");
  });

  it("formats 1 as 1.00", () => {
    expect(formatScore(1)).toBe("1.00");
  });
});

describe("formatCost", () => {
  it("returns dash for null", () => {
    expect(formatCost(null)).toBe("—");
  });

  it("returns <$0.0001 for very small amounts", () => {
    expect(formatCost(0.00001)).toBe("<$0.0001");
  });

  it("returns <$0.0001 for zero", () => {
    expect(formatCost(0)).toBe("<$0.0001");
  });

  it("formats to 4 decimal places", () => {
    expect(formatCost(0.0025)).toBe("$0.0025");
  });
});

describe("formatLatency", () => {
  it("returns dash for null", () => {
    expect(formatLatency(null)).toBe("—");
  });

  it("formats milliseconds for values under 1000", () => {
    expect(formatLatency(450)).toBe("450ms");
  });

  it("formats seconds with one decimal for values >= 1000", () => {
    expect(formatLatency(2500)).toBe("2.5s");
  });

  it("rounds milliseconds to nearest integer", () => {
    expect(formatLatency(99.7)).toBe("100ms");
  });
});

describe("getPassRateColor", () => {
  it("returns empty string for zero total", () => {
    expect(getPassRateColor(0, 0)).toBe("");
  });

  it("returns emerald for rates >= 80%", () => {
    expect(getPassRateColor(9, 1)).toBe("text-emerald-500");
  });

  it("returns amber for rates >= 50% and < 80%", () => {
    expect(getPassRateColor(6, 4)).toBe("text-amber-500");
  });

  it("returns red for rates < 50%", () => {
    expect(getPassRateColor(2, 8)).toBe("text-red-500");
  });

  it("returns emerald at exactly 80%", () => {
    expect(getPassRateColor(8, 2)).toBe("text-emerald-500");
  });

  it("returns amber at exactly 50%", () => {
    expect(getPassRateColor(5, 5)).toBe("text-amber-500");
  });
});
