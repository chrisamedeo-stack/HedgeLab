"use client";

import type { HedgeBook } from "@/types/positions";

interface HedgeBookTabsProps {
  books: HedgeBook[];
  activeBookId: string | null;
  onSelect: (bookId: string) => void;
  onAddBook?: () => void;
}

export function HedgeBookTabs({ books, activeBookId, onSelect, onAddBook }: HedgeBookTabsProps) {
  const activeBooks = books.filter((b) => b.is_active);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {activeBooks.map((book) => (
        <button
          key={book.id}
          onClick={() => onSelect(book.id)}
          className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeBookId === book.id
              ? "bg-surface text-secondary shadow-sm ring-1 ring-b-default"
              : "text-muted hover:text-secondary hover:bg-hover"
          }`}
        >
          {book.name}
          <span className="ml-1.5 text-xs text-faint">{book.currency}</span>
        </button>
      ))}
      {onAddBook && (
        <button
          onClick={onAddBook}
          className="rounded-lg px-3 py-2 text-sm text-muted hover:text-secondary hover:bg-hover transition-colors"
        >
          + Add
        </button>
      )}
    </div>
  );
}
