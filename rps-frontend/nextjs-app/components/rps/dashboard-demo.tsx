"use client";

import { useState } from "react";
import { Card, Pill, SecondaryButton } from "@/components/rps/ui";

type DashboardDemoProps = {
  metrics: {
    participationRate: number;
    averageStress: string;
    responded: number;
    totalEmployees: number;
    alertsDetected: number;
  };
  trendByRange: {
    monthly: { label: string; value: number }[];
    weekly: { label: string; value: number }[];
  };
  departmentDistribution: { label: string; value: number; color: string }[];
  insights: string[];
};

export function DashboardDemo({
  metrics,
  trendByRange,
  departmentDistribution,
  insights,
}: DashboardDemoProps) {
  const [range, setRange] = useState<"monthly" | "weekly">("monthly");
  const trend = trendByRange[range];
  const conic = `conic-gradient(${departmentDistribution
    .map((segment, index) => {
      const previousTotal = departmentDistribution
        .slice(0, index)
        .reduce((sum, current) => sum + current.value, 0);
      const nextTotal = previousTotal + segment.value;

      return `${segment.color} ${previousTotal}% ${nextTotal}%`;
    })
    .join(", ")})`;

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Taux de participation", `${metrics.participationRate}%`, "+8% ce mois"],
          ["Stress moyen", `${metrics.averageStress} / 5`, "Niveau modéré"],
          ["Employés répondants", `${metrics.responded} / ${metrics.totalEmployees}`, "Suivi en temps réel"],
          ["Alertes détectées", `${metrics.alertsDetected}`, "2 critiques"],
        ].map(([label, value, detail]) => (
          <Card key={label} className="p-5">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-300" />
            <p className="mt-4 text-sm text-slate-500">{label}</p>
            <p className="mt-3 font-[family-name:var(--font-manrope)] text-3xl font-extrabold">
              {value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{detail}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.95fr]">
        <Card className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Evolution du stress dans le temps</p>
              <h3 className="mt-1 font-[family-name:var(--font-manrope)] text-xl font-bold">
                Evolution du stress
              </h3>
            </div>
            <div className="flex gap-2">
              <SecondaryButton
                className={range === "monthly" ? "border-slate-900 text-slate-900" : ""}
                onClick={() => setRange("monthly")}
              >
                Mensuel
              </SecondaryButton>
              <SecondaryButton
                className={range === "weekly" ? "border-slate-900 text-slate-900" : ""}
                onClick={() => setRange("weekly")}
              >
                Hebdo
              </SecondaryButton>
            </div>
          </div>
          <div className="mt-8 flex h-64 items-end gap-3 rounded-[12px] bg-gradient-to-b from-amber-50 to-white p-5">
            {trend.map((item) => (
              <div key={item.label} className="flex flex-1 items-end">
                <div
                  className="w-full rounded-t-[12px] bg-gradient-to-t from-amber-500 to-yellow-300"
                  style={{ height: `${item.value * 52}px` }}
                />
              </div>
            ))}
          </div>
          <div className={`mt-4 grid text-center text-xs font-medium text-slate-500 ${range === "monthly" ? "grid-cols-7" : "grid-cols-5"}`}>
            {trend.map((item) => (
              <span key={item.label}>{item.label}</span>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-6">
            <p className="text-sm text-slate-500">Répartition par département</p>
            <h3 className="mt-1 font-[family-name:var(--font-manrope)] text-xl font-bold">
              Répartition par département
            </h3>
            <div className="mx-auto mt-6 h-56 w-56 rounded-full" style={{ background: conic }} />
            <div className="mt-6 space-y-3">
              {departmentDistribution.map((segment) => (
                <div key={segment.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                    <span>{segment.label}</span>
                  </div>
                  <Pill>{segment.value}%</Pill>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-slate-500">Analyse automatique</p>
            <h3 className="mt-1 font-[family-name:var(--font-manrope)] text-xl font-bold">
              Synthèse automatique
            </h3>
            <div className="mt-5 space-y-3">
              {insights.map((item) => (
                <div key={item} className="rounded-[12px] border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
