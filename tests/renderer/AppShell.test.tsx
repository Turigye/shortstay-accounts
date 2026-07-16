// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../../src/renderer/components/AppShell";
import { PRODUCT_NAME } from "../../src/shared/product";

afterEach(cleanup);

describe("AppShell product name", () => {
  it("renders the shared runtime product name", () => {
    render(
      <AppShell activeScreen="today" onScreenChange={vi.fn()}>
        <p>Content</p>
      </AppShell>,
    );

    expect(screen.getByText(PRODUCT_NAME)).toBeTruthy();
  });

  it("opens Help from the command bar without adding it to primary navigation", async () => {
    const user = userEvent.setup();
    const onHelp = vi.fn();

    render(
      <AppShell activeScreen="today" onHelp={onHelp} onScreenChange={vi.fn()}>
        <p>Content</p>
      </AppShell>,
    );

    const help = screen.getByRole("button", { name: "Help" });
    expect(screen.getByRole("navigation", { name: "Main navigation" }).contains(help)).toBe(false);

    await user.click(help);

    expect(onHelp).toHaveBeenCalledWith(help);
  });
});
