import type { Workflow, InsertWorkflow, Step, IntelDoc, Activity, WorkflowWithSteps, StepWithDetails } from "@shared/schema";

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

export async function getWorkflow(id: number): Promise<WorkflowWithSteps> {
  const res = await fetch(`/api/workflows/${id}`);
  if (!res.ok) throw new Error("Failed to fetch workflow");
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

export async function updateWorkflow(id: number, data: Partial<InsertWorkflow>): Promise<Workflow> {
  const res = await fetch(`/api/workflows/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update workflow");
  return res.json();
}

export async function deleteWorkflow(id: number): Promise<void> {
  const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete workflow");
}

export async function setActiveWorkflow(id: number): Promise<Workflow> {
  const res = await fetch(`/api/workflows/${id}/set-active`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to set active workflow");
  return res.json();
}

export async function getWorkflowSteps(workflowId: number): Promise<Step[]> {
  const res = await fetch(`/api/workflows/${workflowId}/steps`);
  if (!res.ok) throw new Error("Failed to fetch steps");
  return res.json();
}

export async function getWorkflowActivities(workflowId: number): Promise<Activity[]> {
  const res = await fetch(`/api/workflows/${workflowId}/activities`);
  if (!res.ok) throw new Error("Failed to fetch activities");
  return res.json();
}

export async function getStep(id: number): Promise<StepWithDetails> {
  const res = await fetch(`/api/steps/${id}`);
  if (!res.ok) throw new Error("Failed to fetch step");
  return res.json();
}

export async function updateStep(id: number, data: Partial<Step>): Promise<Step> {
  const res = await fetch(`/api/steps/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update step");
  return res.json();
}

export async function startStep(id: number): Promise<Step> {
  const res = await fetch(`/api/steps/${id}/start`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to start step");
  return res.json();
}

export async function completeStep(id: number): Promise<Step> {
  const res = await fetch(`/api/steps/${id}/complete`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to complete step");
  return res.json();
}

export async function requestApproval(stepId: number): Promise<void> {
  const res = await fetch(`/api/steps/${stepId}/request-approval`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to request approval");
}

export async function getStepIntel(stepId: number): Promise<IntelDoc[]> {
  const res = await fetch(`/api/steps/${stepId}/intel`);
  if (!res.ok) throw new Error("Failed to fetch intel docs");
  return res.json();
}

export async function addIntelDoc(stepId: number, doc: { title: string; content: string; docType: string }): Promise<IntelDoc> {
  const res = await fetch(`/api/steps/${stepId}/intel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!res.ok) throw new Error("Failed to add intel doc");
  return res.json();
}
