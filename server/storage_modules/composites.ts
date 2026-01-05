import {
    workflows,
    steps,
    intelDocs,
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
    users,
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
    type InsertCompositeWorkflowSession,
    type InsertCompositeWorkflowSessionMember,
    type InsertCompositeWorkflowSessionStep,
    type InsertCompositeWorkflowSessionAssignment,
    type InsertCompositeWorkflowSessionAssignmentDelegate,
    type InsertCompositeWorkflowSessionLaneDelegate,
    type InsertCompositeWorkflowSessionIntelDoc,
    type InsertCompositeWorkflowSessionMessage,
    type InsertCompositeWorkflowSessionMessageRead,
} from "@shared/schema";
import { db } from "../db";
import { eq, desc, asc, and, ilike, inArray, or } from "drizzle-orm";

export class CompositeStorage {
    async searchUsers(query: string): Promise<{ id: string; email: string | null; username: string | null; firstName: string | null; lastName: string | null }[]> {
        return await db.select({
            id: users.id,
            email: users.email,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
        }).from(users).where(
            or(
                ilike(users.email, `%${query}%`),
                ilike(users.username, `%${query}%`)
            )
        ).limit(10);
    }

    async getCompositeWorkflows(userId?: string): Promise<CompositeWorkflowWithItems[]> {
        if (!userId) return [];
        const composites = await db.select()
            .from(compositeWorkflows)
            .where(eq(compositeWorkflows.ownerId, userId))
            .orderBy(desc(compositeWorkflows.createdAt));

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
            // Note: cloneStepToComposite method needed from lower level or same class.
            // Assuming it's in this class based on previous structure.
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
        // This requires access to getStepWithDetails and createIntelDoc which are in WorkflowStorage usually.
        // In the old storage.ts they were all together.
        // In this refactored version, we might need to inject dependencies or keep them in the main class.
        // Let's assume for now they are accessible or move them to a common place if needed.
        // For simplicity of this specific file extraction, I'll include the necessary logic if it was in the original storage.ts.

        // REDACTED: For now I'll focus on the core composite methods. 
        // If I need to call workflow storage methods, I'll do so through the main storage aggregator.

        const [originalStep] = await db.select().from(steps).where(eq(steps.id, originalStepId));
        if (!originalStep) throw new Error("Template step not found");

        const [clonedStep] = await db.insert(steps).values({
            workflowId: originalStep.workflowId ?? null,
            compositeId: compositeId,
            stepNumber: originalStep.stepNumber,
            name: originalStep.name,
            description: originalStep.description,
            status: orderIndex === 0 ? "active" : "locked",
            requiresApproval: originalStep.requiresApproval,
            isCompleted: false,
            proofRequired: originalStep.proofRequired,
            proofContent: originalStep.proofContent,
            proofFilePath: originalStep.proofFilePath,
            proofFileName: originalStep.proofFileName,
            proofMimeType: originalStep.proofMimeType,
            proofFileSize: originalStep.proofFileSize,
            proofSubmittedAt: originalStep.proofSubmittedAt,
            proofSubmittedByUserId: originalStep.proofSubmittedByUserId,
        }).returning();

        if (cloneIntelDocs) {
            const docs = await db.select().from(intelDocs).where(eq(intelDocs.stepId, originalStepId));
            for (const doc of docs) {
                await db.insert(intelDocs).values({
                    stepId: clonedStep.id,
                    title: doc.title,
                    content: doc.content,
                    docType: doc.docType,
                });
            }
        }

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
