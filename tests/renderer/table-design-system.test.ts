import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("table design system", () => {
  it("locks table geometry and aligns numeric headers with numeric cells", () => {
    const css = readFileSync(path.join(process.cwd(), "src/renderer/styles/app.css"), "utf8");

    expect(css).toMatch(/\.statement-table\s*\{[^}]*table-layout:\s*fixed/s);
    expect(css).toMatch(/\.statement-table\s+\.money-column[\s\S]*text-align:\s*right/);
    expect(css).toMatch(/\.statement-table\s+\.action-column[\s\S]*width:/);
    expect(css).toMatch(/\.table-wrap table\s*\{[^}]*table-layout:\s*fixed/s);
    expect(css).toMatch(/\.bookings-table-wrap table\s*\{[^}]*table-layout:\s*fixed/s);
  });
});
