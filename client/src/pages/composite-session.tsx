import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useId, useRef } from "react";
import {
  getCompositeSession,
  getCompositeSessionMessages,
  updateCompositeSessionStep,
  updateCompositeSessionStepContent,
  addCompositeSessionIntel,
  sendCompositeSessionMessage,
  markCompositeSessionMessagesRead,
  deleteCompositeSessionMessage,
  uploadCompositeSessionIntel,
  deleteCompositeSessionIntel,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Users,
  Shield,
  CheckCircle2,
  FileText,
  Plus,
  Loader2,
  Send,
  Edit3,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  CompositeWorkflowWithItems,
  CompositeWorkflowSessionMember,
  CompositeWorkflowSessionAssignment,
  CompositeWorkflowSessionStep,
  CompositeWorkflowSessionIntelDoc,
  CompositeWorkflowSessionAssignmentDelegate,
  CompositeWorkflowSessionLaneDelegate,
  CompositeWorkflowSessionMessage,
  CompositeWorkflowSessionMessageRead,
} from "@shared/schema";

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
  assignments: (CompositeWorkflowSessionAssignment & {
    delegates?: CompositeWorkflowSessionAssignmentDelegate[];
  })[];
  sessionSteps: CompositeWorkflowSessionStep[];
  intelDocs: CompositeWorkflowSessionIntelDoc[];
};

type IntelDocWithFile = CompositeWorkflowSessionIntelDoc & { fileUrl?: string | null };
type SessionChatMessage = CompositeWorkflowSessionMessage & {
  user?: { id: string; username: string | null; email: string | null; firstName: string | null; lastName: string | null } | null;
  reads?: (CompositeWorkflowSessionMessageRead & {
    user?: { id: string; username: string | null; email: string | null; firstName: string | null; lastName: string | null } | null;
  })[];
};

function getDisplayName(member: CompositeWorkflowSessionMember & { user?: any }) {
  const user = member.user;
  if (!user) return member.userId;
  return user.firstName || user.username || user.email || member.userId;
}

export default function CompositeSessionPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const sessionId = parseInt(params.id || "0", 10);
  const fileInputId = useId();

  const { data: session, isLoading } = useQuery<CompositeSessionPayload>({
    queryKey: ["composite-session", sessionId],
    queryFn: () => getCompositeSession(sessionId),
    enabled: !!sessionId,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<SessionChatMessage[]>({
    queryKey: ["composite-session-messages", sessionId],
    queryFn: () => getCompositeSessionMessages(sessionId),
    enabled: !!sessionId,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!sessionId) return;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "session:subscribe", sessionId }));
    });
    ws.addEventListener("message", () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["composite-session-messages", sessionId] });
    });
    return () => {
      ws.close();
    };
  }, [sessionId, queryClient]);

  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isEditingStep, setIsEditingStep] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editObjective, setEditObjective] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [lastReadMessageId, setLastReadMessageId] = useState<number | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);

  const currentMember = session?.members.find((m) => m.userId === user?.id) || null;
  const isOwner = !!(session?.ownerId && session.ownerId === user?.id);
  const canEditSteps = isOwner || !!currentMember?.canEditSteps;
  const canEditIntel = isOwner || !!currentMember?.canEditIntel;
  const canChat = isOwner || !!currentMember?.canChat;

  const compositeSteps = session?.composite?.steps || [];
  const sessionStepsByStepId = useMemo(() => {
    const map = new Map<number, CompositeWorkflowSessionStep>();
    session?.sessionSteps.forEach((s) => map.set(s.stepId, s));
    return map;
  }, [session?.sessionSteps]);

  const assignmentsByStep = useMemo(() => {
    const map = new Map<number, CompositeWorkflowSessionAssignment[]>();
    session?.assignments.forEach((assignment) => {
      const list = map.get(assignment.stepId) || [];
      list.push(assignment);
      map.set(assignment.stepId, list);
    });
    return map;
  }, [session?.assignments]);

  const assignmentsByUser = useMemo(() => {
    const map = new Map<string, CompositeWorkflowSessionAssignment[]>();
    session?.assignments.forEach((assignment) => {
      const list = map.get(assignment.assigneeUserId) || [];
      list.push(assignment);
      map.set(assignment.assigneeUserId, list);
    });
    return map;
  }, [session?.assignments]);

  const laneNextStep = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const member of session?.members || []) {
      const assigned = new Set((assignmentsByUser.get(member.userId) || []).map((a) => a.stepId));
      let nextId: number | null = null;
      for (const step of compositeSteps) {
        if (!assigned.has(step.id)) continue;
        const state = sessionStepsByStepId.get(step.id);
        if (state && !state.isCompleted) {
          nextId = step.id;
          break;
        }
      }
      map.set(member.userId, nextId);
    }
    return map;
  }, [assignmentsByUser, compositeSteps, sessionStepsByStepId, session?.members]);

  const accessibleStepIds = useMemo(() => {
    if (!user?.id) return new Set<number>();
    const accessible = new Set<number>();
    const assignedToUser = new Set((assignmentsByUser.get(user.id) || []).map((a) => a.stepId));
    const nextForUser = laneNextStep.get(user.id) || null;

    for (const step of compositeSteps) {
      const state = sessionStepsByStepId.get(step.id);
      if (state?.isCompleted) {
        accessible.add(step.id);
        continue;
      }
      if (!assignedToUser.has(step.id)) continue;
      if (step.id === nextForUser) {
        accessible.add(step.id);
      }
    }

    for (const assignment of session?.assignments || []) {
      if (assignment.assigneeUserId === user.id) continue;
      if (!assignment.allowDelegation) continue;
      if (assignment.allowDelegationToEveryone) {
        if (laneNextStep.get(assignment.assigneeUserId) === assignment.stepId) {
          accessible.add(assignment.stepId);
        }
        continue;
      }
      const delegates = Array.isArray(assignment.delegates) ? assignment.delegates : [];
      const hasAssignmentDelegates = delegates.length > 0;
      const isAssignmentDelegate = delegates.some((delegate) => delegate.delegateUserId === user.id);
      if (hasAssignmentDelegates && !isAssignmentDelegate) continue;
      if (!hasAssignmentDelegates) {
        const assigneeMember = session?.members.find((m) => m.userId === assignment.assigneeUserId);
        const laneDelegates = Array.isArray(assigneeMember?.laneDelegates) ? assigneeMember.laneDelegates : [];
        const isLaneDelegate = laneDelegates.some((delegate) => delegate.delegateUserId === user.id);
        if (!isLaneDelegate) continue;
      }
      if (laneNextStep.get(assignment.assigneeUserId) === assignment.stepId) {
        accessible.add(assignment.stepId);
      }
    }

    return accessible;
  }, [assignmentsByUser, compositeSteps, laneNextStep, session?.assignments, session?.members, sessionStepsByStepId, user?.id]);

  const accessibleStepsOrdered = useMemo(
    () => compositeSteps.filter((step) => accessibleStepIds.has(step.id)),
    [accessibleStepIds, compositeSteps]
  );

  useEffect(() => {
    if (!session) return;
    if (selectedStepId && accessibleStepIds.has(selectedStepId)) return;
    setSelectedStepId(accessibleStepsOrdered[0]?.id || null);
  }, [session, selectedStepId, accessibleStepIds, accessibleStepsOrdered]);

  const selectedStep = compositeSteps.find((step) => step.id === selectedStepId) || null;
  const selectedSessionStep = selectedStepId ? sessionStepsByStepId.get(selectedStepId) : null;
  const isPhaseCompleted = !!selectedSessionStep?.isCompleted;
  const selectedAssignments = selectedStepId ? assignmentsByStep.get(selectedStepId) || [] : [];
  const visibleIntelDocs = useMemo(
    () => (session?.intelDocs || []).filter((doc) => doc.stepId === selectedStepId),
    [session?.intelDocs, selectedStepId]
  );
  const completedByMember = selectedSessionStep?.completedByUserId
    ? session?.members.find((member) => member.userId === selectedSessionStep.completedByUserId) || null
    : null;

  useEffect(() => {
    if (!selectedStep) return;
    setEditName(selectedStep.name || "");
    setEditDescription(selectedStep.description || "");
    setEditObjective(selectedStep.objective || "");
    setEditInstructions(selectedStep.instructions || "");
  }, [selectedStep]);

  const isStepUnlockedForUser = (userId: string, stepId: number) => laneNextStep.get(userId) === stepId;

  const canCompleteSelectedStep = useMemo(() => {
    if (!selectedStepId || !user?.id || !selectedSessionStep) return false;
    if (selectedSessionStep.isCompleted) return false;

    const assignedToUser = selectedAssignments.some((a) => a.assigneeUserId === user.id);
    if (assignedToUser) {
      return isStepUnlockedForUser(user.id, selectedStepId);
    }

    return selectedAssignments.some((a) => {
      if (a.assigneeUserId === user.id) return false;
      if (!a.allowDelegation) return false;
      if (a.allowDelegationToEveryone) {
        return isStepUnlockedForUser(a.assigneeUserId, selectedStepId);
      }
      const delegates = Array.isArray(a.delegates) ? a.delegates : [];
      const hasAssignmentDelegates = delegates.length > 0;
      const isAssignmentDelegate = delegates.some((delegate) => delegate.delegateUserId === user.id);
      if (hasAssignmentDelegates && !isAssignmentDelegate) return false;
      if (!hasAssignmentDelegates) {
        const assigneeMember = session?.members.find((m) => m.userId === a.assigneeUserId);
        const laneDelegates = Array.isArray(assigneeMember?.laneDelegates) ? assigneeMember.laneDelegates : [];
        const isLaneDelegate = laneDelegates.some((delegate) => delegate.delegateUserId === user.id);
        if (!isLaneDelegate) return false;
      }
      return isStepUnlockedForUser(a.assigneeUserId, selectedStepId);
    });
  }, [selectedStepId, selectedSessionStep, selectedAssignments, user?.id, session?.members, laneNextStep]);

  const completeMutation = useMutation({
    mutationFn: () => updateCompositeSessionStep(sessionId, selectedSessionStep!.id, { isCompleted: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", sessionId] });
    },
  });

  const editStepMutation = useMutation({
    mutationFn: () =>
      updateCompositeSessionStepContent(sessionId, selectedSessionStep!.id, {
        name: editName,
        description: editDescription,
        objective: editObjective,
        instructions: editInstructions,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", sessionId] });
      setIsEditingStep(false);
    },
  });

  const intelMutation = useMutation({
    mutationFn: () => {
      if (docFile) {
        return uploadCompositeSessionIntel(sessionId, {
          stepId: selectedStepId!,
          title: docTitle,
          docType: "note",
          file: docFile,
        });
      }
      return addCompositeSessionIntel(sessionId, {
        stepId: selectedStepId,
        title: docTitle,
        content: docContent,
        docType: "note",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", sessionId] });
      setIsAddingDoc(false);
      setDocTitle("");
      setDocContent("");
      setDocFile(null);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: () => sendCompositeSessionMessage(sessionId, chatInput.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session-messages", sessionId] });
      setChatInput("");
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: number) => deleteCompositeSessionMessage(sessionId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session-messages", sessionId] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (messageIds: number[]) => markCompositeSessionMessagesRead(sessionId, messageIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session-messages", sessionId] });
    },
  });

  useEffect(() => {
    if (!messages || !messages.length || !user?.id) return;
    const unreadIds = messages
      .filter((message) => !(message.reads || []).some((read) => read.userId === user.id))
      .map((message) => message.id);
    if (!unreadIds.length) return;
    const newestId = unreadIds[unreadIds.length - 1];
    if (lastReadMessageId === newestId) return;
    markReadMutation.mutate(unreadIds);
    setLastReadMessageId(newestId);
  }, [messages, user?.id, lastReadMessageId, markReadMutation]);

  useEffect(() => {
    if (!chatListRef.current) return;
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [messages?.length]);

  const toggleLaneDelegationMutation = useMutation({
    mutationFn: () =>
      updateCompositeSessionMember(sessionId, currentMember!.id, {
        allowLaneDelegation: !currentMember?.allowLaneDelegation,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", sessionId] });
    },
  });

  const deleteIntelMutation = useMutation({
    mutationFn: (docId: number) => deleteCompositeSessionIntel(sessionId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", sessionId] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || !session.composite) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-foreground flex flex-col">
      <header className="h-16 border-b border-white/5 bg-black/60 flex items-center justify-between px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.history.back()}
          className="text-white/40 hover:text-white"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Protocols
        </Button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-mono text-white/40 uppercase tracking-widest">
            <Users className="w-4 h-4" />
            Session
          </div>
          <div className="text-white font-display text-sm">{session.name || session.composite.name}</div>
        </div>
        <div className="flex items-center gap-2">
          {session.members.map((member) => (
            <div key={member.id} className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: member.laneColor }} />
              <span className="text-[10px] text-white/40 font-mono uppercase">
                {getDisplayName(member)}
              </span>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/composite-sessions/${session.id}/manage`)}
            className="text-white/50 hover:text-primary"
          >
            Manage
          </Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[300px_1fr_340px]">
        <aside className="border-r border-white/5 bg-black/60 overflow-y-auto">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest">Task Lanes</h2>
          </div>
          <div className="p-4 space-y-6">
            {session.members.map((member) => {
              const assigned = new Set((assignmentsByUser.get(member.userId) || []).map((a) => a.stepId));
              const laneSteps = compositeSteps.filter((step) => assigned.has(step.id));
              const nextStepId = laneNextStep.get(member.userId);

              return (
                <div key={member.id} className="border border-white/5 bg-white/5">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: member.laneColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-white/70 truncate">{getDisplayName(member)}</p>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest">
                        {member.allowLaneDelegation ? "Open Lane" : "Private Lane"}
                      </p>
                    </div>
                    {member.allowLaneDelegation && <Shield className="w-3 h-3 text-primary" />}
                  </div>
                  <div className="p-3 space-y-2">
                    {laneSteps.length === 0 ? (
                      <p className="text-[11px] text-white/30 font-mono">No tasks assigned</p>
                    ) : (
                      laneSteps.map((step, index) => {
                        const state = sessionStepsByStepId.get(step.id);
                        const isDone = !!state?.isCompleted;
                        const isActive = step.id === nextStepId && !isDone;
                        const isAccessible = accessibleStepIds.has(step.id);
                        const stepCompletedBy = state?.completedByUserId
                          ? session?.members.find((member) => member.userId === state.completedByUserId) || null
                          : null;
                        return (
                          <button
                            key={step.id}
                            onClick={() => {
                              if (!isAccessible) return;
                              setSelectedStepId(step.id);
                            }}
                            className={`w-full text-left px-3 py-2 border text-xs transition-all ${isActive
                              ? "border-primary/60 bg-primary/10 text-white"
                              : isDone
                                ? "border-white/10 bg-white/5 text-white/40 line-through"
                                : "border-white/10 text-white/60 hover:border-white/30"
                              } ${!isAccessible ? "cursor-not-allowed opacity-40" : ""}`}
                          >
                            Phase {index + 1}
                            {isDone && stepCompletedBy && (
                              <span className="mt-1 flex items-center gap-2 text-[10px] text-white/40">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stepCompletedBy.laneColor }} />
                                {getDisplayName(stepCompletedBy)}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white/[0.03] to-transparent overflow-y-auto">
          <div className="p-8 border-b border-white/5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-[10px] font-mono text-primary uppercase tracking-widest">
                  Phase {selectedStep ? compositeSteps.findIndex((s) => s.id === selectedStep.id) + 1 : "--"}
                </div>
                <div className="text-xs text-white/40 font-mono uppercase tracking-widest">
                  Shared Session
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentMember && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleLaneDelegationMutation.mutate()}
                    className="text-[10px] text-white/40 hover:text-primary"
                  >
                    {currentMember.allowLaneDelegation ? "Lock My Lane" : "Open My Lane"}
                  </Button>
                )}
                {selectedStep && canEditSteps && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingStep(true)}
                    className="text-white/50 hover:text-primary"
                  >
                    <Edit3 className="w-3 h-3 mr-2" />
                    Edit Phase
                  </Button>
                )}
              </div>
            </div>
            <h1 className="text-3xl font-display text-white mt-4">{selectedStep ? selectedStep.name : "Select a phase"}</h1>
            {selectedStep?.description && (
              <p className="text-white/50 mt-2 max-w-2xl">{selectedStep.description}</p>
            )}
            {selectedSessionStep?.isCompleted && completedByMember && (
              <div className="mt-4 flex items-center gap-2 text-xs text-white/50 font-mono uppercase tracking-widest">
                <span>Completed by</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: completedByMember.laneColor }} />
                  {getDisplayName(completedByMember)}
                </span>
              </div>
            )}
          </div>

          <div className="p-8">
            <div className="bg-black/40 border border-white/5 flex flex-col min-h-[420px] max-h-[calc(100vh-260px)]">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Session Chat</p>
                  <p className="text-sm text-white/70">{session.name || session.composite.name}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3 text-[10px] font-mono text-white/40 uppercase">
                  {session.members.map((member) => (
                    <span key={member.id} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: member.laneColor }} />
                      {getDisplayName(member)}
                    </span>
                  ))}
                </div>
              </div>
              <div ref={chatListRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : !messages || messages.length === 0 ? (
                  <div className="text-center py-10 text-xs text-white/40 font-mono uppercase tracking-widest">
                    No messages yet
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOwn = message.userId === user?.id;
                    const author = message.user;
                    const authorName = author ? (author.firstName || author.username || author.email || message.userId) : message.userId;
                    const readBy = (message.reads || [])
                      .filter((read) => read.userId !== message.userId)
                      .map((read) => read.user?.firstName || read.user?.username || read.user?.email || read.userId);
                    const maxSeen = 3;
                    const seenNames = readBy.slice(0, maxSeen);
                    const seenLabel = isOwn && readBy.length > 0
                      ? `Seen by ${seenNames.join(", ")}${readBy.length > maxSeen ? ` +${readBy.length - maxSeen}` : ""}`
                      : null;
                    return (
                      <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] border px-4 py-3 ${isOwn ? "border-primary/40 bg-primary/10 text-white" : "border-white/10 bg-white/5 text-white/80"}`}>
                          <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                            <span>{authorName}</span>
                            <div className="flex items-center gap-2">
                              <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              {(isOwn || isOwner) && (
                                <button
                                  onClick={() => deleteMessageMutation.mutate(message.id)}
                                  className="text-white/40 hover:text-red-400"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="mt-2 text-sm whitespace-pre-wrap">{message.content}</p>
                          {seenLabel && (
                            <p className="mt-2 text-[10px] text-white/40 font-mono uppercase tracking-widest">
                              {seenLabel}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="border-t border-white/5 p-4 flex items-center gap-3">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && chatInput.trim()) {
                      e.preventDefault();
                      if (!canChat) return;
                      sendMessageMutation.mutate();
                    }
                  }}
                  placeholder={canChat ? "Write a message..." : "Chat permissions required"}
                  disabled={!canChat}
                  className="flex-1 bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                />
                <Button
                  onClick={() => sendMessageMutation.mutate()}
                  disabled={!canChat || !chatInput.trim() || sendMessageMutation.isPending}
                  className="h-9 w-9 p-0 bg-primary text-black hover:bg-primary/90"
                >
                  {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </main>

        <aside className="border-l border-white/5 bg-black/60 flex flex-col">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <h2 className="text-xs font-mono text-white/80 uppercase tracking-widest">Intel</h2>
            </div>
            {canEditIntel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingDoc(true)}
                disabled={!selectedStepId}
                className="text-primary hover:bg-primary/10 h-7 px-2"
              >
                <Plus className="w-3 h-3" />
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence>
              {isAddingDoc && selectedStepId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/5 border border-white/10 p-4 space-y-3"
                >
                  <input
                    type="text"
                    placeholder="Title"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                  />
                  <textarea
                    placeholder="Content"
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary min-h-[100px] resize-none"
                    disabled={!!docFile}
                  />
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor={fileInputId}
                      className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Upload File
                    </label>
                    <input
                      id={fileInputId}
                      type="file"
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <span className="text-[11px] text-white/40 truncate">
                      {docFile ? docFile.name : "No file selected"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => intelMutation.mutate()}
                      disabled={!docTitle || (!docContent && !docFile) || intelMutation.isPending}
                      className="bg-primary text-black"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsAddingDoc(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!selectedStepId ? (
              <div className="text-center py-8 border border-dashed border-white/10 opacity-40">
                <p className="text-xs font-mono uppercase tracking-widest">Select a phase</p>
              </div>
            ) : visibleIntelDocs.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-white/10 opacity-40">
                <p className="text-xs font-mono uppercase tracking-widest">No Intel Yet</p>
              </div>
            ) : (
              (visibleIntelDocs as IntelDocWithFile[]).map((doc, index) => {
                const hasImagePreview = !!doc.fileUrl && !!doc.mimeType && doc.mimeType.startsWith("image/");
                const fallbackNameMatch = doc.content?.startsWith("Attached file: ")
                  ? doc.content.replace("Attached file: ", "")
                  : null;
                const displayFileName = doc.fileName || fallbackNameMatch;
                const extension = displayFileName?.split(".").pop()?.toLowerCase();
                const fileLabel =
                  doc.mimeType === "application/pdf"
                    ? "PDF"
                    : doc.mimeType === "application/msword" || doc.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      ? "DOC"
                      : doc.mimeType === "application/vnd.ms-excel" || doc.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        ? "XLS"
                        : doc.mimeType === "application/vnd.ms-powerpoint" || doc.mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                          ? "PPT"
                          : doc.mimeType === "application/json"
                            ? "JSON"
                            : doc.mimeType === "application/rtf"
                              ? "RTF"
                              : doc.mimeType?.startsWith("text/")
                                ? "TXT"
                                : extension && ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "json", "rtf", "txt"].includes(extension)
                                  ? extension.toUpperCase()
                                  : "FILE";
                const fileSizeLabel = doc.fileSize ? `${Math.max(1, Math.round(doc.fileSize / 1024))} KB` : null;

                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white/5 border border-white/10 p-4"
                  >
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-medium text-white truncate">{doc.title}</h4>
                      </div>
                      {canEditIntel && (
                        <button
                          onClick={() => deleteIntelMutation.mutate(doc.id)}
                          className="text-white/30 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-white/60 mb-3 line-clamp-3">{doc.content}</p>
                    {hasImagePreview && (
                      <div className="mb-3 border border-white/10 bg-black/40 p-2">
                        <img
                          src={doc.fileUrl ?? undefined}
                          alt={doc.fileName || "Attachment preview"}
                          className="max-h-36 w-full object-contain"
                        />
                      </div>
                    )}
                    {!hasImagePreview && (doc.fileUrl || displayFileName) && (
                      doc.fileUrl ? (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-2 flex items-center gap-3 border border-white/10 bg-emerald-900/30 px-3 py-2 text-white/80 hover:border-emerald-400/60"
                        >
                          <div className="flex h-7 w-7 items-center justify-center bg-red-600 text-[9px] font-bold text-white">
                            {fileLabel}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs text-white">{displayFileName || "Attachment"}</p>
                            <p className="text-[10px] text-white/50">
                              {fileLabel}{fileSizeLabel ? ` - ${fileSizeLabel}` : ""}
                            </p>
                          </div>
                        </a>
                      ) : (
                        <div className="mb-2 flex items-center gap-3 border border-white/10 bg-emerald-900/30 px-3 py-2 text-white/60">
                          <div className="flex h-7 w-7 items-center justify-center bg-red-600 text-[9px] font-bold text-white">
                            {fileLabel}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs text-white">{displayFileName || "Attachment"}</p>
                            <p className="text-[10px] text-white/50">
                              {fileLabel}{fileSizeLabel ? ` - ${fileSizeLabel}` : ""}
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </motion.div>
                );
              })
            )}
          </div>

          <div className="border-t border-white/5 p-4">
            <Button
              onClick={() => completeMutation.mutate()}
              disabled={!selectedStepId || isPhaseCompleted || !canCompleteSelectedStep || completeMutation.isPending}
              className={`w-full h-12 font-mono uppercase tracking-widest ${isPhaseCompleted ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-primary hover:bg-primary/90 text-black"}`}
            >
              {completeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              {isPhaseCompleted ? "Phase Completed" : "Complete Phase"}
            </Button>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {isEditingStep && selectedStep && selectedSessionStep && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4"
            onClick={() => setIsEditingStep(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-white/10 w-full max-w-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-white font-display">Edit Phase</h3>
                <Button variant="ghost" size="sm" onClick={() => setIsEditingStep(false)}>
                  <X className="w-4 h-4 text-white/40" />
                </Button>
              </div>
              <div className="space-y-3">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Phase name"
                  className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                />
                <input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description"
                  className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                />
                <input
                  value={editObjective}
                  onChange={(e) => setEditObjective(e.target.value)}
                  placeholder="Objective"
                  className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                />
                <textarea
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="Instructions"
                  className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary min-h-[140px] resize-none"
                />
              </div>
              <div className="flex gap-2 mt-5">
                <Button
                  onClick={() => editStepMutation.mutate()}
                  disabled={editStepMutation.isPending || !editName}
                  className="flex-1 bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
                >
                  {editStepMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="ghost" onClick={() => setIsEditingStep(false)}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
