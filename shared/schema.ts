import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export * from "./models/auth";

export const stepStatusEnum = ["locked", "active", "in_progress", "pending_approval", "completed"] as const;
export const approvalStatusEnum = ["pending", "approved", "rejected", "changes_requested"] as const;

import { users } from "./models/auth";

export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  totalSteps: integer("total_steps").notNull(),
  currentStep: integer("current_step").notNull().default(1),
  isActive: boolean("is_active").notNull().default(false),
  status: text("status").notNull().default("active"),
  priority: text("priority").notNull().default("high"),
  ownerId: varchar("owner_id").references(() => users.id),
  parentWorkflowId: integer("parent_workflow_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workflowShares = pgTable("workflow_shares", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  sharedWithUserId: varchar("shared_with_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permission: text("permission").notNull().default("view"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const compositeWorkflows = pgTable("composite_workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const compositeWorkflowItems = pgTable("composite_workflow_items", {
  id: serial("id").primaryKey(),
  compositeId: integer("composite_id").notNull().references(() => compositeWorkflows.id, { onDelete: "cascade" }),
  stepId: integer("step_id").notNull().references(() => steps.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
});

export const compositeWorkflowSessions = pgTable("composite_workflow_sessions", {
  id: serial("id").primaryKey(),
  compositeId: integer("composite_id").notNull().references(() => compositeWorkflows.id, { onDelete: "cascade" }),
  ownerId: varchar("owner_id").references(() => users.id),
  name: text("name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const compositeWorkflowSessionMembers = pgTable("composite_workflow_session_members", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => compositeWorkflowSessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  canEditSteps: boolean("can_edit_steps").notNull().default(false),
  canManageAssignments: boolean("can_manage_assignments").notNull().default(false),
  canManageSharing: boolean("can_manage_sharing").notNull().default(false),
  canEditIntel: boolean("can_edit_intel").notNull().default(false),
  canEditProof: boolean("can_edit_proof").notNull().default(false),
  canChat: boolean("can_chat").notNull().default(false),
  allowLaneDelegation: boolean("allow_lane_delegation").notNull().default(false),
  laneColor: text("lane_color").notNull().default("#84cc16"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const compositeWorkflowSessionSteps = pgTable("composite_workflow_session_steps", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => compositeWorkflowSessions.id, { onDelete: "cascade" }),
  stepId: integer("step_id").notNull().references(() => steps.id, { onDelete: "cascade" }),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  completedByUserId: varchar("completed_by_user_id").references(() => users.id),
  proofRequired: boolean("proof_required").notNull().default(false),
  proofContent: text("proof_content"),
  proofFilePath: text("proof_file_path"),
  proofFileName: text("proof_file_name"),
  proofMimeType: text("proof_mime_type"),
  proofFileSize: integer("proof_file_size"),
  proofSubmittedAt: timestamp("proof_submitted_at"),
  proofSubmittedByUserId: varchar("proof_submitted_by_user_id").references(() => users.id),
});

export const compositeWorkflowSessionAssignments = pgTable("composite_workflow_session_assignments", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => compositeWorkflowSessions.id, { onDelete: "cascade" }),
  stepId: integer("step_id").notNull().references(() => steps.id, { onDelete: "cascade" }),
  assigneeUserId: varchar("assignee_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  allowDelegation: boolean("allow_delegation").notNull().default(false),
  allowDelegationToEveryone: boolean("allow_delegation_to_everyone").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const compositeWorkflowSessionAssignmentDelegates = pgTable("composite_workflow_session_assignment_delegates", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => compositeWorkflowSessionAssignments.id, { onDelete: "cascade" }),
  delegateUserId: varchar("delegate_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const compositeWorkflowSessionLaneDelegates = pgTable("composite_workflow_session_lane_delegates", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => compositeWorkflowSessions.id, { onDelete: "cascade" }),
  ownerUserId: varchar("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  delegateUserId: varchar("delegate_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const compositeWorkflowSessionIntelDocs = pgTable("composite_workflow_session_intel_docs", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => compositeWorkflowSessions.id, { onDelete: "cascade" }),
  stepId: integer("step_id").notNull().references(() => steps.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  docType: text("doc_type").notNull().default("note"),
  filePath: text("file_path"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const compositeWorkflowSessionMessages = pgTable("composite_workflow_session_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => compositeWorkflowSessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const compositeWorkflowSessionMessageReads = pgTable("composite_workflow_session_message_reads", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => compositeWorkflowSessionMessages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at").notNull().defaultNow(),
});

export const compositeWorkflowCopies = pgTable("composite_workflow_copies", {
  id: serial("id").primaryKey(),
  sourceCompositeId: integer("source_composite_id").notNull().references(() => compositeWorkflows.id, { onDelete: "cascade" }),
  copiedCompositeId: integer("copied_composite_id").notNull().references(() => compositeWorkflows.id, { onDelete: "cascade" }),
  ownerId: varchar("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const steps = pgTable("steps", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").references(() => workflows.id, { onDelete: "cascade" }),
  compositeId: integer("composite_id").references(() => compositeWorkflows.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("locked"),
  isCompleted: boolean("is_completed").notNull().default(false),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  proofRequired: boolean("proof_required").notNull().default(false),
  proofContent: text("proof_content"),
  proofFilePath: text("proof_file_path"),
  proofFileName: text("proof_file_name"),
  proofMimeType: text("proof_mime_type"),
  proofFileSize: integer("proof_file_size"),
  proofSubmittedAt: timestamp("proof_submitted_at"),
  proofSubmittedByUserId: varchar("proof_submitted_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const approvals = pgTable("approvals", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id").notNull().references(() => steps.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  comments: text("comments"),
});

export const intelDocs = pgTable("intel_docs", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id").notNull().references(() => steps.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  docType: text("doc_type").notNull().default("note"),
  filePath: text("file_path"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  stepId: integer("step_id"),
  action: text("action").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workflowRelations = relations(workflows, ({ many }) => ({
  steps: many(steps),
  activities: many(activities),
}));

export const stepRelations = relations(steps, ({ one, many }) => ({
  workflow: one(workflows, {
    fields: [steps.workflowId],
    references: [workflows.id],
  }),
  approvals: many(approvals),
  intelDocs: many(intelDocs),
}));

export const approvalRelations = relations(approvals, ({ one }) => ({
  step: one(steps, {
    fields: [approvals.stepId],
    references: [steps.id],
  }),
}));

export const intelDocRelations = relations(intelDocs, ({ one }) => ({
  step: one(steps, {
    fields: [intelDocs.stepId],
    references: [steps.id],
  }),
}));

export const activityRelations = relations(activities, ({ one }) => ({
  workflow: one(workflows, {
    fields: [activities.workflowId],
    references: [workflows.id],
  }),
}));

export const noteRelations = relations(notes, ({ one }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
}));

export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStepSchema = createInsertSchema(steps).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertApprovalSchema = createInsertSchema(approvals).omit({
  id: true,
  requestedAt: true,
  respondedAt: true,
});

export const insertIntelDocSchema = createInsertSchema(intelDocs).omit({
  id: true,
  createdAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowShareSchema = createInsertSchema(workflowShares).omit({
  id: true,
  createdAt: true,
});

export const insertCompositeWorkflowSchema = createInsertSchema(compositeWorkflows).omit({
  id: true,
  createdAt: true,
});

export const insertCompositeWorkflowItemSchema = createInsertSchema(compositeWorkflowItems).omit({
  id: true,
});

export const insertCompositeWorkflowSessionSchema = createInsertSchema(compositeWorkflowSessions).omit({
  id: true,
  createdAt: true,
});

export const insertCompositeWorkflowSessionMemberSchema = createInsertSchema(compositeWorkflowSessionMembers).omit({
  id: true,
  createdAt: true,
});

export const insertCompositeWorkflowSessionStepSchema = createInsertSchema(compositeWorkflowSessionSteps).omit({
  id: true,
  completedAt: true,
});

export const insertCompositeWorkflowSessionAssignmentSchema = createInsertSchema(compositeWorkflowSessionAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertCompositeWorkflowSessionAssignmentDelegateSchema = createInsertSchema(compositeWorkflowSessionAssignmentDelegates).omit({
  id: true,
  createdAt: true,
});

export const insertCompositeWorkflowSessionLaneDelegateSchema = createInsertSchema(compositeWorkflowSessionLaneDelegates).omit({
  id: true,
  createdAt: true,
});

export const insertCompositeWorkflowSessionIntelDocSchema = createInsertSchema(compositeWorkflowSessionIntelDocs).omit({
  id: true,
  createdAt: true,
});

export const insertCompositeWorkflowSessionMessageSchema = createInsertSchema(compositeWorkflowSessionMessages).omit({
  id: true,
  createdAt: true,
});

export const insertCompositeWorkflowSessionMessageReadSchema = createInsertSchema(compositeWorkflowSessionMessageReads).omit({
  id: true,
  readAt: true,
});

export const insertCompositeWorkflowCopySchema = createInsertSchema(compositeWorkflowCopies).omit({
  id: true,
  createdAt: true,
});

export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;
export type InsertStep = z.infer<typeof insertStepSchema>;
export type Step = typeof steps.$inferSelect;
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type Approval = typeof approvals.$inferSelect;
export type InsertIntelDoc = z.infer<typeof insertIntelDocSchema>;
export type IntelDoc = typeof intelDocs.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;
export type InsertWorkflowShare = z.infer<typeof insertWorkflowShareSchema>;
export type WorkflowShare = typeof workflowShares.$inferSelect;
export type InsertCompositeWorkflow = z.infer<typeof insertCompositeWorkflowSchema>;
export type CompositeWorkflow = typeof compositeWorkflows.$inferSelect;
export type InsertCompositeWorkflowItem = z.infer<typeof insertCompositeWorkflowItemSchema>;
export type CompositeWorkflowItem = typeof compositeWorkflowItems.$inferSelect;
export type InsertCompositeWorkflowSession = z.infer<typeof insertCompositeWorkflowSessionSchema>;
export type CompositeWorkflowSession = typeof compositeWorkflowSessions.$inferSelect;
export type InsertCompositeWorkflowSessionMember = z.infer<typeof insertCompositeWorkflowSessionMemberSchema>;
export type CompositeWorkflowSessionMember = typeof compositeWorkflowSessionMembers.$inferSelect;
export type InsertCompositeWorkflowSessionStep = z.infer<typeof insertCompositeWorkflowSessionStepSchema>;
export type CompositeWorkflowSessionStep = typeof compositeWorkflowSessionSteps.$inferSelect;
export type InsertCompositeWorkflowSessionAssignment = z.infer<typeof insertCompositeWorkflowSessionAssignmentSchema>;
export type CompositeWorkflowSessionAssignment = typeof compositeWorkflowSessionAssignments.$inferSelect;
export type InsertCompositeWorkflowSessionAssignmentDelegate = z.infer<typeof insertCompositeWorkflowSessionAssignmentDelegateSchema>;
export type CompositeWorkflowSessionAssignmentDelegate = typeof compositeWorkflowSessionAssignmentDelegates.$inferSelect;
export type InsertCompositeWorkflowSessionLaneDelegate = z.infer<typeof insertCompositeWorkflowSessionLaneDelegateSchema>;
export type CompositeWorkflowSessionLaneDelegate = typeof compositeWorkflowSessionLaneDelegates.$inferSelect;
export type InsertCompositeWorkflowSessionIntelDoc = z.infer<typeof insertCompositeWorkflowSessionIntelDocSchema>;
export type CompositeWorkflowSessionIntelDoc = typeof compositeWorkflowSessionIntelDocs.$inferSelect;
export type InsertCompositeWorkflowSessionMessage = z.infer<typeof insertCompositeWorkflowSessionMessageSchema>;
export type CompositeWorkflowSessionMessage = typeof compositeWorkflowSessionMessages.$inferSelect;
export type InsertCompositeWorkflowSessionMessageRead = z.infer<typeof insertCompositeWorkflowSessionMessageReadSchema>;
export type CompositeWorkflowSessionMessageRead = typeof compositeWorkflowSessionMessageReads.$inferSelect;
export type InsertCompositeWorkflowCopy = z.infer<typeof insertCompositeWorkflowCopySchema>;
export type CompositeWorkflowCopy = typeof compositeWorkflowCopies.$inferSelect;

export type WorkflowWithSteps = Workflow & { steps: Step[] };
export type StepWithDetails = Step & { approvals: Approval[]; intelDocs: IntelDoc[] };
export type CompositeWorkflowWithItems = CompositeWorkflow & { steps: (Step & { workflowName: string })[] };
