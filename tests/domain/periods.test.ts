import { describe, expect, it } from "vitest";

import { splitStayByMonth } from "../../src/domain/periods";

describe("splitStayByMonth", () => {
  it("splits a cross-month stay by occupied nights", () => {
    expect(splitStayByMonth("2026-07-30", "2026-08-03")).toEqual([
      { month: "2026-07", nights: 2 },
      { month: "2026-08", nights: 2 },
    ]);
  });

  it("treats checkout as exclusive", () => {
    expect(splitStayByMonth("2026-07-31", "2026-08-01")).toEqual([
      { month: "2026-07", nights: 1 },
    ]);
  });

  it("uses UTC calendar arithmetic across leap days", () => {
    expect(splitStayByMonth("2028-02-28", "2028-03-02")).toEqual([
      { month: "2028-02", nights: 2 },
      { month: "2028-03", nights: 1 },
    ]);
  });

  it.each([
    ["2026-07-30", "2026-07-30"],
    ["2026-07-31", "2026-07-30"],
  ])("rejects checkout on or before check-in: %s to %s", (checkIn, checkOut) => {
    expect(() => splitStayByMonth(checkIn, checkOut)).toThrow(
      "Checkout must be after check-in",
    );
  });

  it.each([
    ["2026-02-29", "2026-03-01"],
    ["2026-7-01", "2026-07-02"],
    ["not-a-date", "2026-07-02"],
  ])("rejects invalid ISO calendar dates: %s to %s", (checkIn, checkOut) => {
    expect(() => splitStayByMonth(checkIn, checkOut)).toThrow("YYYY-MM-DD");
  });
});
