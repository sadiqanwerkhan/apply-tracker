import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { redirect, notFound } from "next/navigation";
import ApplicationDetail from "@/components/ApplicationDetail";

type Insights = {
  techStack?: string[];
  teamSize?: string;
  teamStructure?: string;
  product?: string;
  payRange?: string;
  nextSteps?: string;
  notes?: string[];
};

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const app = await prisma.application.findUnique({
    where: { id },
    include: { stages: { orderBy: { order: "asc" }, include: { transcripts: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!app || app.userId !== user.id) notFound();

  const data = {
    id: app.id,
    company: app.company,
    role: app.role,
    analysis: app.analysis,
    analysisAt: app.analysisAt ? app.analysisAt.toISOString() : null,
    insights: (app.insights as unknown as Insights | null) ?? null,
    insightsAt: app.insightsAt ? app.insightsAt.toISOString() : null,
    jobTitle: app.jobTitle ?? null,
    jobLocation: app.jobLocation ?? null,
    jobDescription: app.jobDescription ?? null,
    stages: app.stages.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      result: s.result,
      transcripts: s.transcripts.map((t) => ({ id: t.id, label: t.label, content: t.content })),
    })),
  };

  return <ApplicationDetail application={data} />;
}