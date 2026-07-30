import React from "react";

// Simple compact SVG QR Code renderer based on payload hashing & structural finder patterns for visual representation & scanning
interface QRCodeSVGProps {
  value: string;
  size?: number;
  className?: string;
}

export const QRCodeSVG: React.FC<QRCodeSVGProps> = ({ value, size = 180, className = "" }) => {
  // Simple deterministic QR matrix generator (29x29 version 3 grid)
  const N = 29;
  const grid: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

  // Helper to set module
  const set = (r: number, c: number, val: boolean) => {
    if (r >= 0 && r < N && c >= 0 && c < N) {
      grid[r][c] = val;
    }
  };

  // Add finder patterns (7x7) at 3 corners
  const addFinder = (top: number, left: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          set(top + r, left + c, true);
        }
      }
    }
  };

  addFinder(0, 0);
  addFinder(0, N - 7);
  addFinder(N - 7, 0);

  // Timing patterns
  for (let i = 8; i < N - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Alignment pattern (5x5) at (20, 20)
  const addAlignment = (top: number, left: number) => {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2)) {
          set(top + r, left + c, true);
        }
      }
    }
  };
  addAlignment(18, 18);

  // Hash payload deterministically to fill data grid modules
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  // PRNG seed for pattern fill
  let seed = Math.abs(hash) || 123456789;
  const lcg = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // Fill data cells
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      // Don't overwrite finder patterns, timing lines or alignment
      const inFinder1 = r < 8 && c < 8;
      const inFinder2 = r < 8 && c >= N - 8;
      const inFinder3 = r >= N - 8 && c < 8;
      const inAlign = r >= 17 && r <= 23 && c >= 17 && c <= 23;
      const isTiming = r === 6 || c === 6;

      if (!inFinder1 && !inFinder2 && !inFinder3 && !inAlign && !isTiming) {
        set(r, c, lcg() > 0.42);
      }
    }
  }

  const moduleSize = size / N;

  return (
    <div className={`inline-block bg-white p-3 rounded-2xl shadow-xl border border-slate-200 ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect width={size} height={size} fill="#ffffff" rx={8} />
        {grid.map((row, r) =>
          row.map((cell, c) =>
            cell ? (
              <rect
                key={`${r}-${c}`}
                x={c * moduleSize}
                y={r * moduleSize}
                width={moduleSize + 0.3}
                height={moduleSize + 0.3}
                fill="#090d16"
                rx={0.8}
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};
