"use client";

import { useCallback, useState, useRef } from "react";
import { useImportStore } from "@/store/importStore";

export function FileUpload() {
  const { parseCSV, loading, rawHeaders, rawRows, fileName } = useImportStore();
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        alert("Only .csv files are supported");
        return;
      }
      parseCSV(file);
    },
    [parseCSV]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  // If already parsed, show summary
  if (fileName && rawHeaders.length > 0) {
    return (
      <div className="rounded-lg border border-b-default bg-input-bg p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-profit-10 p-2 text-profit">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-medium text-secondary">{fileName}</div>
            <div className="text-xs text-faint">
              {rawRows.length} rows, {rawHeaders.length} columns
            </div>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="ml-auto text-xs text-muted hover:text-secondary"
          >
            Change file
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rawHeaders.slice(0, 6).map((h) => (
            <span key={h} className="rounded bg-hover px-2 py-0.5 text-xs text-muted">
              {h}
            </span>
          ))}
          {rawHeaders.length > 6 && (
            <span className="rounded bg-hover px-2 py-0.5 text-xs text-muted">
              +{rawHeaders.length - 6} more
            </span>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-1 text-lg font-semibold text-secondary">Upload CSV File</h3>
      <p className="mb-6 text-sm text-faint">
        Drag and drop your CSV file or click to browse.
      </p>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-16 transition-colors ${
          dragActive
            ? "border-action bg-action-5"
            : "border-b-input hover:border-b-input hover:bg-input-bg"
        }`}
      >
        {loading ? (
          <div className="text-sm text-muted">Parsing file...</div>
        ) : (
          <>
            <svg
              className="mb-3 h-10 w-10 text-ph"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div className="text-sm text-muted">
              Drop your <span className="font-medium text-secondary">.csv</span> file here
            </div>
            <div className="mt-1 text-xs text-ph">or click to browse</div>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
