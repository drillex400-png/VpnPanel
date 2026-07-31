import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface HistoryPoint {
  time: string;
  cpu: number;
  ramPct: number;
}

interface ResourceHistoryChartProps {
  history: HistoryPoint[];
}

// Split out of DashboardView and loaded via React.lazy() -- recharts is one of the heaviest
// dependencies in this app and previously shipped in the main bundle even though only the
// Dashboard tab (and only the graph card within it) ever needs it. Default export required
// for React.lazy()'s dynamic import() contract.
export default function ResourceHistoryChart({ history }: ResourceHistoryChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={history}>
        <defs>
          <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#d946ef" stopOpacity={0.45} />
            <stop offset="95%" stopColor="#d946ef" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
        <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#120c1e",
            borderColor: "rgba(255, 255, 255, 0.12)",
            borderRadius: "16px",
            fontSize: "12px",
            color: "#f8fafc",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        />
        <Area
          type="monotone"
          dataKey="cpu"
          stroke="#8b5cf6"
          strokeWidth={2.5}
          fillOpacity={1}
          fill="url(#cpuGrad)"
        />
        <Area
          type="monotone"
          dataKey="ramPct"
          stroke="#d946ef"
          strokeWidth={2.5}
          fillOpacity={1}
          fill="url(#ramGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
