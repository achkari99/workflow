import { WorkflowStorage } from "./storage_modules/workflows";
import { CompositeStorage } from "./storage_modules/composites";
import {
  type WorkflowWithSteps,
  type Workflow,
  type InsertWorkflow,
  type Step,
  type StepWithDetails,
  type InsertStep,
  type Approval,
  type InsertApproval,
  type IntelDoc,
  type InsertIntelDoc,
  type Activity,
  type InsertActivity,
  type WorkflowShare,
  type InsertWorkflowShare,
  type Note,
  type InsertNote,
  type AudioTrack,
  type InsertAudioTrack,
  type CompositeWorkflowWithItems,
  type CompositeWorkflow,
  type InsertCompositeWorkflow,
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
  type CompositeWorkflowItem,
  type InsertCompositeWorkflowItem
} from "@shared/schema";

export interface IStorage {
  // Workflows
  getWorkflows(userId?: string): Promise<WorkflowWithSteps[]>;
  getWorkflow(id: number): Promise<Workflow | undefined>;
  getWorkflowWithSteps(id: number): Promise<WorkflowWithSteps | undefined>;
  getActiveWorkflow(userId?: string): Promise<WorkflowWithSteps | undefined>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined>;
  setActiveWorkflow(id: number, userId?: string): Promise<void>;
  advanceWorkflowStep(id: number, stepId?: number): Promise<Workflow | undefined>;
  deleteWorkflow(id: number): Promise<boolean>;

  // Steps
  getStepsByWorkflow(workflowId: number): Promise<Step[]>;
  getStep(id: number): Promise<Step | undefined>;
  getStepWithDetails(id: number): Promise<StepWithDetails | undefined>;
  createStep(step: InsertStep): Promise<Step>;
  updateStep(id: number, step: Partial<InsertStep>): Promise<Step | undefined>;
  completeStep(id: number): Promise<Step | undefined>;

  // Approvals
  getApprovalsByStep(stepId: number): Promise<Approval[]>;
  createApproval(approval: InsertApproval): Promise<Approval>;
  updateApproval(id: number, approval: Partial<InsertApproval>): Promise<Approval | undefined>;

  // Intel
  getIntelDocsByStep(stepId: number): Promise<IntelDoc[]>;
  createIntelDoc(doc: InsertIntelDoc): Promise<IntelDoc>;
  deleteIntelDoc(id: number): Promise<boolean>;

  // Activities
  getActivitiesByWorkflow(workflowId: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // Notes
  getNotesByUser(userId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: number, note: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(id: number): Promise<boolean>;

  // Audio tracks
  getAudioTrack(id: number): Promise<AudioTrack | undefined>;
  getAudioTracksByUser(userId: string): Promise<AudioTrack[]>;
  createAudioTrack(track: InsertAudioTrack): Promise<AudioTrack>;
  updateAudioTrack(id: number, track: Partial<InsertAudioTrack>): Promise<AudioTrack | undefined>;
  deleteAudioTrack(id: number): Promise<boolean>;

  // Sharing
  getWorkflowShares(workflowId: number): Promise<WorkflowShare[]>;
  getShare(id: number): Promise<WorkflowShare | undefined>;
  shareWorkflow(share: InsertWorkflowShare): Promise<WorkflowShare>;
  removeShare(id: number): Promise<boolean>;
  getSharedWorkflows(userId: string): Promise<WorkflowWithSteps[]>;

  // Users
  searchUsers(query: string): Promise<{ id: string; email: string | null; username: string | null; firstName: string | null; lastName: string | null }[]>;

  // Composites
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

class StorageAggregator extends WorkflowStorage implements IStorage {
  private compositeStorage = new CompositeStorage();

  // Composite Methods (Delegated)
  async searchUsers(query: string) { return this.compositeStorage.searchUsers(query); }
  async getCompositeWorkflows(userId?: string) { return this.compositeStorage.getCompositeWorkflows(userId); }
  async getCompositeWorkflowWithItems(id: number) { return this.compositeStorage.getCompositeWorkflowWithItems(id); }
  async getCompositeWorkflowSession(id: number) { return this.compositeStorage.getCompositeWorkflowSession(id); }
  async createCompositeWorkflowSession(session: InsertCompositeWorkflowSession) { return this.compositeStorage.createCompositeWorkflowSession(session); }
  async deleteCompositeWorkflowSession(id: number) { return this.compositeStorage.deleteCompositeWorkflowSession(id); }
  async addCompositeWorkflowSessionMember(member: InsertCompositeWorkflowSessionMember) { return this.compositeStorage.addCompositeWorkflowSessionMember(member); }
  async updateCompositeWorkflowSessionMember(id: number, data: Partial<InsertCompositeWorkflowSessionMember>) { return this.compositeStorage.updateCompositeWorkflowSessionMember(id, data); }
  async getCompositeWorkflowSessionMembers(sessionId: number) { return this.compositeStorage.getCompositeWorkflowSessionMembers(sessionId); }
  async createCompositeWorkflowSessionStep(step: InsertCompositeWorkflowSessionStep) { return this.compositeStorage.createCompositeWorkflowSessionStep(step); }
  async assignCompositeWorkflowSessionStep(assignment: InsertCompositeWorkflowSessionAssignment) { return this.compositeStorage.assignCompositeWorkflowSessionStep(assignment); }
  async removeCompositeWorkflowSessionAssignment(id: number) { return this.compositeStorage.removeCompositeWorkflowSessionAssignment(id); }
  async getCompositeWorkflowSessionAssignments(sessionId: number) { return this.compositeStorage.getCompositeWorkflowSessionAssignments(sessionId); }
  async updateCompositeWorkflowSessionAssignment(id: number, data: Partial<InsertCompositeWorkflowSessionAssignment>) { return this.compositeStorage.updateCompositeWorkflowSessionAssignment(id, data); }
  async getCompositeWorkflowSessionAssignmentDelegates(sessionId: number) { return this.compositeStorage.getCompositeWorkflowSessionAssignmentDelegates(sessionId); }
  async addCompositeWorkflowSessionAssignmentDelegate(delegate: InsertCompositeWorkflowSessionAssignmentDelegate) { return this.compositeStorage.addCompositeWorkflowSessionAssignmentDelegate(delegate); }
  async removeCompositeWorkflowSessionAssignmentDelegate(id: number) { return this.compositeStorage.removeCompositeWorkflowSessionAssignmentDelegate(id); }
  async getCompositeWorkflowSessionLaneDelegates(sessionId: number) { return this.compositeStorage.getCompositeWorkflowSessionLaneDelegates(sessionId); }
  async addCompositeWorkflowSessionLaneDelegate(delegate: InsertCompositeWorkflowSessionLaneDelegate) { return this.compositeStorage.addCompositeWorkflowSessionLaneDelegate(delegate); }
  async removeCompositeWorkflowSessionLaneDelegate(id: number) { return this.compositeStorage.removeCompositeWorkflowSessionLaneDelegate(id); }
  async updateCompositeWorkflowSessionStep(id: number, data: Partial<InsertCompositeWorkflowSessionStep>) { return this.compositeStorage.updateCompositeWorkflowSessionStep(id, data); }
  async getCompositeWorkflowSessionSteps(sessionId: number) { return this.compositeStorage.getCompositeWorkflowSessionSteps(sessionId); }
  async addCompositeWorkflowSessionIntelDoc(doc: InsertCompositeWorkflowSessionIntelDoc) { return this.compositeStorage.addCompositeWorkflowSessionIntelDoc(doc); }
  async getCompositeWorkflowSessionIntelDocs(sessionId: number) { return this.compositeStorage.getCompositeWorkflowSessionIntelDocs(sessionId); }
  async getCompositeWorkflowSessionIntelDoc(id: number) { return this.compositeStorage.getCompositeWorkflowSessionIntelDoc(id); }
  async removeCompositeWorkflowSessionIntelDoc(id: number) { return this.compositeStorage.removeCompositeWorkflowSessionIntelDoc(id); }
  async getCompositeWorkflowSessionMessages(sessionId: number) { return this.compositeStorage.getCompositeWorkflowSessionMessages(sessionId); }
  async addCompositeWorkflowSessionMessage(message: InsertCompositeWorkflowSessionMessage) { return this.compositeStorage.addCompositeWorkflowSessionMessage(message); }
  async removeCompositeWorkflowSessionMessage(id: number) { return this.compositeStorage.removeCompositeWorkflowSessionMessage(id); }
  async addCompositeWorkflowSessionMessageRead(read: InsertCompositeWorkflowSessionMessageRead) { return this.compositeStorage.addCompositeWorkflowSessionMessageRead(read); }
  async removeCompositeWorkflowSessionMember(id: number) { return this.compositeStorage.removeCompositeWorkflowSessionMember(id); }
  async getCompositeWorkflowSessionsForUser(userId: string) { return this.compositeStorage.getCompositeWorkflowSessionsForUser(userId); }
  async createCompositeWorkflow(composite: InsertCompositeWorkflow) { return this.compositeStorage.createCompositeWorkflow(composite); }
  async cloneCompositeForUser(sourceCompositeId: number, ownerId: string, name?: string, description?: string) { return this.compositeStorage.cloneCompositeForUser(sourceCompositeId, ownerId, name, description); }
  async cloneStepToComposite(compositeId: number, originalStepId: number, orderIndex: number, cloneIntelDocs?: boolean) { return this.compositeStorage.cloneStepToComposite(compositeId, originalStepId, orderIndex, cloneIntelDocs); }
  async addStepToComposite(item: InsertCompositeWorkflowItem) { return this.compositeStorage.addStepToComposite(item); }
  async removeStepFromComposite(id: number) { return this.compositeStorage.removeStepFromComposite(id); }
  async deleteCompositeWorkflow(id: number) { return this.compositeStorage.deleteCompositeWorkflow(id); }
}

export const storage = new StorageAggregator();
