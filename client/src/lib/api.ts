import type { Workflow, InsertWorkflow } from "@shared/schema";

export async function getActiveWorkflow(): Promise<Workflow | null> {
  const res = await fetch("/api/workflows/active");
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) throw new Error("Failed to fetch active workflow");
  return res.json();
}

export async function getWorkflows(): Promise<Workflow[]> {
  const res = await fetch("/api/workflows");
  if (!res.ok) throw new Error("Failed to fetch workflows");
  return res.json();
}

export async function advanceWorkflow(id: number): Promise<Workflow> {
  const res = await fetch(`/api/workflows/${id}/advance`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to advance workflow");
  return res.json();
}

export async function createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
  const res = await fetch("/api/workflows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workflow),
  });
  if (!res.ok) throw new Error("Failed to create workflow");
  return res.json();
}

export async function setActiveWorkflow(id: number): Promise<Workflow> {
  const res = await fetch(`/api/workflows/${id}/set-active`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to set active workflow");
  return res.json();
}
