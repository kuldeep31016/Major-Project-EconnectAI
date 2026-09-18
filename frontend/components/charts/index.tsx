"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { scoreGradeColor } from "@/utils/format";

const AXIS = {
  stroke: "#94a3b8",
  fontSize: 10,
  tickLine: false,
  axisLine: false,
} as const;

const GRID = <CartesianGrid stroke="#ffffff0f" strokeDasharray="3 3" vertical={false} />;

/** Shared dark tooltip so every chart reads the same. */
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-foreground/12 bg-popover/95 px-3 py-2 shadow-2xl backdrop-blur">
      {label !== undefined && (
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold tabular text-foreground">
            {typeof p.value === "number" ? p.value.toLocaleString("en-IN") : p.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Connectivity trend — area chart                                     */
/* ------------------------------------------------------------------ */

export function ConnectivityTrendChart({
  data,
  height = 220,
}: {
  data: { month: string; connectivity: number; habitatArea?: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="gradConn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#15803d" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#15803d" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {GRID}
        <XAxis dataKey="month" {...AXIS} />
        <YAxis {...AXIS} domain={["dataMin - 6", "dataMax + 4"]} width={44} />
        <RTooltip content={<ChartTooltip />} cursor={{ stroke: "#ffffff22" }} />
        <Area
          type="monotone"
          dataKey="connectivity"
          name="Connectivity"
          stroke="#15803d"
          strokeWidth={2.4}
          fill="url(#gradConn)"
          animationDuration={1200}
          dot={false}
          activeDot={{ r: 4, fill: "#15803d", stroke: "#050816", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Baseline vs scenario — line chart                                   */
/* ------------------------------------------------------------------ */

export function ScenarioLineChart({
  data,
  height = 240,
}: {
  data: { year: string; baseline: number; scenario: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -20 }}>
        {GRID}
        <XAxis dataKey="year" {...AXIS} />
        <YAxis {...AXIS} domain={[0, 100]} width={44} />
        <RTooltip content={<ChartTooltip />} cursor={{ stroke: "#ffffff22" }} />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "#94a3b8" }}
        />
        <Line
          type="monotone"
          dataKey="baseline"
          name="Baseline"
          stroke="#1e5f8a"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          animationDuration={1000}
        />
        <Line
          type="monotone"
          dataKey="scenario"
          name="Scenario"
          stroke="#ef4444"
          strokeWidth={2.6}
          dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }}
          animationDuration={1200}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Habitat composition — donut                                         */
/* ------------------------------------------------------------------ */

export function CompositionChart({
  data,
  height = 230,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="56%"
          outerRadius="82%"
          paddingAngle={2.5}
          stroke="#050816"
          strokeWidth={2}
          animationDuration={1000}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <RTooltip content={<ChartTooltip unit="%" />} />
        <Legend
          iconType="circle"
          iconSize={7}
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 10.5, lineHeight: "18px", color: "#94a3b8" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Habitat health — radar                                              */
/* ------------------------------------------------------------------ */

export function HealthRadarChart({
  data,
  height = 250,
}: {
  data: { metric: string; score: number; benchmark: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#ffffff14" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 9.5 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Benchmark"
          dataKey="benchmark"
          stroke="#1e5f8a"
          strokeWidth={1.4}
          strokeDasharray="4 3"
          fill="#1e5f8a"
          fillOpacity={0.06}
          animationDuration={900}
        />
        <Radar
          name="Observed"
          dataKey="score"
          stroke="#15803d"
          strokeWidth={2}
          fill="#15803d"
          fillOpacity={0.22}
          animationDuration={1100}
        />
        <RTooltip content={<ChartTooltip />} />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 10.5, paddingTop: 4, color: "#94a3b8" }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Restoration priority — horizontal bars                              */
/* ------------------------------------------------------------------ */

export function PriorityBarChart({
  data,
  height = 240,
}: {
  data: { name: string; gain: number; cost: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
        <CartesianGrid stroke="#ffffff0f" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...AXIS} />
        <YAxis
          type="category"
          dataKey="name"
          {...AXIS}
          width={112}
          tick={{ fill: "#94a3b8", fontSize: 10 }}
        />
        <RTooltip content={<ChartTooltip />} cursor={{ fill: "#ffffff08" }} />
        <Bar dataKey="gain" name="Connectivity gain" radius={[0, 6, 6, 0]} animationDuration={1000}>
          {data.map((d, i) => (
            <Cell key={i} fill={i === 0 ? "#15803d" : i === 1 ? "#1e5f8a" : "#6d5bd0"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Connectivity score — radial gauge                                   */
/* ------------------------------------------------------------------ */

export function ScoreGauge({
  score,
  size = 168,
  label = "Connectivity",
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const color = scoreGradeColor(score);
  const data = [{ name: label, value: score, fill: color }];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={data}
          innerRadius="72%"
          outerRadius="100%"
          startAngle={220}
          endAngle={-40}
          barSize={13}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" background={{ fill: "#ffffff0f" }} cornerRadius={999} animationDuration={1400} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center"
        >
          <div className="text-[32px] font-bold leading-none tabular" style={{ color }}>
            {score.toFixed(1)}
          </div>
          <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
            {label}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline — compact trend for KPI cards                             */
/* ------------------------------------------------------------------ */

export function Sparkline({
  data,
  color = "#15803d",
  height = 40,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const points = data.map((v, i) => ({ i, v }));
  const id = `spark-${color.replace("#", "")}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.8}
          fill={`url(#${id})`}
          dot={false}
          animationDuration={900}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline area — habitat area over years                             */
/* ------------------------------------------------------------------ */

export function TimelineAreaChart({
  data,
  activeYear,
  height = 190,
}: {
  data: { year: number; connectivityScore: number; habitatAreaHa: number }[];
  activeYear?: number;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="gradYear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e5f8a" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#1e5f8a" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {GRID}
        <XAxis dataKey="year" {...AXIS} />
        <YAxis {...AXIS} domain={["dataMin - 8", "dataMax + 5"]} width={42} />
        <RTooltip content={<ChartTooltip />} cursor={{ stroke: "#ffffff22" }} />
        <Area
          type="monotone"
          dataKey="connectivityScore"
          name="Connectivity"
          stroke="#1e5f8a"
          strokeWidth={2.4}
          fill="url(#gradYear)"
          animationDuration={900}
          dot={(props: { cx?: number; cy?: number; payload?: { year: number } }) => {
            const on = props.payload?.year === activeYear;
            return (
              <circle
                key={props.payload?.year}
                cx={props.cx}
                cy={props.cy}
                r={on ? 5.5 : 3}
                fill={on ? "#15803d" : "#1e5f8a"}
                stroke="#050816"
                strokeWidth={2}
              />
            );
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
