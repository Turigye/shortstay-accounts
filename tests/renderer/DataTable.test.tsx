// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DataTable,
  type DataTableColumn,
} from "../../src/renderer/components/DataTable";

interface Row {
  id: string;
  name: string;
  amount: number;
}

const columns: DataTableColumn<Row>[] = [
  {
    key: "name",
    header: "Name",
    render: (row) => row.name,
    sortValue: (row) => row.name,
  },
  {
    key: "amount",
    header: "Amount",
    render: (row) => row.amount,
    sortValue: (row) => row.amount,
  },
];

const rows: Row[] = [
  { id: "1", name: "Beta", amount: 200 },
  { id: "2", name: "Alpha", amount: 100 },
];

describe("DataTable sorting semantics", () => {
  it("emits aria-sort only on the active sorted column", () => {
    render(
      <DataTable
        caption="Payments"
        columns={columns}
        getRowKey={(row) => row.id}
        rows={rows}
      />,
    );

    const nameHeader = screen.getByRole("columnheader", { name: "Name" });
    const amountHeader = screen.getByRole("columnheader", { name: "Amount" });

    expect(nameHeader.getAttribute("aria-sort")).toBeNull();
    expect(amountHeader.getAttribute("aria-sort")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(nameHeader.getAttribute("aria-sort")).toBe("ascending");
    expect(amountHeader.getAttribute("aria-sort")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Amount" }));
    expect(nameHeader.getAttribute("aria-sort")).toBeNull();
    expect(amountHeader.getAttribute("aria-sort")).toBe("ascending");
  });
});
