"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type PulsePoint = { label: string; done: number; remaining: number };

export default function StudioPulse({
  data,
  total,
  translated,
}: {
  data: PulsePoint[];
  total: number;
  translated: number;
}) {
  const points = data.length > 1
    ? data
    : [
        { label: "Start", done: 0, remaining: total || 0 },
        { label: "Now", done: translated, remaining: Math.max(0, total - translated) },
      ];

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="studio-done" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="studio-remaining" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--content-tertiary)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--content-tertiary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="label" hide />
          <YAxis hide domain={[0, "dataMax + 1"]} />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 5,
              fontSize: 12,
              color: "var(--foreground)",
            }}
            labelStyle={{ color: "var(--muted-foreground)", marginBottom: 4 }}
            formatter={(value, name) => [String(value), name === "done" ? "Translated" : "Remaining"]}
          />
          <Area type="monotone" dataKey="remaining" stroke="var(--content-tertiary)" strokeWidth={1.5} fill="url(#studio-remaining)" />
          <Area type="monotone" dataKey="done" stroke="var(--primary)" strokeWidth={2} fill="url(#studio-done)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
