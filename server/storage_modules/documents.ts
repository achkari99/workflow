import {
  documentFolders,
  documentItems,
  documentProjects,
  type DocumentFolder,
  type DocumentItem,
  type DocumentProject,
  type InsertDocumentFolder,
  type InsertDocumentItem,
  type InsertDocumentProject,
} from "@shared/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";

export class DocumentsStorage {
  async getDocumentProjectsByUser(userId: string): Promise<DocumentProject[]> {
    return db
      .select()
      .from(documentProjects)
      .where(eq(documentProjects.userId, userId))
      .orderBy(desc(documentProjects.updatedAt));
  }

  async getDocumentProject(id: number): Promise<DocumentProject | undefined> {
    const [project] = await db
      .select()
      .from(documentProjects)
      .where(eq(documentProjects.id, id));
    return project || undefined;
  }

  async createDocumentProject(project: InsertDocumentProject): Promise<DocumentProject> {
    const [created] = await db.insert(documentProjects).values(project).returning();
    return created;
  }

  async updateDocumentProject(
    id: number,
    project: Partial<InsertDocumentProject>,
  ): Promise<DocumentProject | undefined> {
    const [updated] = await db
      .update(documentProjects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(documentProjects.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDocumentProject(id: number): Promise<boolean> {
    await db.delete(documentProjects).where(eq(documentProjects.id, id));
    return true;
  }

  async getDocumentFoldersByProject(projectId: number): Promise<DocumentFolder[]> {
    return db
      .select()
      .from(documentFolders)
      .where(eq(documentFolders.projectId, projectId))
      .orderBy(documentFolders.name);
  }

  async getDocumentFolder(id: number): Promise<DocumentFolder | undefined> {
    const [folder] = await db
      .select()
      .from(documentFolders)
      .where(eq(documentFolders.id, id));
    return folder || undefined;
  }

  async createDocumentFolder(folder: InsertDocumentFolder): Promise<DocumentFolder> {
    const [created] = await db.insert(documentFolders).values(folder).returning();
    return created;
  }

  async deleteDocumentFolder(id: number): Promise<boolean> {
    await db.delete(documentFolders).where(eq(documentFolders.id, id));
    return true;
  }

  async getDocumentItems(
    projectId: number,
    folderId: number | null,
  ): Promise<DocumentItem[]> {
    const folderCondition =
      folderId === null
        ? isNull(documentItems.folderId)
        : eq(documentItems.folderId, folderId);

    return db
      .select()
      .from(documentItems)
      .where(and(eq(documentItems.projectId, projectId), folderCondition))
      .orderBy(desc(documentItems.updatedAt));
  }

  async getDocumentItem(id: number): Promise<DocumentItem | undefined> {
    const [item] = await db
      .select()
      .from(documentItems)
      .where(eq(documentItems.id, id));
    return item || undefined;
  }

  async getDocumentFileItemsByProject(projectId: number): Promise<DocumentItem[]> {
    return db
      .select()
      .from(documentItems)
      .where(
        and(
          eq(documentItems.projectId, projectId),
          eq(documentItems.itemType, "file"),
        ),
      );
  }

  async getDocumentFileItemsByFolder(folderId: number): Promise<DocumentItem[]> {
    return db
      .select()
      .from(documentItems)
      .where(
        and(
          eq(documentItems.folderId, folderId),
          eq(documentItems.itemType, "file"),
        ),
      );
  }

  async createDocumentItem(item: InsertDocumentItem): Promise<DocumentItem> {
    const [created] = await db.insert(documentItems).values(item).returning();
    await this.touchDocumentProject(item.projectId);
    return created;
  }

  async updateDocumentItem(
    id: number,
    item: Partial<InsertDocumentItem>,
  ): Promise<DocumentItem | undefined> {
    const [updated] = await db
      .update(documentItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(documentItems.id, id))
      .returning();
    if (updated) {
      await this.touchDocumentProject(updated.projectId);
    }
    return updated || undefined;
  }

  async deleteDocumentItem(id: number): Promise<boolean> {
    const existing = await this.getDocumentItem(id);
    await db.delete(documentItems).where(eq(documentItems.id, id));
    if (existing) {
      await this.touchDocumentProject(existing.projectId);
    }
    return true;
  }

  private async touchDocumentProject(projectId: number) {
    await db
      .update(documentProjects)
      .set({ updatedAt: new Date() })
      .where(eq(documentProjects.id, projectId));
  }
}
