"use client";

import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table2 } from "lucide-react";
import { Card } from "@/components/ui";

// Validated categorical slots (light mode): 1 blue, 2 orange.
const S1 = "#2a78d6";
const S2 = "#eb6834";
const GRID = "#e4e7ec";
const TEXT_MUTED = "#667085";
const TRACK = "#eef1f5";
const STATUS_COLOR: Record<string, string> = { PAID: "#16A34A", CREATED: "#98A2B3", PENDING: "#F59E0B", FAILED: "#DC2626", REFUNDED: "#7c3aed", PARTIALLY_REFUNDED: "#8b5cf6", REFUND_PENDING: "#a78bfa" };
const STATUS_LABEL: Record<string, string> = { PAID: "Paid", CREATED: "Initiated", PENDING: "Pending", FAILED: "Failed", REFUNDED: "Refunded", PARTIALLY_REFUNDED: "Part refunded", REFUND_PENDING: "Refund pending" };

const inr = (v: number) => (v >= 100000 ? `₹${(v / 100000).toFixed(v >= 1e6 ? 0 : 1)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}K` : `₹${v}`);
const inrFull = (v: number) => `₹${v.toLocaleString("en-IN")}`;
const axis = { stroke: GRID, tick: { fill: TEXT_MUTED, fontSize: 12 }, tickLine: false } as const;

function ChartCard({ title, subtitle, children, table }: { title: string; subtitle?: string; children: React.ReactNode; table: { head: string[]; rows: (string | number)[][] } }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold">{title}</h3>
          {subtitle && <p className="text-xs text-subtle">{subtitle}</p>}
        </div>
        <button onClick={() => setShowTable((s) => !s)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-canvas" aria-pressed={showTable}>
          <Table2 className="size-3.5" /> {showTable ? "Chart" : "Table"}
        </button>
      </div>
      {showTable ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-subtle">
              <tr>{table.head.map((h) => <th key={h} className="pb-2 pr-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className="py-1.5 pr-3 tabular-nums">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

function Empty() {
  return <div className="grid h-56 place-items-center text-sm text-subtle">No data yet</div>;
}

const tooltipStyle = { contentStyle: { borderRadius: 12, border: `1px solid ${GRID}`, boxShadow: "0 8px 24px rgba(7,18,46,.14)", fontSize: 13 }, labelStyle: { fontWeight: 700, color: "#07122e" } };

export function DailyRegistrationsChart({ data }: { data: { date: string; registrations: number; confirmed: number }[] }) {
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <ChartCard title="Daily registrations" subtitle="Last 30 days" table={{ head: ["Date", "Registrations", "Confirmed"], rows: data.map((d) => [fmt(d.date), d.registrations, d.confirmed]) }}>
      <div className="h-64">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmt} {...axis} minTickGap={28} />
            <YAxis allowDecimals={false} {...axis} axisLine={false} />
            <Tooltip {...tooltipStyle} labelFormatter={(l) => fmt(String(l))} cursor={{ stroke: TEXT_MUTED, strokeWidth: 1 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: TEXT_MUTED }} />
            <Area type="monotone" dataKey="registrations" name="All registrations" stroke={S1} strokeWidth={2} fill={S1} fillOpacity={0.1} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
            <Area type="monotone" dataKey="confirmed" name="Confirmed" stroke={S2} strokeWidth={2} fill={S2} fillOpacity={0.1} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function RevenueByTournamentChart({ data }: { data: { name: string; gross: number; net: number }[] }) {
  return (
    <ChartCard title="Revenue by tournament" subtitle="Gross collected vs net of refunds" table={{ head: ["Tournament", "Gross", "Net of refunds"], rows: data.map((d) => [d.name, inrFull(d.gross), inrFull(d.net)]) }}>
      {data.length ? (
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }} barGap={2} barCategoryGap="28%">
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="name" {...axis} interval={0} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
              <YAxis tickFormatter={inr} {...axis} axisLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v) => inrFull(Number(v))} cursor={{ fill: "rgba(16,24,40,.04)" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="gross" name="Gross" fill={S1} radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="net" name="Net of refunds" fill={S2} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty />
      )}
    </ChartCard>
  );
}

export function CategoryChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ChartCard title="Confirmed entries by category" table={{ head: ["Category", "Entries"], rows: data.map((d) => [d.name, d.value]) }}>
      {data.length ? (
        <div style={{ height: Math.max(180, data.length * 40) }}>
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...axis} />
              <YAxis type="category" dataKey="name" width={118} {...axis} axisLine={false} />
              <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(16,24,40,.04)" }} />
              <Bar dataKey="value" name="Entries" fill={S1} radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: "right", fill: "#07122e", fontSize: 12, fontWeight: 600 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty />
      )}
    </ChartCard>
  );
}

export function PaymentStatusChart({ data }: { data: { name: string; value: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: STATUS_LABEL[d.name] ?? d.name })).sort((a, b) => b.value - a.value);
  return (
    <ChartCard title="Payment status distribution" subtitle="All payment attempts" table={{ head: ["Status", "Count"], rows: rows.map((d) => [d.label, d.value]) }}>
      {rows.length ? (
        <div style={{ height: Math.max(160, rows.length * 40) }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...axis} />
              <YAxis type="category" dataKey="label" width={104} {...axis} axisLine={false} />
              <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(16,24,40,.04)" }} />
              <Bar dataKey="value" name="Payments" radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: "right", fill: "#07122e", fontSize: 12, fontWeight: 600 }}>
                {rows.map((r) => (
                  <Cell key={r.name} fill={STATUS_COLOR[r.name] ?? TEXT_MUTED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty />
      )}
    </ChartCard>
  );
}

export function ParticipationChart({ data }: { data: { name: string; confirmed: number; capacity: number }[] }) {
  const rows = data.map((d) => ({ ...d, remaining: Math.max(0, d.capacity - d.confirmed) }));
  return (
    <ChartCard title="Tournament participation" subtitle="Confirmed entries against capacity" table={{ head: ["Tournament", "Confirmed", "Capacity"], rows: data.map((d) => [d.name, d.confirmed, d.capacity || "—"]) }}>
      {rows.length ? (
        <div style={{ height: Math.max(180, rows.length * 40) }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...axis} />
              <YAxis type="category" dataKey="name" width={150} {...axis} axisLine={false} />
              <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(16,24,40,.04)" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="confirmed" name="Confirmed" stackId="a" fill={S1} maxBarSize={22} />
              <Bar dataKey="remaining" name="Remaining capacity" stackId="a" fill={TRACK} radius={[0, 4, 4, 0]} maxBarSize={22} stroke="#fff" strokeWidth={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty />
      )}
    </ChartCard>
  );
}
