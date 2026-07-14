// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MonthEndQuestionnaire } from "../../src/renderer/components/MonthEndQuestionnaire";

describe("MonthEndQuestionnaire", () => {
  it("shows all nine approved review sections and exceptions first", () => {
    render(<MonthEndQuestionnaire month="2026-07" status="open" balanced={false} onClose={vi.fn()} onReopen={vi.fn()} />);
    expect(screen.getByText("Exceptions and close")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(9);
    expect(screen.getByRole("button", { name: "Close July 2026" }).hasAttribute("disabled")).toBe(true);
  });
});
