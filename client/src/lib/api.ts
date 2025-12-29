import type { Workflow, InsertWorkflow, Step, IntelDoc, Activity, WorkflowWithSteps, StepWithDetails, WorkflowShare, CompositeWorkflow, CompositeWorkflowWithItems } from "@shared/schema";

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

export async function advanceWorkflow(id: number, stepId?: number): Promise<Workflow> {
  const res = await fetch(`/api/workflows/${id}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stepId }),
  });
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

export async function uploadIntelDoc(stepId: number, data: { title: string; docType: string; file: File }): Promise<IntelDoc> {
  const form = new FormData();
  form.append("title", data.title);
  form.append("docType", data.docType);
  form.append("file", data.file);

  const res = await fetch(`/api/steps/${stepId}/intel/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Failed to upload intel doc");
  return res.json();
}

export async function getWorkflowShares(workflowId: number): Promise<WorkflowShare[]> {
  const res = await fetch(`/api/workflows/${workflowId}/shares`);
  if (!res.ok) throw new Error("Failed to fetch shares");
  return res.json();
}

export async function shareWorkflow(workflowId: number, userId: string, permission: string = "view"): Promise<WorkflowShare> {
  const res = await fetch(`/api/workflows/${workflowId}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, permission }),
  });
  if (!res.ok) throw new Error("Failed to share workflow");
  return res.json();
}

export async function removeShare(shareId: number): Promise<void> {
  const res = await fetch(`/api/shares/${shareId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove share");
}

export async function searchUsers(query: string): Promise<{ id: string; email: string | null; firstName: string | null; lastName: string | null }[]> {
  const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Failed to search users");
  return res.json();
}

export async function getComposites(): Promise<CompositeWorkflowWithItems[]> {
  const res = await fetch("/api/composites");
  if (!res.ok) throw new Error("Failed to fetch composites");
  return res.json();
}

export async function getComposite(id: number): Promise<CompositeWorkflowWithItems> {
  const res = await fetch(`/api/composites/${id}`);
  if (!res.ok) throw new Error("Failed to fetch composite");
  return res.json();
}

export async function createComposite(name: string, description: string, stepIds: number[]): Promise<CompositeWorkflow> {
  const res = await fetch("/api/composites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, stepIds }),
  });
  if (!res.ok) throw new Error("Failed to create composite");
  return res.json();
}

export async function deleteComposite(id: number): Promise<void> {
  const res = await fetch(`/api/composites/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete composite");
}
