import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCompositeSessions,
  getCompositeSession,
  deleteCompositeSession,
  addCompositeSessionMember,
  updateCompositeSessionMember,
  deleteCompositeSessionMember,
  assignCompositeSessionStep,
  removeCompositeSessionAssignment,
  updateCompositeSessionAssignment,
  addCompositeSessionAssignmentDelegate,
  removeCompositeSessionAssignmentDelegate,
  addCompositeSessionLaneDelegate,
  removeCompositeSessionLaneDelegate,
  createCompositeSession,
  getComposites,
  updateSessionProofConfig,
  deleteSessionProof,
  searchUsers,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Plus, X, ChevronLeft, Shield, Trash2 } from "lucide-react";
import type {
  CompositeWorkflowWithItems,
  CompositeWorkflowSessionAssignment,
  CompositeWorkflowSessionMember,
  CompositeWorkflowSessionStep,
  CompositeWorkflowSessionIntelDoc,
  CompositeWorkflowSessionAssignmentDelegate,
  CompositeWorkflowSessionLaneDelegate,
} from "@shared/schema";

type CompositeSessionSummary = {
  id: number;
  name: string | null;
  compositeId: number;
  ownerId: string | null;
  createdAt: string;
  composite?: { id: number; name: string | null } | null;
};

type CompositeSessionPayload = {
  id: number;
  compositeId: number;
  name: string | null;
  ownerId: string | null;
  createdAt: string;
  composite: CompositeWorkflowWithItems | null;
  members: (CompositeWorkflowSessionMember & {
    user?: { id: string; username: string | null; email: string | null; firstName: string | null; lastName: string | null } | null;
    laneDelegates?: CompositeWorkflowSessionLaneDelegate[];
  })[];
  assignments: (CompositeWorkflowSessionAssignment & { delegates?: CompositeWorkflowSessionAssignmentDelegate[] })[];
  sessionSteps: CompositeWorkflowSessionStep[];
  intelDocs: CompositeWorkflowSessionIntelDoc[];
};

type ShareUser = { id: string; email: string | null; firstName: string | null; lastName: string | null };

function getDisplayName(member: CompositeWorkflowSessionMember & { user?: any }) {
  const user = member.user;
  if (!user) return member.userId;
  return user.firstName || user.username || user.email || member.userId;
}

export default function CompositeSessionsPage() {
  const params = useParams<{ id?: string }>();
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<CompositeSessionSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [assignQuery, setAssignQuery] = useState("");
  const [assignStepId, setAssignStepId] = useState<number | null>(null);
  const [delegateQuery, setDelegateQuery] = useState("");
  const [laneDelegateQuery, setLaneDelegateQuery] = useState("");
  const [laneOwnerId, setLaneOwnerId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [proofStepId, setProofStepId] = useState<number | null>(null);
  const [proofRequired, setProofRequired] = useState(false);
  const [proofTitle, setProofTitle] = useState("");
  const [proofDescription, setProofDescription] = useState("");
  const [permissions, setPermissions] = useState({
    canEditSteps: false,
    canManageAssignments: false,
    canManageSharing: false,
    canEditIntel: false,
    canEditProof: false,
    canChat: false,
    allowLaneDelegation: false,
  });
  const [laneColor, setLaneColor] = useState("#38bdf8");
  const [createCompositeId, setCreateCompositeId] = useState<number | null>(null);
  const [newSessionName, setNewSessionName] = useState("");

  const sessionIdFromParams = params?.id ? parseInt(params.id, 10) : null;
  const isSingleSession = !!sessionIdFromParams;
  const backSessionId = sessionIdFromParams ?? selectedSessionId;

  const { data: sessions, isLoading } = useQuery<CompositeSessionSummary[]>({
    queryKey: ["composite-sessions"],
    queryFn: getCompositeSessions,
  });
  const { data: workflows } = useQuery<CompositeWorkflowWithItems[]>({
    queryKey: ["composites"],
    queryFn: getComposites,
  });

  useEffect(() => {
    if (!selectedSessionId) return;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "session:subscribe", sessionId: selectedSessionId }));
    });
    ws.addEventListener("message", () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
      queryClient.invalidateQueries({ queryKey: ["composite-sessions"] });
    });
    return () => {
      ws.close();
    };
  }, [selectedSessionId, queryClient]);

  useEffect(() => {
    if (sessionIdFromParams && selectedSessionId !== sessionIdFromParams) {
      setSelectedSessionId(sessionIdFromParams);
      return;
    }
    if (!sessions || sessions.length === 0 || isSingleSession) return;
    const query = location.split("?")[1] || "";
    const queryParams = new URLSearchParams(query);
    const preferred = queryParams.get("sessionId");
    const preferredId = preferred ? parseInt(preferred, 10) : null;
    if (preferredId && sessions.some((session) => session.id === preferredId)) {
      setSelectedSessionId(preferredId);
      return;
    }
    if (!selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId, location, sessionIdFromParams, isSingleSession]);

  useEffect(() => {
    if (createCompositeId) return;
    if (!workflows || workflows.length === 0) return;
    setCreateCompositeId(workflows[0].id);
  }, [workflows, createCompositeId]);

  const { data: session, isLoading: sessionLoading } = useQuery<CompositeSessionPayload>({
    queryKey: ["composite-session", selectedSessionId],
    queryFn: () => getCompositeSession(selectedSessionId!),
    enabled: !!selectedSessionId,
  });

  const selectedWorkflowForSession = useMemo(
    () => workflows?.find((workflow) => workflow.id === createCompositeId) || null,
    [workflows, createCompositeId]
  );

  const { data: searchResults } = useQuery<ShareUser[]>({
    queryKey: ["user-search", searchQuery],
    queryFn: () => searchUsers(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const { data: assignResults } = useQuery<ShareUser[]>({
    queryKey: ["user-search-assign", assignQuery],
    queryFn: () => searchUsers(assignQuery),
    enabled: assignQuery.length >= 2,
  });

  const { data: delegateResults } = useQuery<ShareUser[]>({
    queryKey: ["user-search-delegate", delegateQuery],
    queryFn: () => searchUsers(delegateQuery),
    enabled: delegateQuery.length >= 2,
  });

  const { data: laneDelegateResults } = useQuery<ShareUser[]>({
    queryKey: ["user-search-lane-delegate", laneDelegateQuery],
    queryFn: () => searchUsers(laneDelegateQuery),
    enabled: laneDelegateQuery.length >= 2,
  });

  const currentMember = session?.members.find((m) => m.userId === user?.id) || null;
  const canManageSharing = useMemo(() => {
    if (!session || !user) return false;
    if (session.ownerId === user.id) return true;
    return !!currentMember?.canManageSharing;
  }, [session, user, currentMember]);
  const canManageAssignments = useMemo(() => {
    if (!session || !user) return false;
    if (session.ownerId === user.id) return true;
    return !!currentMember?.canManageAssignments;
  }, [session, user, currentMember]);
  const canManageProofs = useMemo(() => {
    if (!session || !user) return false;
    if (session.ownerId === user.id) return true;
    return !!currentMember?.canEditProof;
  }, [session, user, currentMember]);

  const assignmentsForSelectedStep = useMemo(
    () => session?.assignments.filter((assignment) => assignment.stepId === assignStepId) || [],
    [session?.assignments, assignStepId]
  );

  const selectedAssignment = useMemo(() => {
    if (!assignmentsForSelectedStep.length) return null;
    return assignmentsForSelectedStep.find((assignment) => assignment.id === selectedAssignmentId) || assignmentsForSelectedStep[0];
  }, [assignmentsForSelectedStep, selectedAssignmentId]);

  const sessionStepForProof = useMemo(() => {
    if (!proofStepId || !session) return null;
    return session.sessionSteps.find((step) => step.stepId === proofStepId) || null;
  }, [proofStepId, session]);

  const canManageAssignmentDelegates = useMemo(() => {
    if (!selectedAssignment || !user) return false;
    return canManageAssignments || selectedAssignment.assigneeUserId === user.id;
  }, [canManageAssignments, selectedAssignment, user]);

  const canManageLaneDelegates = useMemo(() => {
    if (!laneOwnerId || !user) return false;
    return canManageAssignments || laneOwnerId === user.id;
  }, [canManageAssignments, laneOwnerId, user]);

  useEffect(() => {
    if (!session?.composite?.steps?.length) return;
    if (assignStepId) return;
    setAssignStepId(session.composite.steps[0].id);
  }, [session, assignStepId]);

  useEffect(() => {
    if (!session?.members?.length) return;
    if (laneOwnerId) return;
    setLaneOwnerId(session.members[0].userId);
  }, [session, laneOwnerId]);

  useEffect(() => {
    if (!session?.assignments?.length) {
      setSelectedAssignmentId(null);
      return;
    }
    if (selectedAssignmentId) return;
    setSelectedAssignmentId(session.assignments[0].id);
  }, [session, selectedAssignmentId]);

  useEffect(() => {
    if (!session?.composite?.steps?.length) return;
    if (proofStepId) return;
    setProofStepId(session.composite.steps[0].id);
  }, [session, proofStepId]);

  useEffect(() => {
    if (!sessionStepForProof) return;
    setProofRequired(!!sessionStepForProof.proofRequired);
    setProofTitle(sessionStepForProof.proofTitle || "");
    setProofDescription(sessionStepForProof.proofDescription || "");
  }, [sessionStepForProof]);

  const addMemberMutation = useMutation({
    mutationFn: (payload: { userId: string }) =>
      addCompositeSessionMember(selectedSessionId!, {
        userId: payload.userId,
        ...permissions,
        laneColor,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
      setSearchQuery("");
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: (payload: { memberId: number; data: Partial<CompositeWorkflowSessionMember> }) =>
      updateCompositeSessionMember(selectedSessionId!, payload.memberId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: number) => deleteCompositeSessionMember(selectedSessionId!, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (payload: { userId: string }) =>
      assignCompositeSessionStep(selectedSessionId!, {
        stepId: assignStepId!,
        assigneeUserId: payload.userId,
        allowDelegation: false,
        allowDelegationToEveryone: false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
      setAssignQuery("");
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: (assignmentId: number) => removeCompositeSessionAssignment(selectedSessionId!, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: (payload: { assignmentId: number; allowDelegation: boolean; allowDelegationToEveryone?: boolean }) =>
      updateCompositeSessionAssignment(selectedSessionId!, payload.assignmentId, {
        allowDelegation: payload.allowDelegation,
        allowDelegationToEveryone: payload.allowDelegationToEveryone,
      }),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["composite-session", selectedSessionId] });
      const previous = queryClient.getQueryData<CompositeSessionPayload>(["composite-session", selectedSessionId]);
      updateAssignmentCache(payload.assignmentId, {
        allowDelegation: payload.allowDelegation,
        allowDelegationToEveryone: payload.allowDelegationToEveryone,
      });
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["composite-session", selectedSessionId], context.previous);
      }
    },
    onSuccess: (updated) => {
      updateAssignmentCache(updated.id, updated);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
    },
  });

  const updateProofConfigMutation = useMutation({
    mutationFn: () =>
      updateSessionProofConfig(selectedSessionId!, sessionStepForProof!.id, {
        proofRequired,
        proofTitle,
        proofDescription,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
    },
  });

  const deleteProofMutation = useMutation({
    mutationFn: () => deleteSessionProof(selectedSessionId!, sessionStepForProof!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
    },
  });

  const updateAssignmentCache = (assignmentId: number, patch: Record<string, any>) => {
    queryClient.setQueryData(["composite-session", selectedSessionId], (data: CompositeSessionPayload | undefined) => {
      if (!data) return data;
      return {
        ...data,
        assignments: data.assignments.map((assignment) =>
          assignment.id === assignmentId ? { ...assignment, ...patch } : assignment
        ),
      };
    });
  };

  const clearAssignmentDelegates = (assignmentId: number, delegates: CompositeWorkflowSessionAssignmentDelegate[]) => {
    if (!delegates.length) return;
    updateAssignmentCache(assignmentId, { delegates: [] });
    delegates.forEach((delegate) => {
      removeAssignmentDelegateMutation.mutate({ assignmentId, delegateId: delegate.id });
    });
  };

  const addAssignmentDelegateMutation = useMutation({
    mutationFn: (payload: { assignmentId: number; userId: string }) =>
      addCompositeSessionAssignmentDelegate(selectedSessionId!, payload.assignmentId, payload.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
      setDelegateQuery("");
    },
  });

  const removeAssignmentDelegateMutation = useMutation({
    mutationFn: (payload: { assignmentId: number; delegateId: number }) =>
      removeCompositeSessionAssignmentDelegate(selectedSessionId!, payload.assignmentId, payload.delegateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
    },
  });

  const addLaneDelegateMutation = useMutation({
    mutationFn: (payload: { ownerUserId: string; userId: string }) =>
      addCompositeSessionLaneDelegate(selectedSessionId!, payload.ownerUserId, payload.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
      setLaneDelegateQuery("");
    },
  });

  const removeLaneDelegateMutation = useMutation({
    mutationFn: (delegateId: number) => removeCompositeSessionLaneDelegate(selectedSessionId!, delegateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: number) => deleteCompositeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["composite-session", selectedSessionId] });
      setSelectedSessionId(null);
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: () =>
      createCompositeSession({
        compositeId: createCompositeId!,
        name: newSessionName || `${selectedWorkflowForSession?.name || "Workflow"} Session`,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["composite-sessions"] });
      setNewSessionName("");
      navigate(`/sessions/${created.id}`);
    },
  });

  return (
    <div className="min-h-screen bg-black text-foreground relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(132,204,22,0.08),_transparent_55%)]" />
      <div className="relative z-10">
      <header className="h-16 border-b border-white/10 bg-black/70 backdrop-blur flex items-center justify-between px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate(
              isSingleSession && backSessionId
                ? `/sessions/${backSessionId}`
                : "/workflows"
            )
          }
          className="text-white/60 hover:text-white"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {isSingleSession ? "Back to Session" : "Back to Workflows"}
        </Button>
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/50">
          <Users className="w-4 h-4" />
          {isSingleSession ? "Session Control" : "Sessions"}
        </div>
        <div className="text-white/30 text-xs">
          {isSingleSession ? "Live" : `${sessions?.length || 0} active`}
        </div>
      </header>

      <div className={isSingleSession ? "min-h-[calc(100vh-64px)]" : "grid grid-cols-[280px_1fr] min-h-[calc(100vh-64px)]"}>
        {!isSingleSession && (
          <aside className="border-r border-white/10 bg-black/70 backdrop-blur p-4 shadow-[inset_-1px_0_0_rgba(255,255,255,0.03)]">
            <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-4">Live Sessions</h2>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : !sessions || sessions.length === 0 ? (
              <div className="text-xs text-white/40">No sessions yet.</div>
            ) : (
              <div className="space-y-3">
                {sessions.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedSessionId(item.id)}
                    className={`w-full text-left border px-3 py-2 text-xs transition-colors ${
                      selectedSessionId === item.id
                        ? "border-primary/50 bg-primary/10 text-white"
                        : "border-white/10 text-white/60 hover:border-white/30"
                    }`}
                  >
                    <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Session</p>
                    <p className="text-sm text-white truncate">{item.name || item.composite?.name || "Untitled"}</p>
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}

        <main className={isSingleSession ? "p-8 flex justify-center" : "p-8"}>
          {!isSingleSession && (
            <div className="mb-8 border border-white/10 bg-gradient-to-br from-white/5 via-black/50 to-black/80 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xs font-mono text-white/60 uppercase tracking-widest">Start a Session</h2>
                  <p className="text-sm text-white/40 mt-1">Launch a live workspace from a specific workflow.</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => createSessionMutation.mutate()}
                  disabled={!createCompositeId || createSessionMutation.isPending}
                  className="bg-primary text-black font-mono uppercase tracking-widest"
                >
                  {createSessionMutation.isPending ? "Creating..." : "Create Session"}
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
                <div>
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Workflow</label>
                  <select
                    value={createCompositeId ?? ""}
                    onChange={(e) => setCreateCompositeId(parseInt(e.target.value, 10))}
                    className="mt-2 w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    {workflows?.map((workflow) => (
                      <option key={workflow.id} value={workflow.id}>
                        {workflow.name || `Workflow ${workflow.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Session Name</label>
                  <input
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    placeholder={selectedWorkflowForSession ? `${selectedWorkflowForSession.name} Session` : "Session name"}
                    className="mt-2 w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}
          {sessionLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !session ? (
            <div className="text-center text-white/40">Select a session to manage.</div>
          ) : (
            <div className={isSingleSession ? "w-full max-w-4xl space-y-8" : "max-w-4xl space-y-8"}>
              <div className="flex items-center justify-between border border-white/10 bg-white/5 p-4 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
                <div>
                  <h1 className="text-2xl font-display text-white">{session.name || session.composite?.name}</h1>
                  <p className="text-xs text-white/40 mt-1">{session.composite?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(session.ownerId === user?.id || canManageSharing) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteSession(session)}
                      className="text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  {!isSingleSession && (
                    <Button
                      onClick={() => navigate(`/sessions/${session.id}`)}
                      className="bg-primary text-black font-mono uppercase tracking-widest"
                    >
                      Open Session
                    </Button>
                  )}
                </div>
              </div>

              <div className="border border-white/10 bg-gradient-to-br from-white/5 via-black/40 to-black/80 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-mono text-white/60 uppercase tracking-widest">Members</h2>
                  {!canManageSharing && (
                    <span className="text-[10px] text-white/40">View only</span>
                  )}
                </div>
                <div className="space-y-3">
                  {session.members.map((member) => {
                    const isOwner = member.userId === session.ownerId;
                    return (
                      <div key={member.id} className="border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: member.laneColor }} />
                            <span className="text-sm text-white">{getDisplayName(member)}</span>
                          </div>
                          {isOwner ? (
                            <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Owner</span>
                          ) : canManageSharing ? (
                            <button
                              onClick={() => removeMemberMutation.mutate(member.id)}
                              className="text-white/40 hover:text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-white/50 font-mono">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={member.canEditSteps}
                              disabled={!canManageSharing || isOwner}
                              onChange={(e) =>
                                updateMemberMutation.mutate({ memberId: member.id, data: { canEditSteps: e.target.checked } })
                              }
                            />
                            Edit Steps
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={member.canManageAssignments}
                              disabled={!canManageSharing || isOwner}
                              onChange={(e) =>
                                updateMemberMutation.mutate({
                                  memberId: member.id,
                                  data: { canManageAssignments: e.target.checked },
                                })
                              }
                            />
                            Assign
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={member.canManageSharing}
                              disabled={!canManageSharing || isOwner}
                              onChange={(e) =>
                                updateMemberMutation.mutate({ memberId: member.id, data: { canManageSharing: e.target.checked } })
                              }
                            />
                            Sharing
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={member.canEditIntel}
                              disabled={!canManageSharing || isOwner}
                              onChange={(e) =>
                                updateMemberMutation.mutate({ memberId: member.id, data: { canEditIntel: e.target.checked } })
                              }
                            />
                            Intel
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={member.canEditProof}
                              disabled={!canManageSharing || isOwner}
                              onChange={(e) =>
                                updateMemberMutation.mutate({ memberId: member.id, data: { canEditProof: e.target.checked } })
                              }
                            />
                            Proof
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={member.canChat}
                              disabled={!canManageSharing || isOwner}
                              onChange={(e) =>
                                updateMemberMutation.mutate({ memberId: member.id, data: { canChat: e.target.checked } })
                              }
                            />
                            Chat
                          </label>
                          <label className="flex items-center gap-2 col-span-2">
                            <input
                              type="checkbox"
                              checked={member.allowLaneDelegation}
                              disabled={!canManageSharing || isOwner}
                              onChange={(e) =>
                                updateMemberMutation.mutate({
                                  memberId: member.id,
                                  data: { allowLaneDelegation: e.target.checked },
                                })
                              }
                            />
                            Allow Lane Delegation
                          </label>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-[9px] text-white/40 font-mono uppercase tracking-widest">Lane Color</span>
                          <input
                            type="color"
                            value={member.laneColor || "#38bdf8"}
                            disabled={!canManageSharing || isOwner}
                            onChange={(e) =>
                              updateMemberMutation.mutate({ memberId: member.id, data: { laneColor: e.target.value } })
                            }
                            className="h-7 w-10 bg-transparent border border-white/10"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {canManageSharing && (
                <div className="border border-white/10 bg-gradient-to-br from-white/5 via-black/40 to-black/80 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
                  <h2 className="text-xs font-mono text-white/60 uppercase tracking-widest mb-4">Add Member</h2>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by email"
                    className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                  />
                  {searchResults && searchResults.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {searchResults.map((candidate) => (
                        <button
                          key={candidate.id}
                          onClick={() => addMemberMutation.mutate({ userId: candidate.id })}
                          className="w-full flex items-center justify-between border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:border-primary/40"
                        >
                          <span>{candidate.email || candidate.firstName || candidate.id}</span>
                          <Plus className="w-3 h-3 text-primary" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 mt-5 text-[10px] font-mono text-white/50 uppercase tracking-widest">
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
                      Assign
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={permissions.canManageSharing}
                        onChange={(e) => setPermissions((prev) => ({ ...prev, canManageSharing: e.target.checked }))}
                      />
                      Sharing
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={permissions.canEditIntel}
                        onChange={(e) => setPermissions((prev) => ({ ...prev, canEditIntel: e.target.checked }))}
                      />
                      Intel
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={permissions.canEditProof}
                        onChange={(e) => setPermissions((prev) => ({ ...prev, canEditProof: e.target.checked }))}
                      />
                      Proof
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={permissions.canChat}
                        onChange={(e) => setPermissions((prev) => ({ ...prev, canChat: e.target.checked }))}
                      />
                      Chat
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
                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-[9px] text-white/40 font-mono uppercase tracking-widest">Lane Color</span>
                    <input
                      type="color"
                      value={laneColor}
                      onChange={(e) => setLaneColor(e.target.value)}
                      className="h-7 w-10 bg-transparent border border-white/10"
                    />
                  </div>
                </div>
              )}

              <div className="border border-white/10 bg-gradient-to-br from-white/5 via-black/40 to-black/80 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-mono text-white/60 uppercase tracking-widest">Assignments</h2>
                  {!canManageAssignments && !canManageAssignmentDelegates && (
                    <span className="text-[10px] text-white/40">View only</span>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Select Phase</label>
                    <select
                      value={assignStepId ?? ""}
                      onChange={(e) => setAssignStepId(parseInt(e.target.value, 10))}
                      className="mt-2 w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                    >
                      {session.composite?.steps?.map((step, index) => (
                        <option key={step.id} value={step.id}>
                          Phase {index + 1} - {step.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Current Assignees</div>
                    <div className="flex flex-wrap gap-2">
                      {assignmentsForSelectedStep.length === 0 ? (
                        <span className="text-xs text-white/30 font-mono">No assignees yet</span>
                      ) : (
                        assignmentsForSelectedStep.map((assignment) => {
                          const assignee = session.members.find((m) => m.userId === assignment.assigneeUserId);
                          const isSelected = selectedAssignment?.id === assignment.id;
                          return (
                            <div
                              key={assignment.id}
                              className={`flex items-center gap-2 px-2 py-1 border text-[10px] font-mono ${isSelected ? "border-primary/50 bg-primary/10 text-white" : "border-white/10 bg-white/5 text-white/60"}`}
                            >
                              <button
                                onClick={() => setSelectedAssignmentId(assignment.id)}
                                className="flex items-center gap-2"
                              >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: assignee?.laneColor || "#38bdf8" }} />
                                <span>{assignee ? getDisplayName(assignee) : assignment.assigneeUserId}</span>
                              </button>
                              {assignment.allowDelegation && <Shield className="w-3 h-3 text-primary" />}
                              {canManageAssignments && (
                                <button
                                  onClick={() => removeAssignmentMutation.mutate(assignment.id)}
                                  className="text-red-400/60 hover:text-red-400"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {canManageAssignments && (
                    <div className="space-y-3 border-t border-white/10 pt-4">
                      <input
                        value={assignQuery}
                        onChange={(e) => setAssignQuery(e.target.value)}
                        placeholder="Search user to assign..."
                        className="w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                      />
                      {assignResults && assignResults.length > 0 && (
                        <div className="space-y-2">
                          {assignResults.map((candidate) => (
                            <button
                              key={candidate.id}
                              onClick={() => assignMutation.mutate({ userId: candidate.id })}
                              className="w-full flex items-center justify-between border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:border-primary/40"
                            >
                              <span>{candidate.email || candidate.firstName || candidate.id}</span>
                              <Plus className="w-3 h-3 text-primary" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedAssignment && (
                    <div className="space-y-3 border-t border-white/10 pt-4">
                      <label className="flex items-center gap-2 text-[11px] text-white/50 font-mono">
                        <input
                          type="checkbox"
                          checked={!!selectedAssignment.allowDelegation && !selectedAssignment.allowDelegationToEveryone}
                          disabled={!canManageAssignmentDelegates || selectedAssignment.allowDelegationToEveryone}
                          onChange={(e) => {
                            const allowDelegation = e.target.checked;
                            updateAssignmentCache(selectedAssignment.id, {
                              allowDelegation,
                              allowDelegationToEveryone: false,
                            });
                            updateAssignmentMutation.mutate({
                              assignmentId: selectedAssignment.id,
                              allowDelegation,
                              allowDelegationToEveryone: false,
                            });
                          }}
                        />
                        Allow delegation for this task
                      </label>

                      <label className="flex items-center gap-2 text-[11px] text-white/50 font-mono">
                        <input
                          type="checkbox"
                          checked={!!selectedAssignment.allowDelegationToEveryone}
                          disabled={!canManageAssignmentDelegates}
                          onChange={(e) => {
                            const allowDelegationToEveryone = e.target.checked;
                            if (allowDelegationToEveryone) {
                              clearAssignmentDelegates(selectedAssignment.id, selectedAssignment.delegates || []);
                            } else {
                              clearAssignmentDelegates(selectedAssignment.id, selectedAssignment.delegates || []);
                            }
                            updateAssignmentCache(selectedAssignment.id, {
                              allowDelegation: allowDelegationToEveryone,
                              allowDelegationToEveryone,
                            });
                            updateAssignmentMutation.mutate({
                              assignmentId: selectedAssignment.id,
                              allowDelegation: allowDelegationToEveryone,
                              allowDelegationToEveryone,
                            });
                          }}
                        />
                        Allow delegation for this task to everyone
                      </label>

                      {!selectedAssignment.allowDelegationToEveryone && (
                        <>
                          <div className="space-y-2">
                            <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Delegates</div>
                            <div className="flex flex-wrap gap-2">
                              {(selectedAssignment.delegates || []).length === 0 ? (
                                <span className="text-xs text-white/30 font-mono">No delegates yet</span>
                              ) : (
                                (selectedAssignment.delegates || []).map((delegate) => {
                                  const delegateUser = session.members.find((m) => m.userId === delegate.delegateUserId);
                                  return (
                                    <div
                                      key={delegate.id}
                                      className="flex items-center gap-2 px-2 py-1 border border-white/10 bg-white/5 text-[10px] font-mono text-white/60"
                                    >
                                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: delegateUser?.laneColor || "#38bdf8" }} />
                                      <span>{delegateUser ? getDisplayName(delegateUser) : delegate.delegateUserId}</span>
                                      {canManageAssignmentDelegates && (
                                        <button
                                          onClick={() => removeAssignmentDelegateMutation.mutate({ assignmentId: selectedAssignment.id, delegateId: delegate.id })}
                                          className="text-red-400/60 hover:text-red-400"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {canManageAssignmentDelegates && selectedAssignment.allowDelegation && (
                            <div className="space-y-3">
                              <input
                                value={delegateQuery}
                                onChange={(e) => setDelegateQuery(e.target.value)}
                                placeholder="Search user to delegate..."
                                className="w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                              />
                              {delegateResults && delegateResults.length > 0 && (
                                <div className="space-y-2">
                                  {delegateResults.map((candidate) => (
                                    <button
                                      key={candidate.id}
                                      onClick={() => addAssignmentDelegateMutation.mutate({ assignmentId: selectedAssignment.id, userId: candidate.id })}
                                      className="w-full flex items-center justify-between border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:border-primary/40"
                                    >
                                      <span>{candidate.email || candidate.firstName || candidate.id}</span>
                                      <Plus className="w-3 h-3 text-primary" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-white/10 bg-gradient-to-br from-white/5 via-black/40 to-black/80 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-mono text-white/60 uppercase tracking-widest">Proof Requirements</h2>
                  {!canManageProofs && (
                    <span className="text-[10px] text-white/40">View only</span>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Select Phase</label>
                    <select
                      value={proofStepId ?? ""}
                      onChange={(e) => setProofStepId(parseInt(e.target.value, 10))}
                      className="mt-2 w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                    >
                      {session?.composite?.steps?.map((step, index) => (
                        <option key={step.id} value={step.id}>
                          Phase {index + 1} - {step.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {sessionStepForProof ? (
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-[11px] text-white/50 font-mono">
                        <input
                          type="checkbox"
                          checked={proofRequired}
                          disabled={!canManageProofs}
                          onChange={(e) => setProofRequired(e.target.checked)}
                        />
                        Require proof for this phase
                      </label>
                      <input
                        value={proofTitle}
                        onChange={(e) => setProofTitle(e.target.value)}
                        placeholder="Proof title"
                        disabled={!canManageProofs || !proofRequired}
                        className="w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary disabled:opacity-40"
                      />
                      <textarea
                        value={proofDescription}
                        onChange={(e) => setProofDescription(e.target.value)}
                        placeholder="Proof description"
                        disabled={!canManageProofs || !proofRequired}
                        className="w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary min-h-[90px] resize-none disabled:opacity-40"
                      />
                      {sessionStepForProof.proofSubmittedAt && (
                        <div className="text-[10px] text-emerald-300 font-mono uppercase tracking-widest">
                          Proof submitted
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateProofConfigMutation.mutate()}
                          disabled={!canManageProofs || updateProofConfigMutation.isPending}
                          className="bg-primary text-black font-mono uppercase tracking-widest"
                        >
                          Save Proof Settings
                        </Button>
                        {sessionStepForProof.proofSubmittedAt && canManageProofs && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteProofMutation.mutate()}
                            className="text-red-400 hover:text-red-300"
                          >
                            Delete Proof
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-white/40">Select a phase to edit proofs.</div>
                  )}
                </div>
              </div>

              <div className="border border-white/10 bg-gradient-to-br from-white/5 via-black/40 to-black/80 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-mono text-white/60 uppercase tracking-widest">Lane Delegates</h2>
                  {!canManageLaneDelegates && (
                    <span className="text-[10px] text-white/40">View only</span>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Select Lane Owner</label>
                    <select
                      value={laneOwnerId ?? ""}
                      onChange={(e) => setLaneOwnerId(e.target.value)}
                      className="mt-2 w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                    >
                      {session.members.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {getDisplayName(member)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Allowed Delegates</div>
                    <div className="flex flex-wrap gap-2">
                      {(session.members.find((m) => m.userId === laneOwnerId)?.laneDelegates || []).length === 0 ? (
                        <span className="text-xs text-white/30 font-mono">No delegates yet</span>
                      ) : (
                        (session.members.find((m) => m.userId === laneOwnerId)?.laneDelegates || []).map((delegate) => {
                          const delegateUser = session.members.find((m) => m.userId === delegate.delegateUserId);
                          return (
                            <div
                              key={delegate.id}
                              className="flex items-center gap-2 px-2 py-1 border border-white/10 bg-white/5 text-[10px] font-mono text-white/60"
                            >
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: delegateUser?.laneColor || "#38bdf8" }} />
                              <span>{delegateUser ? getDisplayName(delegateUser) : delegate.delegateUserId}</span>
                              {canManageLaneDelegates && (
                                <button
                                  onClick={() => removeLaneDelegateMutation.mutate(delegate.id)}
                                  className="text-red-400/60 hover:text-red-400"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  {canManageLaneDelegates && laneOwnerId && (
                    <div className="space-y-3">
                      <input
                        value={laneDelegateQuery}
                        onChange={(e) => setLaneDelegateQuery(e.target.value)}
                        placeholder="Search user to allow..."
                        className="w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                      />
                      {laneDelegateResults && laneDelegateResults.length > 0 && (
                        <div className="space-y-2">
                          {laneDelegateResults.map((candidate) => (
                            <button
                              key={candidate.id}
                              onClick={() => addLaneDelegateMutation.mutate({ ownerUserId: laneOwnerId, userId: candidate.id })}
                              className="w-full flex items-center justify-between border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:border-primary/40"
                            >
                              <span>{candidate.email || candidate.firstName || candidate.id}</span>
                              <Plus className="w-3 h-3 text-primary" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {pendingDeleteSession && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setPendingDeleteSession(null)}
        >
          <div
            className="bg-zinc-950 border border-white/10 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg text-white font-display">Delete Session</h3>
            <p className="text-sm text-white/50 mt-2">
              This will remove the session for everyone. This can't be undone.
            </p>
            <div className="mt-6 flex items-center gap-2 justify-end">
              <Button variant="ghost" onClick={() => setPendingDeleteSession(null)}>
                Cancel
              </Button>
              <Button
                className="bg-red-500/80 hover:bg-red-500 text-white"
                onClick={() => {
                  deleteSessionMutation.mutate(pendingDeleteSession.id);
                  setPendingDeleteSession(null);
                }}
              >
                Delete Session
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
