import type { Workflow, InsertWorkflow, Step, IntelDoc, Activity, WorkflowWithSteps, StepWithDetails, WorkflowShare, CompositeWorkflow, CompositeWorkflowWithItems } from "@shared/schema";

export async function getActiveWorkflow(): Promise<WorkflowWithSteps | null> {
  const res = await fetch("/api/workflows/active");
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) throw new Error("Failed to fetch active workflow");
  return res.json();
}

export async function getWorkflows(): Promise<WorkflowWithSteps[]> {
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

export async function createWorkflow(
  workflow: InsertWorkflow & {
    proofConfig?: { proofRequired?: boolean; proofTitle?: string; proofDescription?: string }[];
  }
): Promise<Workflow> {
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

export async function updateUserProfile(payload: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  username?: string | null;
  profileImageUrl?: string | null;
}) {
  const res = await fetch("/api/user", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
}

export async function getUserProfile(userId: string) {
  const res = await fetch(`/api/users/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch profile");
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

export async function copyComposite(id: number, payload: { name?: string; description?: string; targetUserId?: string }): Promise<CompositeWorkflow> {
  const res = await fetch(`/api/composites/${id}/copy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to copy composite");
  return res.json();
}

export async function createCompositeSession(payload: { compositeId: number; name?: string; laneColor?: string }) {
  const res = await fetch("/api/composite-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function getCompositeSessions() {
  const res = await fetch("/api/composite-sessions");
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

export async function getCompositeSession(id: number) {
  const res = await fetch(`/api/composite-sessions/${id}`);
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json();
}

export async function deleteCompositeSession(id: number): Promise<void> {
  const res = await fetch(`/api/composite-sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete session");
}

export async function addCompositeSessionMember(sessionId: number, payload: any) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to add session member");
  return res.json();
}

export async function updateCompositeSessionMember(sessionId: number, memberId: number, payload: any) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/members/${memberId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update session member");
  return res.json();
}

export async function deleteCompositeSessionMember(sessionId: number, memberId: number): Promise<void> {
  const res = await fetch(`/api/composite-sessions/${sessionId}/members/${memberId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove session member");
}

export async function assignCompositeSessionStep(
  sessionId: number,
  payload: { stepId: number; assigneeUserId: string; allowDelegation?: boolean; allowDelegationToEveryone?: boolean }
) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to assign step");
  return res.json();
}

export async function removeCompositeSessionAssignment(sessionId: number, assignmentId: number): Promise<void> {
  const res = await fetch(`/api/composite-sessions/${sessionId}/assignments/${assignmentId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove assignment");
}

export async function updateCompositeSessionAssignment(sessionId: number, assignmentId: number, payload: any) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/assignments/${assignmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update assignment");
  return res.json();
}

export async function addCompositeSessionAssignmentDelegate(sessionId: number, assignmentId: number, userId: string) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/assignments/${assignmentId}/delegates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error("Failed to add assignment delegate");
  return res.json();
}

export async function removeCompositeSessionAssignmentDelegate(sessionId: number, assignmentId: number, delegateId: number): Promise<void> {
  const res = await fetch(`/api/composite-sessions/${sessionId}/assignments/${assignmentId}/delegates/${delegateId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove assignment delegate");
}

export async function addCompositeSessionLaneDelegate(sessionId: number, ownerUserId: string, userId: string) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/lane-delegates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerUserId, userId }),
  });
  if (!res.ok) throw new Error("Failed to add lane delegate");
  return res.json();
}

export async function removeCompositeSessionLaneDelegate(sessionId: number, delegateId: number): Promise<void> {
  const res = await fetch(`/api/composite-sessions/${sessionId}/lane-delegates/${delegateId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove lane delegate");
}

export async function updateCompositeSessionStep(sessionId: number, sessionStepId: number, payload: any) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/steps/${sessionStepId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update session step");
  return res.json();
}

export async function updateCompositeSessionStepContent(sessionId: number, sessionStepId: number, payload: any) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/steps/${sessionStepId}/content`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update step content");
  return res.json();
}

export async function getCompositeSessionIntel(sessionId: number) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/intel`);
  if (!res.ok) throw new Error("Failed to fetch session intel");
  return res.json();
}

export async function addCompositeSessionIntel(sessionId: number, payload: any) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/intel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to add session intel");
  return res.json();
}

export async function uploadCompositeSessionIntel(sessionId: number, data: { stepId: number; title: string; docType: string; file: File }) {
  const form = new FormData();
  form.append("stepId", String(data.stepId));
  form.append("title", data.title);
  form.append("docType", data.docType);
  form.append("file", data.file);
  const res = await fetch(`/api/composite-sessions/${sessionId}/intel/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Failed to upload session intel");
  return res.json();
}

export async function deleteCompositeSessionIntel(sessionId: number, docId: number): Promise<void> {
  const res = await fetch(`/api/composite-sessions/${sessionId}/intel/${docId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete session intel");
}

export async function updateStepProofConfig(stepId: number, payload: { proofRequired?: boolean; proofTitle?: string | null; proofDescription?: string | null }) {
  const res = await fetch(`/api/steps/${stepId}/proof-config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update proof config");
  return res.json();
}

export async function submitStepProof(stepId: number, payload: { content?: string }) {
  const res = await fetch(`/api/steps/${stepId}/proof`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to submit proof");
  return res.json();
}

export async function uploadStepProof(stepId: number, data: { content?: string; file: File }) {
  const form = new FormData();
  if (data.content !== undefined) {
    form.append("content", data.content);
  }
  form.append("file", data.file);
  const res = await fetch(`/api/steps/${stepId}/proof/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Failed to upload proof");
  return res.json();
}

export async function deleteStepProof(stepId: number): Promise<void> {
  const res = await fetch(`/api/steps/${stepId}/proof`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete proof");
}

export async function updateSessionProofConfig(sessionId: number, sessionStepId: number, payload: { proofRequired?: boolean; proofTitle?: string | null; proofDescription?: string | null }) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/steps/${sessionStepId}/proof-config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update session proof config");
  return res.json();
}

export async function submitSessionProof(sessionId: number, sessionStepId: number, payload: { content?: string }) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/steps/${sessionStepId}/proof`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to submit session proof");
  return res.json();
}

export async function uploadSessionProof(sessionId: number, sessionStepId: number, data: { content?: string; file: File }) {
  const form = new FormData();
  if (data.content !== undefined) {
    form.append("content", data.content);
  }
  form.append("file", data.file);
  const res = await fetch(`/api/composite-sessions/${sessionId}/steps/${sessionStepId}/proof/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Failed to upload session proof");
  return res.json();
}

export async function deleteSessionProof(sessionId: number, sessionStepId: number): Promise<void> {
  const res = await fetch(`/api/composite-sessions/${sessionId}/steps/${sessionStepId}/proof`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete session proof");
}

export async function getCompositeSessionMessages(sessionId: number) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/messages`);
  if (!res.ok) throw new Error("Failed to fetch session messages");
  return res.json();
}

export async function sendCompositeSessionMessage(sessionId: number, content: string) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to send session message");
  return res.json();
}

export async function markCompositeSessionMessagesRead(sessionId: number, messageIds: number[]) {
  const res = await fetch(`/api/composite-sessions/${sessionId}/messages/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageIds }),
  });
  if (!res.ok) throw new Error("Failed to mark messages read");
  return res.json();
}

export async function deleteCompositeSessionMessage(sessionId: number, messageId: number): Promise<void> {
  const res = await fetch(`/api/composite-sessions/${sessionId}/messages/${messageId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete message");
}
export async function deleteComposite(id: number): Promise<void> {
  const res = await fetch(`/api/composites/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete composite");
}
