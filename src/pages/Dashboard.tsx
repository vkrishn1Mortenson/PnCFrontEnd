"use client";

import { FloatingDockDemo } from "@/components/ui/FloatingDock";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCheck,
  IconFile,
  IconFolder,
  IconGitCompare,
} from "@tabler/icons-react";

const dashboardMetrics = [
  {
    title: "Active Projects",
    value: "14",
    change: "+3",
    trend: "up",
    summary: "Projects updated today",
    description: "Engineering projects currently being processed",
    icon: IconFolder,
  },
  {
    title: "Sources Processed",
    value: "12,847",
    change: "+10.5%",
    trend: "up",
    summary: "1,342 processed this week",
    description: "Drawings, specifications, BOMs, and source files",
    icon: IconFile,
  },
  {
    title: "Open Conflicts",
    value: "214",
    change: "-8.2%",
    trend: "down",
    summary: "32 require priority review",
    description: "Engineering values awaiting a decision",
    icon: IconGitCompare,
  },
  {
    title: "Approved Objects",
    value: "47,532",
    change: "+5.1%",
    trend: "up",
    summary: "2,341 approved this week",
    description: "Objects available in the approved engineering model",
    icon: IconCheck,
  },
];

const projects = [
  {
    name: "Substation Expansion — Minneapolis",
    status: "Needs Review",
    sources: "124",
    components: "4,231",
    conflicts: "84",
    progress: "78%",
  },
  {
    name: "Solar Farm Protection Upgrade",
    status: "In Progress",
    sources: "342",
    components: "9,812",
    conflicts: "14",
    progress: "57%",
  },
  {
    name: "Relay Replacement Program",
    status: "Gold Approved",
    sources: "231",
    components: "3,421",
    conflicts: "0",
    progress: "100%",
  },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="flex-1 px-6 py-8 pb-32 lg:px-10">
        <section className="mb-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-blue-500">
            P&C Automation
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            Engineering Dashboard
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Monitor engineering sources, conflicts, decisions, and approved
            project data.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardMetrics.map((metric) => {
            const MetricIcon = metric.icon;
            const TrendIcon =
              metric.trend === "up"
                ? IconArrowUpRight
                : IconArrowDownRight;

            return (
              <Card
                key={metric.title}
                className="border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 text-white shadow-none transition-colors hover:border-blue-600/70"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-600/10 text-blue-500">
                        <MetricIcon size={21} stroke={1.8} />
                      </div>

                      <CardTitle className="text-sm font-medium text-zinc-300">
                        {metric.title}
                      </CardTitle>
                    </div>

                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-zinc-700 bg-black/40 text-xs text-white"
                    >
                      <TrendIcon size={13} />
                      {metric.change}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="text-3xl font-semibold tracking-tight">
                    {metric.value}
                  </div>

                  <div className="mt-7 flex items-center gap-2 text-sm font-medium">
                    <TrendIcon
                      size={16}
                      className={
                        metric.trend === "up"
                          ? "text-blue-500"
                          : "text-zinc-400"
                      }
                    />
                    <span>{metric.summary}</span>
                  </div>

                  <CardDescription className="mt-2 text-sm leading-5 text-zinc-500">
                    {metric.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <Card className="border-zinc-800 bg-zinc-950 text-white shadow-none">
            <CardHeader>
              <CardTitle>Projects Requiring Attention</CardTitle>
              <CardDescription className="text-zinc-500">
                Projects containing unresolved engineering conflicts.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project.name}
                  className="grid gap-4 rounded-xl border border-zinc-800 bg-black p-4 transition-colors hover:border-blue-600/60 md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-medium">{project.name}</h3>

                      <Badge
                        variant="outline"
                        className="border-blue-500/30 bg-blue-500/10 text-blue-400"
                      >
                        {project.status}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      <span className="text-zinc-500">
                        Sources{" "}
                        <strong className="ml-1 text-zinc-200">
                          {project.sources}
                        </strong>
                      </span>

                      <span className="text-zinc-500">
                        Components{" "}
                        <strong className="ml-1 text-zinc-200">
                          {project.components}
                        </strong>
                      </span>

                      <span className="text-zinc-500">
                        Conflicts{" "}
                        <strong className="ml-1 text-blue-400">
                          {project.conflicts}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex min-w-28 items-center justify-end">
                    <span className="text-2xl font-semibold text-blue-500">
                      {project.progress}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950 text-white shadow-none">
            <CardHeader>
              <CardTitle>Engineering Pipeline</CardTitle>
              <CardDescription className="text-zinc-500">
                Current project-data workflow.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-6">
                {[
                  ["Bronze", "Source evidence", "100%"],
                  ["Silver", "Extracted model", "82%"],
                  ["Review", "Conflict decisions", "64%"],
                  ["Gold", "Approved model", "41%"],
                ].map(([layer, label, progress]) => (
                  <div key={layer}>
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{layer}</p>
                        <p className="text-xs text-zinc-500">{label}</p>
                      </div>

                      <span className="text-sm font-medium text-blue-400">
                        {progress}
                      </span>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: progress }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        <FloatingDockDemo />
      </div>
    </div>
  );
}