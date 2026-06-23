import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  File,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Loader2,
  MoreVertical,
  PencilLine,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { DocumentFolder, DocumentItem, DocumentProject } from "@shared/schema";
import {
  createDocumentFolder,
  createDocumentNote,
  createDocumentProject,
  deleteDocumentFolder,
  deleteDocumentItem,
  deleteDocumentProject,
  getDocumentProjectContent,
  getDocumentProjects,
  type DocumentItemWithUrl,
  updateDocumentNote,
  uploadDocumentFile,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AnimatePresence, motion } from "framer-motion";

type CreatePanel = "folder" | "note" | "upload" | null;

function formatBytes(value: number | null) {
  if (!value) return "Unknown size";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getFolderPath(folders: DocumentFolder[], folderId: number | null) {
  const path: DocumentFolder[] = [];
  let currentId = folderId;
  const visited = new Set<number>();
  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = folders.find((candidate) => candidate.id === currentId);
    if (!folder) break;
    path.unshift(folder);
    currentId = folder.parentFolderId;
  }
  return path;
}

export default function DocumentsPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [createPanel, setCreatePanel] = useState<CreatePanel>(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingNote, setEditingNote] = useState<DocumentItem | null>(null);
  const [editNoteTitle, setEditNoteTitle] = useState("");
  const [editNoteContent, setEditNoteContent] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["document-projects"],
    queryFn: getDocumentProjects,
  });

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      setSelectedFolderId(null);
      return;
    }
    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
      setSelectedFolderId(null);
    }
  }, [projects, selectedProjectId]);

  const {
    data: projectContent,
    isLoading: contentLoading,
  } = useQuery({
    queryKey: ["document-project", selectedProjectId, selectedFolderId],
    queryFn: () => getDocumentProjectContent(selectedProjectId!, selectedFolderId),
    enabled: selectedProjectId !== null,
  });

  const folders = projectContent?.folders || [];
  const visibleFolders = useMemo(
    () => folders.filter((folder) => folder.parentFolderId === selectedFolderId),
    [folders, selectedFolderId],
  );
  const folderPath = useMemo(
    () => getFolderPath(folders, selectedFolderId),
    [folders, selectedFolderId],
  );

  const invalidateDocuments = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["document-projects"] }),
      queryClient.invalidateQueries({ queryKey: ["document-project"] }),
    ]);
  };

  const createProjectMutation = useMutation({
    mutationFn: () =>
      createDocumentProject({
        name: projectName.trim(),
        description: projectDescription.trim() || null,
      }),
    onSuccess: async (project) => {
      setProjectName("");
      setProjectDescription("");
      setShowProjectForm(false);
      setSelectedProjectId(project.id);
      setSelectedFolderId(null);
      await invalidateDocuments();
    },
    onError: () => setErrorMessage("The project could not be created. Please try again."),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: number) => deleteDocumentProject(id),
    onSuccess: async () => {
      setSelectedProjectId(null);
      setSelectedFolderId(null);
      await invalidateDocuments();
    },
    onError: () => setErrorMessage("The project could not be deleted."),
  });

  const createFolderMutation = useMutation({
    mutationFn: () =>
      createDocumentFolder(selectedProjectId!, {
        name: folderName.trim(),
        parentFolderId: selectedFolderId,
      }),
    onSuccess: async () => {
      setFolderName("");
      setCreatePanel(null);
      await invalidateDocuments();
    },
    onError: () => setErrorMessage("The folder could not be created."),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (folder: DocumentFolder) => deleteDocumentFolder(folder.id),
    onSuccess: async (_data, folder) => {
      if (selectedFolderId === folder.id) {
        setSelectedFolderId(folder.parentFolderId);
      }
      await invalidateDocuments();
    },
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : "The folder could not be deleted.",
      ),
  });

  const createNoteMutation = useMutation({
    mutationFn: () =>
      createDocumentNote(selectedProjectId!, {
        folderId: selectedFolderId,
        title: noteTitle.trim(),
        content: noteContent.trim() || null,
      }),
    onSuccess: async () => {
      setNoteTitle("");
      setNoteContent("");
      setCreatePanel(null);
      await invalidateDocuments();
    },
    onError: () => setErrorMessage("The note could not be saved."),
  });

  const updateNoteMutation = useMutation({
    mutationFn: () =>
      updateDocumentNote(editingNote!.id, {
        title: editNoteTitle.trim(),
        content: editNoteContent.trim() || null,
      }),
    onSuccess: async () => {
      setEditingNote(null);
      await invalidateDocuments();
    },
    onError: () => setErrorMessage("The note changes could not be saved."),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadDocumentFile(selectedProjectId!, {
        folderId: selectedFolderId,
        file,
      }),
    onSuccess: async () => {
      setCreatePanel(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await invalidateDocuments();
    },
    onError: (error) =>
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The file could not be uploaded. The maximum size is 25 MB.",
      ),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (item: DocumentItemWithUrl) => deleteDocumentItem(item.id),
    onSuccess: invalidateDocuments,
    onError: () => setErrorMessage("The item could not be deleted."),
  });

  const openNoteEditor = (note: DocumentItem) => {
    setEditingNote(note);
    setEditNoteTitle(note.title);
    setEditNoteContent(note.content || "");
  };

  const selectedProject =
    projectContent?.project || projects.find((project) => project.id === selectedProjectId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 border-b border-white/5 bg-black/50 flex items-center justify-between px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="text-white/60 hover:text-white"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Home
        </Button>
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-white/45">
          <HardDrive className="h-4 w-4 text-primary" />
          Documents
        </div>
        <div className="w-[72px]" />
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-white/10 bg-black/35 p-4 lg:border-b-0 lg:border-r lg:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/35">
                Workspace
              </p>
              <h1 className="mt-1 font-display text-2xl tracking-wide text-white">Projects</h1>
            </div>
            <Button
              size="icon"
              onClick={() => setShowProjectForm((current) => !current)}
              className="bg-primary/20 text-primary hover:bg-primary/30"
              aria-label="Create project"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <AnimatePresence initial={false}>
            {showProjectForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 overflow-hidden border border-primary/20 bg-primary/5"
              >
                <div className="space-y-3 p-3">
                  <input
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Project name"
                    className="w-full border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-primary/60"
                  />
                  <textarea
                    value={projectDescription}
                    onChange={(event) => setProjectDescription(event.target.value)}
                    placeholder="Short description"
                    className="min-h-20 w-full resize-none border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-primary/60"
                  />
                  <Button
                    onClick={() => createProjectMutation.mutate()}
                    disabled={!projectName.trim() || createProjectMutation.isPending}
                    className="w-full bg-primary text-black hover:bg-primary/90"
                  >
                    {createProjectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Project
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {projectsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : projects.length > 0 ? (
            <div className="grid gap-2">
              {projects.map((project) => {
                const active = project.id === selectedProjectId;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setSelectedFolderId(null);
                      setCreatePanel(null);
                    }}
                    className={`group w-full border p-3 text-left transition ${
                      active
                        ? "border-primary/35 bg-primary/10 shadow-[0_0_30px_rgba(132,204,22,0.06)]"
                        : "border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 p-2 ${active ? "bg-primary/15 text-primary" : "bg-white/5 text-white/35"}`}>
                        <FolderOpen className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{project.name}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/35">
                          {project.description || "No description"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="border border-dashed border-white/10 px-4 py-8 text-center">
              <Folder className="mx-auto h-7 w-7 text-white/20" />
              <p className="mt-3 text-sm text-white/40">Create a project to organize your work.</p>
            </div>
          )}
        </aside>

        <section className="min-w-0 p-4 sm:p-6 lg:p-8">
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 flex items-center gap-3 border border-red-400/25 bg-red-500/10 px-4 py-3 text-red-100"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-300" />
                <p className="flex-1 text-sm">{errorMessage}</p>
                <button onClick={() => setErrorMessage("")} aria-label="Dismiss error">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {!selectedProjectId || !selectedProject ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="max-w-md text-center">
                <HardDrive className="mx-auto h-12 w-12 text-primary/30" />
                <h2 className="mt-5 font-display text-3xl text-white">Your finished work lives here</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/40">
                  Create a project, structure it with folders, then keep files and working notes together.
                </p>
                <Button
                  onClick={() => setShowProjectForm(true)}
                  className="mt-6 bg-primary text-black hover:bg-primary/90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Project
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-col gap-4 border-b border-white/8 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId(null)}
                      className="transition hover:text-primary"
                    >
                      {selectedProject.name}
                    </button>
                    {folderPath.map((folder) => (
                      <span key={folder.id} className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        <button
                          type="button"
                          onClick={() => setSelectedFolderId(folder.id)}
                          className="transition hover:text-primary"
                        >
                          {folder.name}
                        </button>
                      </span>
                    ))}
                  </div>
                  <h2 className="mt-2 truncate font-display text-3xl tracking-wide text-white">
                    {folderPath.at(-1)?.name || selectedProject.name}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-white/40">
                    {selectedFolderId
                      ? "Files, notes, and subfolders inside this folder."
                      : selectedProject.description || "Project files, notes, and folders."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCreatePanel(createPanel === "folder" ? null : "folder")}
                    className="border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                  >
                    <FolderPlus className="mr-2 h-4 w-4" />
                    Folder
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCreatePanel(createPanel === "note" ? null : "note")}
                    className="border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Note
                  </Button>
                  <Button
                    onClick={() => {
                      setCreatePanel("upload");
                      window.setTimeout(() => fileInputRef.current?.click(), 0);
                    }}
                    className="bg-primary text-black hover:bg-primary/90"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-white/40 hover:text-white">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-white/10 bg-zinc-950 text-white">
                      <DropdownMenuItem
                        className="text-red-300 focus:bg-red-500/10 focus:text-red-200"
                        onClick={() => {
                          if (window.confirm(`Delete "${selectedProject.name}" and everything inside it?`)) {
                            deleteProjectMutation.mutate(selectedProject.id);
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadMutation.mutate(file);
                }}
              />

              <AnimatePresence initial={false}>
                {createPanel === "folder" && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mb-6 border border-primary/20 bg-primary/5 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        value={folderName}
                        onChange={(event) => setFolderName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && folderName.trim()) {
                            createFolderMutation.mutate();
                          }
                        }}
                        autoFocus
                        placeholder="Folder name"
                        className="flex-1 border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-primary/60"
                      />
                      <Button
                        onClick={() => createFolderMutation.mutate()}
                        disabled={!folderName.trim() || createFolderMutation.isPending}
                        className="bg-primary text-black hover:bg-primary/90"
                      >
                        {createFolderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Folder
                      </Button>
                    </div>
                  </motion.div>
                )}

                {createPanel === "note" && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mb-6 border border-cyan-400/20 bg-cyan-400/[0.04] p-4"
                  >
                    <div className="grid gap-3">
                      <input
                        value={noteTitle}
                        onChange={(event) => setNoteTitle(event.target.value)}
                        placeholder="Note title"
                        className="border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/50"
                      />
                      <textarea
                        value={noteContent}
                        onChange={(event) => setNoteContent(event.target.value)}
                        placeholder="Write the project note..."
                        className="min-h-36 resize-y border border-white/10 bg-black/50 px-3 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-cyan-300/50"
                      />
                      <div>
                        <Button
                          onClick={() => createNoteMutation.mutate()}
                          disabled={!noteTitle.trim() || createNoteMutation.isPending}
                          className="bg-cyan-300 text-black hover:bg-cyan-200"
                        >
                          {createNoteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Save Note
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {createPanel === "upload" && uploadMutation.isPending && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mb-6 flex items-center gap-3 border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-white/60"
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Uploading file...
                  </motion.div>
                )}
              </AnimatePresence>

              {contentLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              ) : visibleFolders.length > 0 || (projectContent?.items.length || 0) > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleFolders.map((folder) => (
                    <motion.div
                      key={folder.id}
                      layout
                      className="group relative border border-white/9 bg-white/[0.025] transition hover:border-primary/25 hover:bg-primary/[0.035]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFolderId(folder.id);
                          setCreatePanel(null);
                        }}
                        className="flex w-full items-center gap-4 p-4 pr-14 text-left"
                      >
                        <div className="bg-primary/10 p-3 text-primary">
                          <Folder className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{folder.name}</p>
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-white/30">
                            Folder
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                      </button>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-2 text-white/35 transition hover:bg-white/5 hover:text-white"
                              aria-label={`Folder actions for ${folder.name}`}
                            >
                              {deleteFolderMutation.isPending &&
                              deleteFolderMutation.variables?.id === folder.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="border-white/10 bg-zinc-950 text-white"
                          >
                            <DropdownMenuItem
                              disabled={deleteFolderMutation.isPending}
                              className="text-red-300 focus:bg-red-500/10 focus:text-red-200"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete "${folder.name}" and everything inside it?`,
                                  )
                                ) {
                                  deleteFolderMutation.mutate(folder);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete folder
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  ))}

                  {projectContent?.items.map((item) => (
                    <motion.article
                      key={item.id}
                      layout
                      className={`group relative min-h-40 border p-4 transition ${
                        item.itemType === "note"
                          ? "border-cyan-300/12 bg-cyan-300/[0.025] hover:border-cyan-300/25"
                          : "border-white/9 bg-white/[0.025] hover:border-primary/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className={`p-2.5 ${item.itemType === "note" ? "bg-cyan-300/10 text-cyan-300" : "bg-white/5 text-white/45"}`}>
                          {item.itemType === "note" ? <FileText className="h-5 w-5" /> : <File className="h-5 w-5" />}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 text-white/25 transition hover:text-white">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/10 bg-zinc-950 text-white">
                            {item.itemType === "note" && (
                              <DropdownMenuItem onClick={() => openNoteEditor(item)}>
                                <PencilLine className="mr-2 h-4 w-4" />
                                Edit note
                              </DropdownMenuItem>
                            )}
                            {item.itemType === "file" && item.fileUrl && (
                              <DropdownMenuItem asChild>
                                <a href={item.fileUrl} target="_blank" rel="noreferrer">
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-300 focus:bg-red-500/10 focus:text-red-200"
                              onClick={() => {
                                if (window.confirm(`Delete "${item.title}"?`)) {
                                  deleteItemMutation.mutate(item);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (item.itemType === "note") {
                            openNoteEditor(item);
                          } else if (item.fileUrl) {
                            window.open(item.fileUrl, "_blank", "noopener,noreferrer");
                          }
                        }}
                        className="mt-4 block w-full text-left"
                      >
                        <h3 className="line-clamp-2 text-sm font-medium leading-relaxed text-white">
                          {item.title}
                        </h3>
                        {item.itemType === "note" ? (
                          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-white/40">
                            {item.content || "Empty note"}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-white/35">
                            {item.fileName} · {formatBytes(item.fileSize)}
                          </p>
                        )}
                      </button>
                      <p className="absolute bottom-3 right-4 font-mono text-[9px] uppercase tracking-widest text-white/20">
                        {formatDate(item.updatedAt)}
                      </p>
                    </motion.article>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-80 items-center justify-center border border-dashed border-white/10 bg-white/[0.015]">
                  <div className="max-w-sm px-6 text-center">
                    <FolderOpen className="mx-auto h-10 w-10 text-white/15" />
                    <h3 className="mt-4 text-lg text-white/70">This space is empty</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/35">
                      Add a folder, write a project note, or upload completed work.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <Dialog open={editingNote !== null} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent className="border-white/10 bg-zinc-950 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-wide">Edit Project Note</DialogTitle>
            <DialogDescription className="text-white/40">
              This note stays inside the current project workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <input
              value={editNoteTitle}
              onChange={(event) => setEditNoteTitle(event.target.value)}
              className="border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50"
            />
            <textarea
              value={editNoteContent}
              onChange={(event) => setEditNoteContent(event.target.value)}
              className="min-h-72 resize-y border border-white/10 bg-black/50 px-3 py-3 text-sm leading-relaxed text-white outline-none focus:border-cyan-300/50"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditingNote(null)} className="text-white/50 hover:text-white">
                Cancel
              </Button>
              <Button
                onClick={() => updateNoteMutation.mutate()}
                disabled={!editNoteTitle.trim() || updateNoteMutation.isPending}
                className="bg-cyan-300 text-black hover:bg-cyan-200"
              >
                {updateNoteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
