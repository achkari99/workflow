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
  workflowId: integer("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
});

export const steps = pgTable("steps", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  objective: text("objective"),
  instructions: text("instructions"),
  status: text("status").notNull().default("locked"),
  isCompleted: boolean("is_completed").notNull().default(false),
  requiresApproval: boolean("requires_approval").notNull().default(false),
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
export type InsertWorkflowShare = z.infer<typeof insertWorkflowShareSchema>;
export type WorkflowShare = typeof workflowShares.$inferSelect;
export type InsertCompositeWorkflow = z.infer<typeof insertCompositeWorkflowSchema>;
export type CompositeWorkflow = typeof compositeWorkflows.$inferSelect;
export type InsertCompositeWorkflowItem = z.infer<typeof insertCompositeWorkflowItemSchema>;
export type CompositeWorkflowItem = typeof compositeWorkflowItems.$inferSelect;

export type WorkflowWithSteps = Workflow & { steps: Step[] };
export type StepWithDetails = Step & { approvals: Approval[]; intelDocs: IntelDoc[] };
export type CompositeWorkflowWithItems = CompositeWorkflow & { workflows: Workflow[] };
