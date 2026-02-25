import { useState, useMemo } from "react";

type SortDir = "asc" | "desc";

interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

export function useTableSort<T, K extends string>(
  data: T[],
  defaultKey: K,
  accessor: (item: T, key: K) => string | number | null | undefined,
  defaultDir: SortDir = "asc"
) {
  const [sort, setSort] = useState<SortState<K>>({ key: defaultKey, dir: defaultDir });

  function toggleSort(key: K) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const av = accessor(a, sort.key);
      const bv = accessor(b, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sort.dir === "desc" ? -cmp : cmp;
    });
    return copy;
  }, [data, sort, accessor]);

  return { sorted, sort, toggleSort };
}
