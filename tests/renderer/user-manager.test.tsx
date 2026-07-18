// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserManager } from "../../src/renderer/components/UserManager";

const admin = { id: "a1", name: "Owner", username: "admin", role: "admin", active: true };

describe("UserManager", () => {
  beforeEach(() => {
    Object.defineProperty(window, "stayBooks", {
      configurable: true,
      value: {
        invoke: vi.fn(async (channel: string, payload: Record<string, unknown>) => {
          if (channel === "users:list") return { ok: true, data: [admin] };
          if (channel === "users:create-editor") {
            return {
              ok: true,
              data: { id: "e1", role: "editor", active: true, ...payload },
            };
          }
          return { ok: false, code: "INTERNAL_ERROR", message: "Unexpected", fieldErrors: {} };
        }),
      },
    });
  });

  it("lists profiles and creates an Editor", async () => {
    const user = userEvent.setup();
    render(<UserManager />);
    expect(await screen.findByText("Owner")).toBeTruthy();

    await user.type(screen.getByLabelText("Editor name"), "Front Desk");
    await user.type(screen.getByLabelText("Editor username"), "desk");
    await user.type(screen.getByLabelText("Temporary password"), "editor password");
    await user.click(screen.getByRole("button", { name: "Add Editor" }));

    await waitFor(() => expect(screen.getByText("Front Desk")).toBeTruthy());
    expect(window.stayBooks.invoke).toHaveBeenCalledWith("users:create-editor", {
      name: "Front Desk",
      username: "desk",
      password: "editor password",
    });
  });
});
