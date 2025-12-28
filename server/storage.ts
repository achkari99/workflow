import { 
  users, 
  workflows, 
  steps,
  approvals,
  intelDocs,
  activities,
  type User, 
  type InsertUser,
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
  type StepWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: number): Promise<Workflow | undefined>;
  getWorkflowWithSteps(id: number): Promise<WorkflowWithSteps | undefined>;
  getActiveWorkflow(): Promise<Workflow | undefined>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined>;
  setActiveWorkflow(id: number): Promise<void>;
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getWorkflows(): Promise<Workflow[]> {
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

  async getActiveWorkflow(): Promise<Workflow | undefined> {
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

  async setActiveWorkflow(id: number): Promise<void> {
    await db.update(workflows).set({ isActive: false });
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
    const result = await db.delete(workflows).where(eq(workflows.id, id));
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
}

export const storage = new DatabaseStorage();
