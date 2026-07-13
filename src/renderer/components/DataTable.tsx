import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

type SortValue = number | string;

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  sortValue?: (row: Row) => SortValue;
  align?: "start" | "end";
}

interface DataTableProps<Row> {
  caption: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  emptyMessage?: string;
}

interface SortState {
  key: string;
  direction: "ascending" | "descending";
}

function compareSortValues(left: SortValue, right: SortValue): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  emptyMessage = "No records to display",
}: DataTableProps<Row>) {
  const [sort, setSort] = useState<SortState | null>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find(({ key }) => key === sort.key);
    const sortValue = column?.sortValue;
    if (!sortValue) return rows;

    return [...rows].sort((left, right) => {
      const comparison = compareSortValues(
        sortValue(left),
        sortValue(right),
      );
      return sort.direction === "ascending" ? comparison : -comparison;
    });
  }, [columns, rows, sort]);

  function changeSort(key: string) {
    setSort((current) => ({
      key,
      direction:
        current?.key === key && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  }

  return (
    <div className="table-wrap">
      <table>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const activeSort = sort?.key === column.key ? sort.direction : undefined;
              const SortIcon =
                activeSort === "ascending"
                  ? ArrowUp
                  : activeSort === "descending"
                    ? ArrowDown
                    : ArrowUpDown;

              return (
                <th
                  aria-sort={column.sortValue ? activeSort ?? "none" : undefined}
                  data-align={column.align ?? "start"}
                  key={column.key}
                  scope="col"
                >
                  {column.sortValue ? (
                    <button onClick={() => changeSort(column.key)} type="button">
                      {column.header}
                      <SortIcon aria-hidden="true" size={14} strokeWidth={2} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length > 0 ? (
            sortedRows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td data-align={column.align ?? "start"} key={column.key}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="table-empty" colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
