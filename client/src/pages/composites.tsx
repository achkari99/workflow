import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getComposites,
  getWorkflows,
  createComposite,
  deleteComposite,
  getWorkflowSteps,
  copyComposite,
  createCompositeSession,
  addCompositeSessionMember,
  searchUsers,
} from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Plus,
  Loader2,
  Layers,
  Users,
  Trash2,
  X,
  Target,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import type { Workflow, CompositeWorkflowWithItems, Step } from "@shared/schema";

type ShareUser = { id: string; email: string | null; username: string | null; firstName: string | null; lastName: string | null };
function ShareCompositeModal({
  composite,
  onClose,
  onSessionCreated,
}: {
  composite: CompositeWorkflowWithItems;
  onClose: () => void;
  onSessionCreated: (sessionId: number) => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"copy" | "session">("copy");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<ShareUser[]>([]);
  const [copyName, setCopyName] = useState("");
  const [copyDescription, setCopyDescription] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState({
    canEditSteps: false,
    canManageAssignments: false,
    canManageSharing: false,
    canEditIntel: false,
    allowLaneDelegation: false,
  });
  const [laneColor, setLaneColor] = useState("#38bdf8");

  const { data: searchResults } = useQuery({
    queryKey: ["user-search", searchQuery],
    queryFn: () => searchUsers(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const copyMutation = useMutation({
    mutationFn: async () => {
      for (const user of selectedUsers) {
        await copyComposite(composite.id, {
          targetUserId: user.id,
          name: copyName || `${composite.name} (Copy)`,
          description: copyDescription || composite.description || "",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composites"] });
      queryClient.invalidateQueries({ queryKey: ["composite-sessions"] });
      toast.success("Workflow copy shared.");
      setSelectedUsers([]);
      onClose();
    },
    onError: () => {
      toast.error("Failed to share workflow copy.");
    },
  });

  const sessionMutation = useMutation({
    mutationFn: () => createCompositeSession({ compositeId: composite.id, name: sessionName || `${composite.name} Session` }),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["composite-sessions"] });
      setSessionId(session.id);
    },
    onError: () => {
      toast.error("Failed to create live session.");
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      await Promise.all(
        userIds.map((userId) =>
          addCompositeSessionMember(sessionId!, {
            userId,
            ...permissions,
            laneColor,
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["composite-sessions"] });
      toast.success("Session members added.");
      setSelectedUsers([]);
    },
    onError: () => {
      toast.error("Failed to add session members.");
    },
  });

  const toggleUser = (user: ShareUser) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-zinc-950 border border-white/5 w-full max-w-4xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl text-white tracking-widest uppercase">Share Workflow</h2>
            <p className="text-white/40 text-xs font-mono mt-1 uppercase tracking-widest">{composite.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white/20 hover:text-white">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 border-b border-white/5 flex gap-2">
          <button
            onClick={() => setMode("copy")}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest border ${mode === "copy"
              ? "border-primary/60 text-primary bg-primary/10"
              : "border-white/10 text-white/50 hover:border-white/30"
              }`}
          >
            Share Copy
          </button>
          <button
            onClick={() => setMode("session")}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest border ${mode === "session"
              ? "border-primary/60 text-primary bg-primary/10"
              : "border-white/10 text-white/50 hover:border-white/30"
              }`}
          >
            Live Session
          </button>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Search users</label>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username or email..."
              className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
            />
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {searchResults?.map((user) => (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user)}
                  className={`w-full text-left px-3 py-2 border text-xs transition-all ${selectedUsers.some((u) => u.id === user.id)
                    ? "border-primary/40 bg-primary/10 text-white"
                    : "border-white/10 text-white/60 hover:border-white/30"
                    }`}
                >
                  {user.username || user.email || user.firstName || user.id}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {mode === "copy" ? (
              <>
                <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Copy name</label>
                <input
                  value={copyName}
                  onChange={(e) => setCopyName(e.target.value)}
                  placeholder={`${composite.name} (Copy)`}
                  className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                />
                <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Copy description</label>
                <input
                  value={copyDescription}
                  onChange={(e) => setCopyDescription(e.target.value)}
                  placeholder={composite.description || "Shared protocol copy"}
                  className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                />
                <Button
                  onClick={() => copyMutation.mutate()}
                  disabled={selectedUsers.length === 0 || copyMutation.isPending}
                  className="w-full bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
                >
                  {copyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Copy"}
                </Button>
              </>
            ) : (
              <>
                <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Session name</label>
                <input
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder={`${composite.name} Session`}
                  className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                />
                <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-white/50 uppercase tracking-widest">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={permissions.canEditSteps}
                      onChange={(e) => setPermissions((prev) => ({ ...prev, canEditSteps: e.target.checked }))}
                    />
                    Edit Steps
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={permissions.canManageAssignments}
                      onChange={(e) => setPermissions((prev) => ({ ...prev, canManageAssignments: e.target.checked }))}
                    />
                    Manage Assignments
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={permissions.canManageSharing}
                      onChange={(e) => setPermissions((prev) => ({ ...prev, canManageSharing: e.target.checked }))}
                    />
                    Manage Sharing
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={permissions.canEditIntel}
                      onChange={(e) => setPermissions((prev) => ({ ...prev, canEditIntel: e.target.checked }))}
                    />
                    Edit Intel
                  </label>
                  <label className="flex items-center gap-2 col-span-2">
                    <input
                      type="checkbox"
                      checked={permissions.allowLaneDelegation}
                      onChange={(e) => setPermissions((prev) => ({ ...prev, allowLaneDelegation: e.target.checked }))}
                    />
                    Allow Lane Delegation
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Lane Color</span>
                  <input
                    type="color"
                    value={laneColor}
                    onChange={(e) => setLaneColor(e.target.value)}
                    className="h-8 w-12 bg-transparent border border-white/10"
                  />
                </div>
                {!sessionId ? (
                  <Button
                    onClick={() => sessionMutation.mutate()}
                    disabled={sessionMutation.isPending}
                    className="w-full bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
                  >
                    {sessionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Session"}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        if (selectedUsers.length === 0) return;
                        addMemberMutation.mutate(selectedUsers.map((user) => user.id));
                      }}
                      disabled={selectedUsers.length === 0 || addMemberMutation.isPending}
                      className="w-full bg-primary/20 hover:bg-primary/30 text-primary font-mono uppercase tracking-widest"
                    >
                      Add Member
                    </Button>
                    <Button
                      onClick={() => onSessionCreated(sessionId)}
                      className="w-full bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
                    >
                      Open Session
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CreateCompositeModal({
  workflows,
  onClose,
  onSuccess
}: {
  workflows: Workflow[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSteps, setSelectedSteps] = useState<{ id: number, name: string, workflowName: string }[]>([]);
  const [expandedWorkflow, setExpandedWorkflow] = useState<number | null>(null);

  const { data: currentWorkflowSteps, isLoading: stepsLoading } = useQuery({
    queryKey: ["workflow-steps", expandedWorkflow],
    queryFn: () => expandedWorkflow ? getWorkflowSteps(expandedWorkflow) : Promise.resolve([]),
    enabled: !!expandedWorkflow
  });

  const createMutation = useMutation({
    mutationFn: () => {
      console.log("Initiating Master Workflow with steps:", selectedSteps.map(s => s.id));
      return createComposite(name, description, selectedSteps.map(s => s.id));
    },
    onSuccess: () => {
      toast.success(`Workflow ${name} established successfully.`);
      onSuccess();
      onClose();
    },
    onError: (err) => {
      console.error("Master Workflow failure:", err);
      toast.error("Failed to establish protocol. Check console for details.");
    }
  });

  const addStep = (step: { id: number, name: string }, workflowName: string) => {
    setSelectedSteps(prev => [...prev, { id: step.id, name: step.name, workflowName }]);
  };

  const removeStep = (index: number) => {
    setSelectedSteps(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4 md:p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-zinc-950 border border-white/5 w-full max-w-6xl h-full max-h-[90vh] flex flex-col relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated Grid Background */}
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

        {/* Modal Header */}
        <div className="relative z-10 px-8 py-6 border-b border-white/5 flex items-center justify-between bg-black/40">
          <div>
            <h2 className="font-display text-2xl text-white tracking-widest uppercase">Workflow Composer</h2>
            <p className="text-white/30 text-xs font-mono mt-1 uppercase tracking-widest italic">Modular Strategy Architecture Engaged</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white/20 hover:text-white">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row relative z-10">
          {/* Left Panel: Workflow & Step Selection */}
          <div className="w-full lg:w-1/2 border-r border-white/5 flex flex-col">
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Operation Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 font-display text-sm"
                    placeholder="Enter Operation ID..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Briefing</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 text-sm"
                    placeholder="Brief description..."
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 custom-scrollbar">
              <h3 className="text-[10px] font-mono text-primary/60 uppercase tracking-widest mb-4">Available Source Threads</h3>
              {workflows.map(wf => (
                <div key={wf.id} className="space-y-2">
                  <button
                    onClick={() => setExpandedWorkflow(expandedWorkflow === wf.id ? null : wf.id)}
                    className={`w-full flex items-center justify-between p-4 border transition-all ${expandedWorkflow === wf.id ? 'bg-primary/5 border-primary/30' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-white/20" />
                      <span className="text-white text-sm font-display tracking-wide">{wf.name}</span>
                    </div>
                    <Layers className={`w-4 h-4 transition-transform ${expandedWorkflow === wf.id ? 'rotate-180 text-primary' : 'text-white/20'}`} />
                  </button>

                  <AnimatePresence>
                    {expandedWorkflow === wf.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-1 pl-4"
                      >
                        {stepsLoading ? (
                          <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-primary/40" /></div>
                        ) : (
                          currentWorkflowSteps?.map(step => (
                            <button
                              key={step.id}
                              onClick={() => addStep(step, wf.name)}
                              className="w-full text-left p-3 bg-white/5 hover:bg-primary/10 border border-white/5 hover:border-primary/30 group transition-all flex items-center justify-between"
                            >
                              <span className="text-xs text-white/60 group-hover:text-white font-mono">{step.stepNumber}. {step.name}</span>
                              <Plus className="w-3 h-3 text-white/20 group-hover:text-primary" />
                            </button>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel: Reorder & Visual Connections */}


          <div className="flex-1 bg-black/60 flex flex-col relative overflow-hidden">
            <div className="relative z-10 p-6 flex-1 flex flex-col bg-black/30 overflow-hidden">
              <h3 className="text-[10px] font-mono text-primary/60 uppercase tracking-widest mb-8 text-center bg-zinc-900/50 py-2 border border-white/5">Remixed Master Sequence</h3>

              <div className="flex-1 overflow-y-auto px-4 custom-scrollbar min-h-0 relative">

                <div className="space-y-12 pb-20 relative z-10">
                  {selectedSteps.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 italic space-y-4">
                      <Target className="w-12 h-12" />
                      <p className="text-sm font-mono tracking-widest uppercase">Inject steps to build strategy</p>
                    </div>
                  ) : (
                    <div className="space-y-8 pb-20 relative">
                      {selectedSteps.map((step, index) => (
                        <motion.div
                          key={`${step.id}-${index}`}
                          layout
                          initial={{ x: 20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          className="relative"
                        >
                          <div className="flex items-center gap-6 group">
                            {/* Step Index Node */}
                            <div className="relative z-10">
                              <div className="w-8 h-8 rounded-full border-2 border-primary/40 bg-black flex items-center justify-center font-display text-primary text-xs shadow-[0_0_15px_rgba(132,204,22,0.2)]">
                                {index + 1}
                              </div>
                            </div>

                            {/* Connector Line */}
                            {index < selectedSteps.length - 1 && (
                              <div className="absolute left-[15px] top-8 bottom-[-32px] w-px bg-gradient-to-b from-primary/40 to-primary/5 shadow-[0_0_8px_rgba(132,204,22,0.2)] z-0" />
                            )}

                            <div className="flex-1 bg-white/[0.03] border border-white/5 p-3 rounded-sm hover:border-primary/20 transition-all flex items-center justify-between group/card backdrop-blur-sm">
                              <div className="min-w-0">
                                <p className="text-[8px] font-mono text-primary/50 uppercase tracking-[0.2em] truncate">{step.workflowName}</p>
                                <p className="text-white/80 font-display text-xs tracking-wide mt-0.5 truncate">{step.name}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeStep(index)}
                                className="opacity-0 group-hover/card:opacity-100 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all h-7 w-7 p-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-6 border-t border-white/5 bg-black/90 mt-auto shrink-0 z-20 relative shadow-[0_-20px_40px_rgba(0,0,0,0.8)]">
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!name || selectedSteps.length < 2 || createMutation.isPending}
                  className="w-full bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-[0.2em] h-14"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5" />
                      Establish Master Workflow
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function CompositesPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [shareComposite, setShareComposite] = useState<CompositeWorkflowWithItems | null>(null);

  const { data: composites, isLoading: compositesLoading } = useQuery<CompositeWorkflowWithItems[]>({
    queryKey: ["composites"],
    queryFn: getComposites,
  });

  const { data: workflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: getWorkflows,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteComposite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composites"] });
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 border-b border-white/5 bg-black/40 flex items-center justify-between px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="text-white/60 hover:text-white"
          data-testid="button-back"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Home
        </Button>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-wider text-xs"
            data-testid="button-create-composite"
          >
            <Plus className="w-4 h-4 mr-2" />
            Combine Workflows
          </Button>
        </div>
      </header>

      <div className="container mx-auto max-w-4xl py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 border border-primary/20">
              <Layers className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-4xl text-white tracking-tight">Workflows</h1>
              <p className="text-white/40 mt-1 text-lg">Unified oversight for multiple mission threads</p>
            </div>
          </div>
        </motion.div>


        {compositesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !composites || composites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 border border-dashed border-white/10"
          >
            <Layers className="w-16 h-16 text-white/5 mx-auto mb-4" />
            <p className="text-white/40 mb-4">No workflows established</p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary hover:bg-primary/90 text-black px-8 py-6 h-auto font-mono text-sm tracking-widest uppercase"
            >
              <Plus className="w-4 h-4 mr-2" />
              Establish First Workflow
            </Button>
          </motion.div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {composites.map((composite: CompositeWorkflowWithItems) => {
              const remixedSteps = composite.steps || [];
              const completedCount = remixedSteps.filter(s => s.isCompleted).length;
              const progressPercentage = remixedSteps.length > 0
                ? Math.round((completedCount / remixedSteps.length) * 100)
                : 0;

              return (
                <motion.div
                  key={composite.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4 }}
                  onClick={() => {
                    navigate(`/workflows/${composite.id}`);
                  }}
                  className="bg-black/40 border border-white/5 p-6 group transition-all relative overflow-hidden cursor-pointer hover:border-primary/20"
                  data-testid={`composite-card-${composite.id}`}
                >
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-8">
                      <div>
                        <h3 className="font-display text-2xl text-white group-hover:text-primary transition-colors tracking-tight">
                          {composite.name}
                        </h3>
                        {composite.description && (
                          <p className="text-white/40 text-sm mt-1 line-clamp-1 italic">{composite.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShareComposite(composite);
                          }}
                          className="text-white/30 hover:text-primary hover:bg-primary/10 transition-all"
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(composite.id);
                          }}
                          className="text-red-400/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          data-testid={`button-delete-${composite.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.25em] text-white/30">
                          <span>Integration Efficiency</span>
                          <span className="text-primary">{progressPercentage}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <motion.div
                            className="h-full bg-gradient-to-r from-primary/50 to-primary shadow-[0_0_20px_rgba(132,204,22,0.4)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercentage}%` }}
                            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-white/20">Remixed Threads</span>
                          <span className="text-[10px] font-mono text-white/40">{remixedSteps.length} Modular Steps</span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {remixedSteps.map((s, idx) => (
                            <button
                              key={s.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log("Full step object:", s);
                                console.log("Chip click: navigating to /intel/", s.workflowId, "/", s.id);
                                navigate(`/intel/${s.workflowId}/${s.id}`);
                              }}
                              className={`px-2 py-1 text-[9px] font-mono border flex items-center gap-1.5 transition-all group/step ${s.isCompleted
                                ? 'bg-primary/20 border-primary/40 text-primary hover:bg-primary/30'
                                : 'bg-white/5 border-white/10 text-white/40 hover:border-white/30 hover:text-white/60'}`}
                              title={`${s.workflowName}: ${s.name}`}
                            >
                              <span className="opacity-50 group-hover/step:opacity-100">{idx + 1}.</span>
                              <span className="truncate max-w-[80px]">{s.name}</span>
                              <Zap className={`w-2.5 h-2.5 opacity-0 group-hover/step:opacity-100 transition-opacity ${s.isCompleted ? 'text-primary' : 'text-primary/40'}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && workflows && (
          <CreateCompositeModal
            workflows={workflows}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["composites"] });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareComposite && (
          <ShareCompositeModal
            composite={shareComposite}
            onClose={() => setShareComposite(null)}
            onSessionCreated={(sessionId) => {
              setShareComposite(null);
              navigate(`/sessions/${sessionId}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
