import { 
  workflows, 
  steps,
  approvals,
  intelDocs,
  activities,
  workflowShares,
  compositeWorkflows,
  compositeWorkflowItems,
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
  users
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, or, and, ilike } from "drizzle-orm";

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
  
  getCompositeWorkflows(userId?: string): Promise<CompositeWorkflow[]>;
  getCompositeWorkflowWithItems(id: number): Promise<CompositeWorkflowWithItems | undefined>;
  createCompositeWorkflow(composite: InsertCompositeWorkflow): Promise<CompositeWorkflow>;
  addWorkflowToComposite(item: InsertCompositeWorkflowItem): Promise<CompositeWorkflowItem>;
  removeWorkflowFromComposite(id: number): Promise<boolean>;
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
      .where(eq(steps.workflowId, id))
      .orderBy(asc(steps.stepNumber));
    
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

  async advanceWorkflowStep(id: number): Promise<Workflow | undefined> {
    const workflow = await this.getWorkflow(id);
    if (!workflow) return undefined;
    
    const currentSteps = await this.getStepsByWorkflow(id);
    const currentStep = currentSteps.find(s => s.stepNumber === workflow.currentStep);
    if (currentStep) {
      await this.completeStep(currentStep.id);
    }
    
    const nextStep = Math.min(workflow.currentStep + 1, workflow.totalSteps);
    const [updated] = await db
      .update(workflows)
      .set({ currentStep: nextStep, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    
    const nextStepRecord = currentSteps.find(s => s.stepNumber === nextStep);
    if (nextStepRecord && nextStep <= workflow.totalSteps) {
      await this.updateStep(nextStepRecord.id, { status: "active" });
    }
    
    await this.createActivity({
      workflowId: id,
      stepId: currentStep?.id,
      action: "step_advanced",
      description: `Advanced to step ${nextStep}`,
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
      .where(eq(steps.workflowId, workflowId))
      .orderBy(asc(steps.stepNumber));
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

  async getCompositeWorkflows(userId?: string): Promise<CompositeWorkflow[]> {
    if (userId) {
      return await db.select().from(compositeWorkflows).where(eq(compositeWorkflows.ownerId, userId)).orderBy(desc(compositeWorkflows.createdAt));
    }
    return await db.select().from(compositeWorkflows).orderBy(desc(compositeWorkflows.createdAt));
  }

  async getCompositeWorkflowWithItems(id: number): Promise<CompositeWorkflowWithItems | undefined> {
    const [composite] = await db.select().from(compositeWorkflows).where(eq(compositeWorkflows.id, id));
    if (!composite) return undefined;

    const items = await db.select().from(compositeWorkflowItems).where(eq(compositeWorkflowItems.compositeId, id)).orderBy(asc(compositeWorkflowItems.orderIndex));
    const itemWorkflows = await Promise.all(items.map(i => this.getWorkflow(i.workflowId)));
    
    return { ...composite, workflows: itemWorkflows.filter((w): w is Workflow => w !== undefined) };
  }

  async createCompositeWorkflow(composite: InsertCompositeWorkflow): Promise<CompositeWorkflow> {
    const [newComposite] = await db.insert(compositeWorkflows).values(composite).returning();
    return newComposite;
  }

  async addWorkflowToComposite(item: InsertCompositeWorkflowItem): Promise<CompositeWorkflowItem> {
    const [newItem] = await db.insert(compositeWorkflowItems).values(item).returning();
    return newItem;
  }

  async removeWorkflowFromComposite(id: number): Promise<boolean> {
    await db.delete(compositeWorkflowItems).where(eq(compositeWorkflowItems.id, id));
    return true;
  }

  async deleteCompositeWorkflow(id: number): Promise<boolean> {
    await db.delete(compositeWorkflows).where(eq(compositeWorkflows.id, id));
    return true;
  }
}

export const storage = new DatabaseStorage();
