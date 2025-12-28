import { 
  users, 
  workflows, 
  steps,
  type User, 
  type InsertUser,
  type Workflow,
  type InsertWorkflow,
  type Step,
  type InsertStep
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: number): Promise<Workflow | undefined>;
  getActiveWorkflow(): Promise<Workflow | undefined>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined>;
  setActiveWorkflow(id: number): Promise<void>;
  advanceWorkflowStep(id: number): Promise<Workflow | undefined>;
  
  getStepsByWorkflow(workflowId: number): Promise<Step[]>;
  createStep(step: InsertStep): Promise<Step>;
  updateStep(id: number, step: Partial<InsertStep>): Promise<Step | undefined>;
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
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getWorkflows(): Promise<Workflow[]> {
    return await db.select().from(workflows).orderBy(desc(workflows.createdAt));
  }

  async getWorkflow(id: number): Promise<Workflow | undefined> {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    return workflow || undefined;
  }

  async getActiveWorkflow(): Promise<Workflow | undefined> {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.isActive, true));
    return workflow || undefined;
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const [newWorkflow] = await db
      .insert(workflows)
      .values(workflow)
      .returning();
    return newWorkflow;
  }

  async updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined> {
    const [updated] = await db
      .update(workflows)
      .set(workflow)
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
    
    const nextStep = Math.min(workflow.currentStep + 1, workflow.totalSteps);
    const [updated] = await db
      .update(workflows)
      .set({ currentStep: nextStep })
      .where(eq(workflows.id, id))
      .returning();
    return updated || undefined;
  }

  async getStepsByWorkflow(workflowId: number): Promise<Step[]> {
    return await db.select().from(steps).where(eq(steps.workflowId, workflowId));
  }

  async createStep(step: InsertStep): Promise<Step> {
    const [newStep] = await db
      .insert(steps)
      .values(step)
      .returning();
    return newStep;
  }

  async updateStep(id: number, step: Partial<InsertStep>): Promise<Step | undefined> {
    const [updated] = await db
      .update(steps)
      .set(step)
      .where(eq(steps.id, id))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
