import {
    workflows,
    steps,
    approvals,
    intelDocs,
    activities,
    workflowShares,
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
} from "@shared/schema";
import { db } from "../db";
import { eq, desc, asc, and, isNull, inArray } from "drizzle-orm";

export class WorkflowStorage {
    async getWorkflows(userId?: string): Promise<WorkflowWithSteps[]> {
        let owned: Workflow[];
        if (userId) {
            owned = await db.select().from(workflows).where(eq(workflows.ownerId, userId)).orderBy(desc(workflows.createdAt));
            const sharedIds = await db.select({ workflowId: workflowShares.workflowId }).from(workflowShares).where(eq(workflowShares.sharedWithUserId, userId));
            if (sharedIds.length > 0) {
                const sharedWorkflows = await Promise.all(sharedIds.map(s => this.getWorkflow(s.workflowId)));
                const allFlows = [...owned, ...sharedWorkflows.filter((w): w is Workflow => w !== undefined)];
                return await Promise.all(allFlows.map(async (w) => (await this.getWorkflowWithSteps(w.id))!)) as WorkflowWithSteps[];
            }
        } else {
            owned = await db.select().from(workflows).orderBy(desc(workflows.createdAt));
        }
        return await Promise.all(owned.map(async (w) => (await this.getWorkflowWithSteps(w.id))!)) as WorkflowWithSteps[];
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

    async getActiveWorkflow(userId?: string): Promise<WorkflowWithSteps | undefined> {
        let workflow: Workflow | undefined;
        if (userId) {
            const [res] = await db.select().from(workflows).where(and(eq(workflows.isActive, true), eq(workflows.ownerId, userId)));
            workflow = res;
        } else {
            const [res] = await db.select().from(workflows).where(eq(workflows.isActive, true));
            workflow = res;
        }

        if (!workflow) return undefined;
        return this.getWorkflowWithSteps(workflow.id);
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

        const currentSteps = await this.getStepsByWorkflow(id);

        if (workflow.currentStep >= workflow.totalSteps) {
            return workflow;
        }

        let currentIndex = workflow.currentStep - 1;
        if (stepId) {
            const foundIndex = currentSteps.findIndex(s => s.id === stepId);
            if (foundIndex !== -1) currentIndex = foundIndex;
        }

        const currentStep = currentSteps[currentIndex];

        if (currentStep && !currentStep.isCompleted) {
            await this.completeStep(currentStep.id);
        }

        const nextStepNumber = Math.min(currentIndex + 2, workflow.totalSteps);
        const nextStepIndex = nextStepNumber - 1;

        const [updated] = await db
            .update(workflows)
            .set({
                currentStep: nextStepNumber,
                updatedAt: new Date()
            })
            .where(eq(workflows.id, id))
            .returning();

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

    async getSharedWorkflows(userId: string): Promise<WorkflowWithSteps[]> {
        const shares = await db.select().from(workflowShares).where(eq(workflowShares.sharedWithUserId, userId));
        const workflowIds = shares.map(s => s.workflowId);
        if (workflowIds.length === 0) return [];

        const flows = await db.select().from(workflows).where(inArray(workflows.id, workflowIds));
        return await Promise.all(flows.map(async (w) => (await this.getWorkflowWithSteps(w.id))!)) as WorkflowWithSteps[];
    }
}
