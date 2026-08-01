import React from "react";

// Shared skeleton placeholders shown during a view's *first* data fetch (gated on the
// `hasLoadedOnce` flag each view already tracks) -- replaces plain "Загрузка…" text rows,
// which read as unfinished/placeholder-y next to the rest of the app's motion-heavy,
// glass-card UI. Widths are varied per row/column so the shimmer doesn't look like a
// perfectly uniform grid of gray bars.

const widthFor = (i: number, base: number, spread: number) => `${base + ((i * 13) % spread)}%`;

export function SkeletonTableRows({ rows = 6, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="py-3 px-3">
              <div className="h-3 rounded-md skeleton-shimmer" style={{ width: widthFor(r + c, 40, 45) }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card rounded-3xl p-4 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-3 rounded-md skeleton-shimmer" style={{ width: widthFor(i, 45, 25) }} />
            <div className="h-4 w-10 rounded-full skeleton-shimmer" />
          </div>
          <div className="h-2.5 rounded-md skeleton-shimmer" style={{ width: widthFor(i + 1, 55, 30) }} />
          <div className="h-2.5 rounded-md skeleton-shimmer" style={{ width: widthFor(i + 2, 35, 40) }} />
        </div>
      ))}
    </>
  );
}

export function SkeletonLines({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3 rounded-xl border border-input">
          <div className="h-3 rounded-md skeleton-shimmer mb-2" style={{ width: widthFor(i, 30, 35) }} />
          <div className="h-2.5 rounded-md skeleton-shimmer" style={{ width: widthFor(i + 2, 55, 35) }} />
        </div>
      ))}
    </>
  );
}
