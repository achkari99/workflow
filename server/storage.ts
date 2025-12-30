import {
  workflows,
  steps,
  approvals,
  intelDocs,
  activities,
  workflowShares,
  compositeWorkflows,
  compositeWorkflowItems,
  compositeWorkflowSessions,
  compositeWorkflowSessionMembers,
  compositeWorkflowSessionSteps,
  compositeWorkflowSessionAssignments,
  compositeWorkflowSessionAssignmentDelegates,
  compositeWorkflowSessionLaneDelegates,
  compositeWorkflowSessionIntelDocs,
  compositeWorkflowSessionMessages,
  compositeWorkflowSessionMessageReads,
  compositeWorkflowCopies,
  type Workflow,
  type InsertWorkflow,
  type Step,
  type InsertStep,
  type Approval,
  type InsertApproval,
  type IntelDoc,
  type InsertIntelDoc,
  type Activity,
  type InsertActivity,
  type WorkflowWithSteps,
  type StepWithDetails,
  type WorkflowShare,
  type InsertWorkflowShare,
  type CompositeWorkflow,
  type InsertCompositeWorkflow,
  type CompositeWorkflowItem,
  type InsertCompositeWorkflowItem,
  type CompositeWorkflowWithItems,
  type CompositeWorkflowSession,
  type CompositeWorkflowSessionMember,
  type CompositeWorkflowSessionStep,
  type CompositeWorkflowSessionAssignment,
  type CompositeWorkflowSessionAssignmentDelegate,
  type CompositeWorkflowSessionLaneDelegate,
  type CompositeWorkflowSessionIntelDoc,
  type CompositeWorkflowSessionMessage,
  type CompositeWorkflowSessionMessageRead,
  type CompositeWorkflowCopy,
  type InsertCompositeWorkflowSession,
  type InsertCompositeWorkflowSessionMember,
  type InsertCompositeWorkflowSessionStep,
  type InsertCompositeWorkflowSessionAssignment,
  type InsertCompositeWorkflowSessionAssignmentDelegate,
  type InsertCompositeWorkflowSessionLaneDelegate,
  type InsertCompositeWorkflowSessionIntelDoc,
  type InsertCompositeWorkflowSessionMessage,
  type InsertCompositeWorkflowSessionMessageRead,
  users
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, or, and, ilike, isNull, inArray } from "drizzle-orm";

export interface IStorage {
  getWorkflows(userId?: string): Promise<Workflow[]>;
  getWorkflow(id: number): Promise<Workflow | undefined>;
  getWorkflowWithSteps(id: number): Promise<WorkflowWithSteps | undefined>;
  getActiveWorkflow(userId?: string): Promise<Workflow | undefined>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined>;
  setActiveWorkflow(id: number, userId?: string): Promise<void>;
  advanceWorkflowStep(id: number): Promise<Workflow | undefined>;
  deleteWorkflow(id: number): Promise<boolean>;

  getStepsByWorkflow(workflowId: number): Promise<Step[]>;
  getStep(id: number): Promise<Step | undefined>;
  getStepWithDetails(id: number): Promise<StepWithDetails | undefined>;
  createStep(step: InsertStep): Promise<Step>;
  updateStep(id: number, step: Partial<InsertStep>): Promise<Step | undefined>;
  completeStep(id: number): Promise<Step | undefined>;

  getApprovalsByStep(stepId: number): Promise<Approval[]>;
  createApproval(approval: InsertApproval): Promise<Approval>;
  updateApproval(id: number, approval: Partial<InsertApproval>): Promise<Approval | undefined>;

  getIntelDocsByStep(stepId: number): Promise<IntelDoc[]>;
  createIntelDoc(doc: InsertIntelDoc): Promise<IntelDoc>;
  deleteIntelDoc(id: number): Promise<boolean>;

  getActivitiesByWorkflow(workflowId: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  getWorkflowShares(workflowId: number): Promise<WorkflowShare[]>;
  getShare(id: number): Promise<WorkflowShare | undefined>;
  shareWorkflow(share: InsertWorkflowShare): Promise<WorkflowShare>;
  removeShare(id: number): Promise<boolean>;
  getSharedWorkflows(userId: string): Promise<Workflow[]>;

  searchUsers(query: string): Promise<{ id: string; email: string | null; firstName: string | null; lastName: string | null }[]>;

  getCompositeWorkflows(userId?: string): Promise<CompositeWorkflowWithItems[]>;
  getCompositeWorkflowWithItems(id: number): Promise<CompositeWorkflowWithItems | undefined>;
  getCompositeWorkflowSession(id: number): Promise<any>;
  createCompositeWorkflowSession(session: InsertCompositeWorkflowSession): Promise<CompositeWorkflowSession>;
  deleteCompositeWorkflowSession(id: number): Promise<boolean>;
  addCompositeWorkflowSessionMember(member: InsertCompositeWorkflowSessionMember): Promise<CompositeWorkflowSessionMember>;
  updateCompositeWorkflowSessionMember(id: number, data: Partial<InsertCompositeWorkflowSessionMember>): Promise<CompositeWorkflowSessionMember | undefined>;
  getCompositeWorkflowSessionMembers(sessionId: number): Promise<CompositeWorkflowSessionMember[]>;
  createCompositeWorkflowSessionStep(step: InsertCompositeWorkflowSessionStep): Promise<CompositeWorkflowSessionStep>;
  assignCompositeWorkflowSessionStep(assignment: InsertCompositeWorkflowSessionAssignment): Promise<CompositeWorkflowSessionAssignment>;
  removeCompositeWorkflowSessionAssignment(id: number): Promise<boolean>;
  getCompositeWorkflowSessionAssignments(sessionId: number): Promise<CompositeWorkflowSessionAssignment[]>;
  updateCompositeWorkflowSessionAssignment(id: number, data: Partial<InsertCompositeWorkflowSessionAssignment>): Promise<CompositeWorkflowSessionAssignment | undefined>;
  getCompositeWorkflowSessionAssignmentDelegates(sessionId: number): Promise<CompositeWorkflowSessionAssignmentDelegate[]>;
  addCompositeWorkflowSessionAssignmentDelegate(delegate: InsertCompositeWorkflowSessionAssignmentDelegate): Promise<CompositeWorkflowSessionAssignmentDelegate>;
  removeCompositeWorkflowSessionAssignmentDelegate(id: number): Promise<CompositeWorkflowSessionAssignmentDelegate | undefined>;
  getCompositeWorkflowSessionLaneDelegates(sessionId: number): Promise<CompositeWorkflowSessionLaneDelegate[]>;
  addCompositeWorkflowSessionLaneDelegate(delegate: InsertCompositeWorkflowSessionLaneDelegate): Promise<CompositeWorkflowSessionLaneDelegate>;
  removeCompositeWorkflowSessionLaneDelegate(id: number): Promise<CompositeWorkflowSessionLaneDelegate | undefined>;
  updateCompositeWorkflowSessionStep(id: number, data: Partial<InsertCompositeWorkflowSessionStep>): Promise<CompositeWorkflowSessionStep | undefined>;
  getCompositeWorkflowSessionSteps(sessionId: number): Promise<CompositeWorkflowSessionStep[]>;
  addCompositeWorkflowSessionIntelDoc(doc: InsertCompositeWorkflowSessionIntelDoc): Promise<CompositeWorkflowSessionIntelDoc>;
  getCompositeWorkflowSessionIntelDocs(sessionId: number): Promise<CompositeWorkflowSessionIntelDoc[]>;
  getCompositeWorkflowSessionIntelDoc(id: number): Promise<CompositeWorkflowSessionIntelDoc | undefined>;
  removeCompositeWorkflowSessionIntelDoc(id: number): Promise<CompositeWorkflowSessionIntelDoc | undefined>;
  getCompositeWorkflowSessionMessages(sessionId: number): Promise<any[]>;
  addCompositeWorkflowSessionMessage(message: InsertCompositeWorkflowSessionMessage): Promise<CompositeWorkflowSessionMessage>;
  removeCompositeWorkflowSessionMessage(id: number): Promise<CompositeWorkflowSessionMessage | undefined>;
  addCompositeWorkflowSessionMessageRead(read: InsertCompositeWorkflowSessionMessageRead): Promise<CompositeWorkflowSessionMessageRead | undefined>;
  removeCompositeWorkflowSessionMember(id: number): Promise<CompositeWorkflowSessionMember | undefined>;
  getCompositeWorkflowSessionsForUser(userId: string): Promise<any[]>;

  createCompositeWorkflow(composite: InsertCompositeWorkflow): Promise<CompositeWorkflow>;
  cloneCompositeForUser(sourceCompositeId: number, ownerId: string, name?: string, description?: string): Promise<CompositeWorkflow>;
  cloneStepToComposite(compositeId: number, originalStepId: number, orderIndex: number, cloneIntelDocs?: boolean): Promise<CompositeWorkflowItem>;
  addStepToComposite(item: InsertCompositeWorkflowItem): Promise<CompositeWorkflowItem>;
  removeStepFromComposite(id: number): Promise<boolean>;
  deleteCompositeWorkflow(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getWorkflows(userId?: string): Promise<Workflow[]> {
    if (userId) {
      const owned = await db.select().from(workflows).where(eq(workflows.ownerId, userId)).orderBy(desc(workflows.createdAt));
      const sharedIds = await db.select({ workflowId: workflowShares.workflowId }).from(workflowShares).where(eq(workflowShares.sharedWithUserId, userId));
      if (sharedIds.length > 0) {
        const sharedWorkflows = await Promise.all(sharedIds.map(s => this.getWorkflow(s.workflowId)));
        return [...owned, ...sharedWorkflows.filter((w): w is Workflow => w !== undefined)];
      }
      return owned;
    }
    return await db.select().from(workflows).orderBy(desc(workflows.createdAt));
  }

  async getWorkflow(id: number): Promise<Workflow | undefined> {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    return workflow || undefined;
  }

  async getWorkflowWithSteps(id: number): Promise<WorkflowWithSteps | undefined> {
    const workflow = await this.getWorkflow(id);
    if (!workflow) return undefined;

    const workflowSteps = await db
      .select()
      .from(steps)
      .where(and(eq(steps.workflowId, id), isNull(steps.compositeId)))
      .orderBy(asc(steps.id));

    return { ...workflow, steps: workflowSteps };
  }

  async getActiveWorkflow(userId?: string): Promise<Workflow | undefined> {
    if (userId) {
      const [workflow] = await db.select().from(workflows).where(and(eq(workflows.isActive, true), eq(workflows.ownerId, userId)));
      return workflow || undefined;
    }
    const [workflow] = await db.select().from(workflows).where(eq(workflows.isActive, true));
    return workflow || undefined;
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const [newWorkflow] = await db.insert(workflows).values(workflow).returning();
    return newWorkflow;
  }

  async updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined> {
    const [updated] = await db
      .update(workflows)
      .set({ ...workflow, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return updated || undefined;
  }

  async setActiveWorkflow(id: number, userId?: string): Promise<void> {
    if (userId) {
      await db.update(workflows).set({ isActive: false }).where(eq(workflows.ownerId, userId));
    } else {
      await db.update(workflows).set({ isActive: false });
    }
    await db.update(workflows).set({ isActive: true }).where(eq(workflows.id, id));
  }

  async advanceWorkflowStep(id: number, stepId?: number): Promise<Workflow | undefined> {
    const workflow = await this.getWorkflow(id);
    if (!workflow) return undefined;

    console.log(`Advancing workflow ${id}. Current step: ${workflow.currentStep}/${workflow.totalSteps}`);
    const currentSteps = await this.getStepsByWorkflow(id);
    console.log(`Total steps found in DB: ${currentSteps.length}`);

    // Safety check: Don't advance if already at or past the end
    if (workflow.currentStep >= workflow.totalSteps) {
      return workflow;
    }

    // Use the provided stepId as an anchor, or fall back to the global pointer
    let currentIndex = workflow.currentStep - 1;
    if (stepId) {
      const foundIndex = currentSteps.findIndex(s => s.id === stepId);
      if (foundIndex !== -1) currentIndex = foundIndex;
    }

    const currentStep = currentSteps[currentIndex];

    if (currentStep && !currentStep.isCompleted) {
      await this.completeStep(currentStep.id);
    }

    // Only increment the head pointer if we are finishing the "current" task or one ahead
    // This prevents skipping if the user manually completes an older task
    const nextStepNumber = Math.min(currentIndex + 2, workflow.totalSteps);
    const nextStepIndex = nextStepNumber - 1;

    // Update workflow head pointer
    const [updated] = await db
      .update(workflows)
      .set({
        currentStep: nextStepNumber,
        updatedAt: new Date()
      })
      .where(eq(workflows.id, id))
      .returning();

    // Unlock the next step in the sequence
    const nextStepRecord = currentSteps[nextStepIndex];
    if (nextStepRecord) {
      await this.updateStep(nextStepRecord.id, { status: "active" });
    }

    await this.createActivity({
      workflowId: id,
      stepId: currentStep?.id,
      action: "step_advanced",
      description: `Advanced to phase ${nextStepNumber}`,
    });

    return updated || undefined;
  }

  async deleteWorkflow(id: number): Promise<boolean> {
    await db.delete(workflows).where(eq(workflows.id, id));
    return true;
  }

  async getStepsByWorkflow(workflowId: number): Promise<Step[]> {
    return await db
      .select()
      .from(steps)
      .where(and(eq(steps.workflowId, workflowId), isNull(steps.compositeId)))
      .orderBy(asc(steps.id));
  }

  async getStep(id: number): Promise<Step | undefined> {
    const [step] = await db.select().from(steps).where(eq(steps.id, id));
    return step || undefined;
  }

  async getStepWithDetails(id: number): Promise<StepWithDetails | undefined> {
    const step = await this.getStep(id);
    if (!step) return undefined;

    const stepApprovals = await this.getApprovalsByStep(id);
    const stepIntelDocs = await this.getIntelDocsByStep(id);

    return { ...step, approvals: stepApprovals, intelDocs: stepIntelDocs };
  }

  async createStep(step: InsertStep): Promise<Step> {
    const [newStep] = await db.insert(steps).values(step).returning();
    return newStep;
  }

  async updateStep(id: number, step: Partial<InsertStep>): Promise<Step | undefined> {
    const [updated] = await db.update(steps).set(step).where(eq(steps.id, id)).returning();
    return updated || undefined;
  }

  async completeStep(id: number): Promise<Step | undefined> {
    const [updated] = await db
      .update(steps)
      .set({ isCompleted: true, status: "completed", completedAt: new Date() })
      .where(eq(steps.id, id))
      .returning();
    return updated || undefined;
  }

  async getApprovalsByStep(stepId: number): Promise<Approval[]> {
    return await db.select().from(approvals).where(eq(approvals.stepId, stepId));
  }

  async createApproval(approval: InsertApproval): Promise<Approval> {
    const [newApproval] = await db.insert(approvals).values(approval).returning();
    return newApproval;
  }

  async updateApproval(id: number, approval: Partial<InsertApproval>): Promise<Approval | undefined> {
    const [updated] = await db
      .update(approvals)
      .set({ ...approval, respondedAt: new Date() })
      .where(eq(approvals.id, id))
      .returning();
    return updated || undefined;
  }

  async getIntelDocsByStep(stepId: number): Promise<IntelDoc[]> {
    return await db.select().from(intelDocs).where(eq(intelDocs.stepId, stepId));
  }

  async createIntelDoc(doc: InsertIntelDoc): Promise<IntelDoc> {
    const [newDoc] = await db.insert(intelDocs).values(doc).returning();
    return newDoc;
  }

  async deleteIntelDoc(id: number): Promise<boolean> {
    await db.delete(intelDocs).where(eq(intelDocs.id, id));
    return true;
  }

  async getActivitiesByWorkflow(workflowId: number): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.workflowId, workflowId))
      .orderBy(desc(activities.createdAt));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
  }

  async getWorkflowShares(workflowId: number): Promise<WorkflowShare[]> {
    return await db.select().from(workflowShares).where(eq(workflowShares.workflowId, workflowId));
  }

  async getShare(id: number): Promise<WorkflowShare | undefined> {
    const [share] = await db.select().from(workflowShares).where(eq(workflowShares.id, id));
    return share || undefined;
  }

  async shareWorkflow(share: InsertWorkflowShare): Promise<WorkflowShare> {
    const existing = await db.select().from(workflowShares)
      .where(and(
        eq(workflowShares.workflowId, share.workflowId),
        eq(workflowShares.sharedWithUserId, share.sharedWithUserId)
      ));
    if (existing.length > 0) {
      const [updated] = await db.update(workflowShares)
        .set({ permission: share.permission })
        .where(eq(workflowShares.id, existing[0].id))
        .returning();
      return updated;
    }
    const [newShare] = await db.insert(workflowShares).values(share).returning();
    return newShare;
  }

  async removeShare(id: number): Promise<boolean> {
    await db.delete(workflowShares).where(eq(workflowShares.id, id));
    return true;
  }

  async getSharedWorkflows(userId: string): Promise<Workflow[]> {
    const shares = await db.select().from(workflowShares).where(eq(workflowShares.sharedWithUserId, userId));
    const sharedWorkflows = await Promise.all(shares.map(s => this.getWorkflow(s.workflowId)));
    return sharedWorkflows.filter((w): w is Workflow => w !== undefined);
  }

  async searchUsers(query: string): Promise<{ id: string; email: string | null; firstName: string | null; lastName: string | null }[]> {
    return await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(users).where(ilike(users.email, `%${query}%`)).limit(10);
  }

  async getCompositeWorkflows(userId?: string): Promise<CompositeWorkflowWithItems[]> {
    let query = db.select().from(compositeWorkflows).$dynamic();
    if (userId) {
      query = query.where(eq(compositeWorkflows.ownerId, userId));
    }
    const composites = await query.orderBy(desc(compositeWorkflows.createdAt));

    return await Promise.all(composites.map(async (c) => {
      const compositeItems = await db.select({
        step: steps,
        workflow: workflows
      })
        .from(compositeWorkflowItems)
        .where(eq(compositeWorkflowItems.compositeId, c.id))
        .innerJoin(steps, eq(compositeWorkflowItems.stepId, steps.id))
        .leftJoin(workflows, eq(steps.workflowId, workflows.id))
        .orderBy(asc(compositeWorkflowItems.orderIndex));

      const remixedSteps = compositeItems.map(item => ({
        ...item.step,
        workflowName: item.workflow?.name || "Independent Phase"
      }));

      return { ...c, steps: remixedSteps };
    }));
  }

  async getCompositeWorkflowWithItems(id: number): Promise<CompositeWorkflowWithItems | undefined> {
    const [composite] = await db.select().from(compositeWorkflows).where(eq(compositeWorkflows.id, id));
    if (!composite) return undefined;

    const compositeItems = await db.select({
      step: steps,
      workflow: workflows
    })
      .from(compositeWorkflowItems)
      .where(eq(compositeWorkflowItems.compositeId, id))
      .innerJoin(steps, eq(compositeWorkflowItems.stepId, steps.id))
      .leftJoin(workflows, eq(steps.workflowId, workflows.id))
      .orderBy(asc(compositeWorkflowItems.orderIndex));

    const remixedSteps = compositeItems.map(item => ({
      ...item.step,
      workflowName: item.workflow?.name || "Independent Phase"
    }));

    return { ...composite, steps: remixedSteps };
  }

  async getCompositeWorkflowSession(id: number) {
    const [session] = await db.select().from(compositeWorkflowSessions).where(eq(compositeWorkflowSessions.id, id));
    if (!session) return undefined;

    const members = await db.select().from(compositeWorkflowSessionMembers).where(eq(compositeWorkflowSessionMembers.sessionId, id));
    const memberIds = members.map((m) => m.userId);
    const memberUsers = memberIds.length
      ? await db.select().from(users).where(inArray(users.id, memberIds))
      : [];
    const assignments = await db.select().from(compositeWorkflowSessionAssignments).where(eq(compositeWorkflowSessionAssignments.sessionId, id));
    const assignmentIds = assignments.map((assignment) => assignment.id);
    const assignmentDelegates = assignmentIds.length
      ? await db.select().from(compositeWorkflowSessionAssignmentDelegates)
        .where(inArray(compositeWorkflowSessionAssignmentDelegates.assignmentId, assignmentIds))
      : [];
    const laneDelegates = await db.select().from(compositeWorkflowSessionLaneDelegates).where(eq(compositeWorkflowSessionLaneDelegates.sessionId, id));
    const sessionSteps = await db.select().from(compositeWorkflowSessionSteps).where(eq(compositeWorkflowSessionSteps.sessionId, id));
    const intelDocs = await db.select().from(compositeWorkflowSessionIntelDocs).where(eq(compositeWorkflowSessionIntelDocs.sessionId, id));
    const composite = await this.getCompositeWorkflowWithItems(session.compositeId);

    const delegatesByAssignment = new Map<number, CompositeWorkflowSessionAssignmentDelegate[]>();
    for (const delegate of assignmentDelegates) {
      const list = delegatesByAssignment.get(delegate.assignmentId) || [];
      list.push(delegate);
      delegatesByAssignment.set(delegate.assignmentId, list);
    }

    const laneDelegatesByOwner = new Map<string, CompositeWorkflowSessionLaneDelegate[]>();
    for (const delegate of laneDelegates) {
      const list = laneDelegatesByOwner.get(delegate.ownerUserId) || [];
      list.push(delegate);
      laneDelegatesByOwner.set(delegate.ownerUserId, list);
    }

    return {
      ...session,
      composite,
      members: members.map((m) => ({
        ...m,
        user: memberUsers.find((u) => u.id === m.userId) || null,
        laneDelegates: laneDelegatesByOwner.get(m.userId) || [],
      })),
      assignments: assignments.map((assignment) => ({
        ...assignment,
        delegates: delegatesByAssignment.get(assignment.id) || [],
      })),
      sessionSteps,
      intelDocs,
    };
  }

  async createCompositeWorkflow(composite: InsertCompositeWorkflow): Promise<CompositeWorkflow> {
    const [newComposite] = await db.insert(compositeWorkflows).values(composite).returning();
    return newComposite;
  }

  async createCompositeWorkflowSession(session: InsertCompositeWorkflowSession): Promise<CompositeWorkflowSession> {
    const [newSession] = await db.insert(compositeWorkflowSessions).values(session).returning();
    return newSession;
  }

  async deleteCompositeWorkflowSession(id: number): Promise<boolean> {
    await db.delete(compositeWorkflowSessions).where(eq(compositeWorkflowSessions.id, id));
    return true;
  }

  async addCompositeWorkflowSessionMember(member: InsertCompositeWorkflowSessionMember): Promise<CompositeWorkflowSessionMember> {
    const [newMember] = await db.insert(compositeWorkflowSessionMembers).values(member).returning();
    return newMember;
  }

  async createCompositeWorkflowSessionStep(step: InsertCompositeWorkflowSessionStep): Promise<CompositeWorkflowSessionStep> {
    const [created] = await db.insert(compositeWorkflowSessionSteps).values(step).returning();
    return created;
  }

  async updateCompositeWorkflowSessionMember(id: number, data: Partial<InsertCompositeWorkflowSessionMember>): Promise<CompositeWorkflowSessionMember | undefined> {
    const [updated] = await db.update(compositeWorkflowSessionMembers).set(data).where(eq(compositeWorkflowSessionMembers.id, id)).returning();
    return updated || undefined;
  }

  async getCompositeWorkflowSessionMembers(sessionId: number): Promise<CompositeWorkflowSessionMember[]> {
    return await db.select().from(compositeWorkflowSessionMembers).where(eq(compositeWorkflowSessionMembers.sessionId, sessionId));
  }

  async assignCompositeWorkflowSessionStep(assignment: InsertCompositeWorkflowSessionAssignment): Promise<CompositeWorkflowSessionAssignment> {
    const [created] = await db.insert(compositeWorkflowSessionAssignments).values(assignment).returning();
    return created;
  }

  async removeCompositeWorkflowSessionAssignment(id: number): Promise<boolean> {
    await db.delete(compositeWorkflowSessionAssignments).where(eq(compositeWorkflowSessionAssignments.id, id));
    return true;
  }

  async getCompositeWorkflowSessionAssignments(sessionId: number): Promise<CompositeWorkflowSessionAssignment[]> {
    return await db.select().from(compositeWorkflowSessionAssignments).where(eq(compositeWorkflowSessionAssignments.sessionId, sessionId));
  }

  async updateCompositeWorkflowSessionAssignment(id: number, data: Partial<InsertCompositeWorkflowSessionAssignment>): Promise<CompositeWorkflowSessionAssignment | undefined> {
    const [updated] = await db.update(compositeWorkflowSessionAssignments)
      .set(data)
      .where(eq(compositeWorkflowSessionAssignments.id, id))
      .returning();
    return updated || undefined;
  }

  async getCompositeWorkflowSessionAssignmentDelegates(sessionId: number): Promise<CompositeWorkflowSessionAssignmentDelegate[]> {
    const assignments = await db.select().from(compositeWorkflowSessionAssignments)
      .where(eq(compositeWorkflowSessionAssignments.sessionId, sessionId));
    const assignmentIds = assignments.map((assignment) => assignment.id);
    if (!assignmentIds.length) return [];
    return await db.select()
      .from(compositeWorkflowSessionAssignmentDelegates)
      .where(inArray(compositeWorkflowSessionAssignmentDelegates.assignmentId, assignmentIds));
  }

  async addCompositeWorkflowSessionAssignmentDelegate(delegate: InsertCompositeWorkflowSessionAssignmentDelegate): Promise<CompositeWorkflowSessionAssignmentDelegate> {
    const [created] = await db.insert(compositeWorkflowSessionAssignmentDelegates).values(delegate).returning();
    return created;
  }

  async removeCompositeWorkflowSessionAssignmentDelegate(id: number): Promise<CompositeWorkflowSessionAssignmentDelegate | undefined> {
    const [removed] = await db.delete(compositeWorkflowSessionAssignmentDelegates)
      .where(eq(compositeWorkflowSessionAssignmentDelegates.id, id))
      .returning();
    return removed || undefined;
  }

  async getCompositeWorkflowSessionLaneDelegates(sessionId: number): Promise<CompositeWorkflowSessionLaneDelegate[]> {
    return await db.select().from(compositeWorkflowSessionLaneDelegates).where(eq(compositeWorkflowSessionLaneDelegates.sessionId, sessionId));
  }

  async addCompositeWorkflowSessionLaneDelegate(delegate: InsertCompositeWorkflowSessionLaneDelegate): Promise<CompositeWorkflowSessionLaneDelegate> {
    const [created] = await db.insert(compositeWorkflowSessionLaneDelegates).values(delegate).returning();
    return created;
  }

  async removeCompositeWorkflowSessionLaneDelegate(id: number): Promise<CompositeWorkflowSessionLaneDelegate | undefined> {
    const [removed] = await db.delete(compositeWorkflowSessionLaneDelegates)
      .where(eq(compositeWorkflowSessionLaneDelegates.id, id))
      .returning();
    return removed || undefined;
  }

  async updateCompositeWorkflowSessionStep(id: number, data: Partial<InsertCompositeWorkflowSessionStep>): Promise<CompositeWorkflowSessionStep | undefined> {
    const [updated] = await db.update(compositeWorkflowSessionSteps).set(data).where(eq(compositeWorkflowSessionSteps.id, id)).returning();
    return updated || undefined;
  }

  async getCompositeWorkflowSessionSteps(sessionId: number): Promise<CompositeWorkflowSessionStep[]> {
    return await db.select().from(compositeWorkflowSessionSteps).where(eq(compositeWorkflowSessionSteps.sessionId, sessionId));
  }

  async addCompositeWorkflowSessionIntelDoc(doc: InsertCompositeWorkflowSessionIntelDoc): Promise<CompositeWorkflowSessionIntelDoc> {
    const [created] = await db.insert(compositeWorkflowSessionIntelDocs).values(doc).returning();
    return created;
  }

  async getCompositeWorkflowSessionIntelDocs(sessionId: number): Promise<CompositeWorkflowSessionIntelDoc[]> {
    return await db.select().from(compositeWorkflowSessionIntelDocs).where(eq(compositeWorkflowSessionIntelDocs.sessionId, sessionId));
  }

  async getCompositeWorkflowSessionIntelDoc(id: number): Promise<CompositeWorkflowSessionIntelDoc | undefined> {
    const [doc] = await db.select().from(compositeWorkflowSessionIntelDocs).where(eq(compositeWorkflowSessionIntelDocs.id, id));
    return doc || undefined;
  }

  async removeCompositeWorkflowSessionIntelDoc(id: number): Promise<CompositeWorkflowSessionIntelDoc | undefined> {
    const [removed] = await db.delete(compositeWorkflowSessionIntelDocs)
      .where(eq(compositeWorkflowSessionIntelDocs.id, id))
      .returning();
    return removed || undefined;
  }

  async getCompositeWorkflowSessionMessages(sessionId: number): Promise<any[]> {
    const messages = await db.select().from(compositeWorkflowSessionMessages)
      .where(eq(compositeWorkflowSessionMessages.sessionId, sessionId))
      .orderBy(asc(compositeWorkflowSessionMessages.createdAt));
    const messageIds = messages.map((message) => message.id);
    const messageReads = messageIds.length
      ? await db.select().from(compositeWorkflowSessionMessageReads)
        .where(inArray(compositeWorkflowSessionMessageReads.messageId, messageIds))
      : [];
    const userIds = Array.from(
      new Set([
        ...messages.map((message) => message.userId),
        ...messageReads.map((read) => read.userId),
      ])
    );
    const messageUsers = userIds.length
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const readsByMessage = new Map<number, CompositeWorkflowSessionMessageRead[]>();
    for (const read of messageReads) {
      const list = readsByMessage.get(read.messageId) || [];
      list.push(read);
      readsByMessage.set(read.messageId, list);
    }
    return messages.map((message) => ({
      ...message,
      user: messageUsers.find((u) => u.id === message.userId) || null,
      reads: (readsByMessage.get(message.id) || []).map((read) => ({
        ...read,
        user: messageUsers.find((u) => u.id === read.userId) || null,
      })),
    }));
  }

  async addCompositeWorkflowSessionMessage(message: InsertCompositeWorkflowSessionMessage): Promise<CompositeWorkflowSessionMessage> {
    const [created] = await db.insert(compositeWorkflowSessionMessages).values(message).returning();
    return created;
  }

  async removeCompositeWorkflowSessionMessage(id: number): Promise<CompositeWorkflowSessionMessage | undefined> {
    const [removed] = await db.delete(compositeWorkflowSessionMessages)
      .where(eq(compositeWorkflowSessionMessages.id, id))
      .returning();
    return removed || undefined;
  }

  async addCompositeWorkflowSessionMessageRead(read: InsertCompositeWorkflowSessionMessageRead): Promise<CompositeWorkflowSessionMessageRead | undefined> {
    const existing = await db.select().from(compositeWorkflowSessionMessageReads)
      .where(and(
        eq(compositeWorkflowSessionMessageReads.messageId, read.messageId),
        eq(compositeWorkflowSessionMessageReads.userId, read.userId)
      ));
    if (existing.length > 0) {
      return existing[0];
    }
    const [created] = await db.insert(compositeWorkflowSessionMessageReads).values(read).returning();
    return created;
  }

  async removeCompositeWorkflowSessionMember(id: number): Promise<CompositeWorkflowSessionMember | undefined> {
    const [removed] = await db.delete(compositeWorkflowSessionMembers)
      .where(eq(compositeWorkflowSessionMembers.id, id))
      .returning();
    return removed || undefined;
  }

  async getCompositeWorkflowSessionsForUser(userId: string): Promise<any[]> {
    const owned = await db.select().from(compositeWorkflowSessions).where(eq(compositeWorkflowSessions.ownerId, userId));
    const memberSessions = await db.select()
      .from(compositeWorkflowSessionMembers)
      .where(eq(compositeWorkflowSessionMembers.userId, userId));
    const memberSessionIds = Array.from(new Set(memberSessions.map((m) => m.sessionId)));
    const shared = memberSessionIds.length
      ? await db.select().from(compositeWorkflowSessions).where(inArray(compositeWorkflowSessions.id, memberSessionIds))
      : [];
    const sessionMap = new Map<number, typeof compositeWorkflowSessions.$inferSelect>();
    for (const session of [...owned, ...shared]) {
      sessionMap.set(session.id, session);
    }
    const allSessions = Array.from(sessionMap.values());
    const compositeIds = Array.from(new Set(allSessions.map((s) => s.compositeId)));
    const composites = compositeIds.length
      ? await db.select().from(compositeWorkflows).where(inArray(compositeWorkflows.id, compositeIds))
      : [];
    return allSessions.map((session) => ({
      ...session,
      composite: composites.find((c) => c.id === session.compositeId) || null,
    }));
  }

  async cloneCompositeForUser(sourceCompositeId: number, ownerId: string, name?: string, description?: string): Promise<CompositeWorkflow> {
    const source = await this.getCompositeWorkflowWithItems(sourceCompositeId);
    if (!source) {
      throw new Error("Composite workflow not found");
    }

    const [newComposite] = await db.insert(compositeWorkflows).values({
      name: name || source.name,
      description: description ?? source.description,
      ownerId,
    }).returning();

    for (let i = 0; i < source.steps.length; i++) {
      const step = source.steps[i];
      await this.cloneStepToComposite(newComposite.id, step.id, i, false);
    }

    await db.insert(compositeWorkflowCopies).values({
      sourceCompositeId,
      copiedCompositeId: newComposite.id,
      ownerId,
    });

    return newComposite;
  }

  async cloneStepToComposite(compositeId: number, originalStepId: number, orderIndex: number, cloneIntelDocs: boolean = true): Promise<CompositeWorkflowItem> {
    const originalStep = await this.getStepWithDetails(originalStepId);
    if (!originalStep) throw new Error("Template step not found");

    // Create cloned step
    const [clonedStep] = await db.insert(steps).values({
      workflowId: originalStep.workflowId ?? null,
      compositeId: compositeId,
      stepNumber: originalStep.stepNumber,
      name: originalStep.name,
      description: originalStep.description,
      objective: originalStep.objective,
      instructions: originalStep.instructions,
      status: orderIndex === 0 ? "active" : "locked",
      requiresApproval: originalStep.requiresApproval,
      isCompleted: false,
    }).returning();

    // Clone intel docs
    if (cloneIntelDocs && originalStep.intelDocs.length > 0) {
      for (const doc of originalStep.intelDocs) {
        await this.createIntelDoc({
          stepId: clonedStep.id,
          title: doc.title,
          content: doc.content,
          docType: doc.docType,
        });
      }
    }

    // Link to composite
    const [newItem] = await db.insert(compositeWorkflowItems).values({
      compositeId,
      stepId: clonedStep.id,
      orderIndex,
    }).returning();

    return newItem;
  }

  async addStepToComposite(item: InsertCompositeWorkflowItem): Promise<CompositeWorkflowItem> {
    const [newItem] = await db.insert(compositeWorkflowItems).values(item).returning();
    return newItem;
  }

  async removeStepFromComposite(id: number): Promise<boolean> {
    await db.delete(compositeWorkflowItems).where(eq(compositeWorkflowItems.id, id));
    return true;
  }

  async deleteCompositeWorkflow(id: number): Promise<boolean> {
    await db.delete(compositeWorkflows).where(eq(compositeWorkflows.id, id));
    return true;
  }
}

export const storage = new DatabaseStorage();
