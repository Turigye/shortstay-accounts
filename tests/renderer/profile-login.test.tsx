// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfileLoginScreen } from "../../src/renderer/screens/ProfileLoginScreen";

describe("ProfileLoginScreen", () => {
  it("submits a labeled username and password without exposing business data", async () => {
    const onLogin = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(
      <ProfileLoginScreen
        businessName="Eden Grove"
        busy={false}
        error={null}
        onLogin={onLogin}
      />,
    );

    await user.type(screen.getByLabelText("Username"), "desk");
    await user.type(screen.getByLabelText("Password"), "editor password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onLogin).toHaveBeenCalledWith("desk", "editor password");
    expect(screen.getByText("Eden Grove")).toBeTruthy();
    expect(screen.queryByText(/UGX/)).toBeNull();
  });

  it("shows a generic inline error and disables submission while busy", () => {
    render(
      <ProfileLoginScreen
        businessName="Eden Grove"
        busy
        error="The username or password was not recognized."
        onLogin={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "The username or password was not recognized.",
    );
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Signing in" }).disabled,
    ).toBe(true);
  });
});
