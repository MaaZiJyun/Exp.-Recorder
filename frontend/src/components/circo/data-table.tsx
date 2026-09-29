"use client";

import { useEffect, useMemo, useState, type Key, type ReactNode } from "react";
import {
  ChevronDownIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/20/solid";

type DataTableSortValue = string | number | boolean | Date | null | undefined;

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  searchValue?: (row: T) => DataTableSortValue;
  sortValue?: (row: T) => DataTableSortValue;
  className?: string;
};

export type DataTableAction<T> = {
  key: string;
  label: string;
  onSelect: (row: T) => void | Promise<void>;
  tone?: "default" | "danger";
  hidden?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
};

type ContextMenu<T> = {
  row: T;
  x: number;
  y: number;
};

type SortState = {
  columnKey: string;
  direction: "ascending" | "descending";
};

type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => Key;
  renderInfo: (row: T) => ReactNode;
  getInfoTitle?: (row: T) => ReactNode;
  getSearchText?: (row: T) => string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  onRead?: (row: T) => void | Promise<void>;
  onUpdate?: (row: T) => void | Promise<void>;
  onDelete?: (row: T) => void | Promise<void>;
  isReadDisabled?: (row: T) => boolean;
  isUpdateDisabled?: (row: T) => boolean;
  isDeleteDisabled?: (row: T) => boolean;
  actions?: DataTableAction<T>[];
};

const actionClass = (tone: "default" | "danger" = "default") =>
  tone === "danger"
    ? "border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40"
    : "border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

function compareValues(left: DataTableSortValue, right: DataTableSortValue) {
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
  if (right === null || right === undefined) return -1;

  const leftValue = left instanceof Date ? left.getTime() : left;
  const rightValue = right instanceof Date ? right.getTime() : right;
  if (typeof leftValue === "number" && typeof rightValue === "number") return leftValue - rightValue;
  if (typeof leftValue === "boolean" && typeof rightValue === "boolean") return Number(leftValue) - Number(rightValue);
  return String(leftValue).localeCompare(String(rightValue), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function DataTable<T,>({
  rows,
  columns,
  getRowId,
  renderInfo,
  getInfoTitle,
  getSearchText,
  searchPlaceholder = "Search records...",
  emptyTitle = "No records",
  emptyDescription = "There are no records to display.",
  onRead,
  onUpdate,
  onDelete,
  isReadDisabled,
  isUpdateDisabled,
  isDeleteDisabled,
  actions = [],
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<Key | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu<T> | null>(null);
  const [sort, setSort] = useState<SortState | null>(null);

  const selectedRow = useMemo(
    () => rows.find((row) => getRowId(row) === selectedId) ?? null,
    [getRowId, rows, selectedId],
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return rows;

    return rows.filter((row) => {
      const searchable = getSearchText
        ? getSearchText(row)
        : columns
            .map((column) => column.searchValue?.(row))
            .filter((value) => value !== null && value !== undefined)
            .join(" ");
      return searchable.toLocaleLowerCase().includes(normalizedQuery);
    });
  }, [columns, getSearchText, query, rows]);

  const visibleRows = useMemo(() => {
    if (!sort) return filteredRows;
    const column = columns.find((candidate) => candidate.key === sort.columnKey);
    const getValue = column?.sortValue ?? column?.searchValue;
    if (!getValue) return filteredRows;

    return filteredRows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const comparison = compareValues(getValue(left.row), getValue(right.row));
        if (comparison === 0) return left.index - right.index;
        return sort.direction === "ascending" ? comparison : -comparison;
      })
      .map(({ row }) => row);
  }, [columns, filteredRows, sort]);

  const toggleSort = (columnKey: string) => {
    setSort((current) => ({
      columnKey,
      direction:
        current?.columnKey === columnKey && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  const rowActions = (row: T): DataTableAction<T>[] => [
    {
      key: "read",
      label: "Read",
      onSelect: async (record: T) => {
        setSelectedId(getRowId(record));
        await onRead?.(record);
      },
      disabled: isReadDisabled,
    },
    ...(onUpdate
      ? [{ key: "update", label: "Update", onSelect: onUpdate, disabled: isUpdateDisabled } satisfies DataTableAction<T>]
      : []),
    ...(onDelete
      ? [
          {
            key: "delete",
            label: "Delete",
            onSelect: onDelete,
            tone: "danger" as const,
            disabled: isDeleteDisabled,
          } satisfies DataTableAction<T>,
        ]
      : []),
    ...actions,
  ].filter((action) => !action.hidden?.(row));

  const runAction = (action: DataTableAction<T>, row: T) => {
    setContextMenu(null);
    void action.onSelect(row);
  };

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
      <label className="relative block">
        <span className="sr-only">Search table</span>
        <MagnifyingGlassIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/70 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
        />
      </label>

      <div
        className={
          selectedRow
            ? "grid min-w-0 max-w-full items-start gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(0,3fr)]"
            : "min-w-0 max-w-full"
        }
      >
        {selectedRow ? (
          <aside className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Info Card</p>
                <h3 className="mt-1 truncate text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  {getInfoTitle?.(selectedRow) ?? `Record ${String(getRowId(selectedRow))}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                Close
              </button>
            </div>

            <div className="text-sm text-zinc-700 dark:text-zinc-300">{renderInfo(selectedRow)}</div>

            <div className="mt-5 grid gap-2">
              {rowActions(selectedRow).map((action) => (
                <button
                  key={action.key}
                  type="button"
                  disabled={action.disabled?.(selectedRow)}
                  onClick={() => runAction(action, selectedRow)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${actionClass(action.tone)}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </aside>
        ) : null}

        <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-max min-w-full border-collapse text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
                <tr>
                  {columns.map((column) => {
                    const sortable = Boolean(column.sortValue ?? column.searchValue);
                    const direction = sort?.columnKey === column.key ? sort.direction : null;
                    return <th
                      key={column.key}
                      aria-sort={direction ?? "none"}
                      className={`whitespace-nowrap px-4 py-3 ${column.className ?? ""}`}
                    >
                      <button
                        type="button"
                        disabled={!sortable}
                        onClick={() => toggleSort(column.key)}
                        className="group inline-flex items-center gap-1.5 text-left disabled:cursor-default"
                      >
                        <span>{column.header}</span>
                        {direction === "ascending" ? (
                          <ChevronUpIcon aria-hidden="true" className="size-3.5 text-sky-600 dark:text-sky-400" />
                        ) : direction === "descending" ? (
                          <ChevronDownIcon aria-hidden="true" className="size-3.5 text-sky-600 dark:text-sky-400" />
                        ) : sortable ? (
                          <ChevronUpDownIcon aria-hidden="true" className="size-3.5 text-zinc-400 transition group-hover:text-zinc-700 dark:group-hover:text-zinc-200" />
                        ) : null}
                      </button>
                    </th>
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {visibleRows.map((row) => {
                  const rowId = getRowId(row);
                  const selected = rowId === selectedId;
                  return (
                    <tr
                      key={rowId}
                      tabIndex={0}
                      aria-selected={selected}
                      onClick={() => setSelectedId(rowId)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(rowId);
                        }
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setSelectedId(rowId);
                        setContextMenu({
                          row,
                          x: Math.max(8, Math.min(event.clientX, window.innerWidth - 184)),
                          y: Math.max(8, Math.min(event.clientY, window.innerHeight - 176)),
                        });
                      }}
                      className={`cursor-pointer outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 ${
                        selected
                          ? "bg-sky-50/80 dark:bg-sky-950/30"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                      }`}
                    >
                      {columns.map((column) => (
                        <td key={column.key} className={`whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300 ${column.className ?? ""}`}>
                          {column.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-12 text-center">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {query ? "No matching records" : emptyTitle}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {query ? "Try a different search term." : emptyDescription}
                      </p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {contextMenu ? (
        <div
          role="menu"
          aria-label="Row actions"
          onPointerDown={(event) => event.stopPropagation()}
          className="fixed z-[100] w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-xl shadow-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {rowActions(contextMenu.row).map((action) => (
            <button
              key={action.key}
              role="menuitem"
              type="button"
              disabled={action.disabled?.(contextMenu.row)}
              onClick={() => runAction(action, contextMenu.row)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                action.tone === "danger"
                  ? "text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/50"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
