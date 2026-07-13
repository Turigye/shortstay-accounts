// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "../../src/renderer/components/AppShell";
import { PRODUCT_NAME } from "../../src/shared/product";

describe("AppShell product name", () => {
  it("renders the shared runtime product name", () => {
    render(
      <AppShell activeScreen="today" onScreenChange={vi.fn()}>
        <p>Content</p>
      </AppShell>,
    );

    expect(screen.getByText(PRODUCT_NAME)).toBeTruthy();
  });
});
