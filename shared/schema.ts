import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const stepStatusEnum = ["locked", "active", "in_progress", "pending_approval", "completed"] as const;
export const approvalStatusEnum = ["pending", "approved", "rejected", "changes_requested"] as const;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  totalSteps: integer("total_steps").notNull(),
  currentStep: integer("current_step").notNull().default(1),
  isActive: boolean("is_active").notNull().default(false),
  status: text("status").notNull().default("active"),
  priority: text("priority").notNull().default("high"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
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

export type WorkflowWithSteps = Workflow & { steps: Step[] };
export type StepWithDetails = Step & { approvals: Approval[]; intelDocs: IntelDoc[] };
