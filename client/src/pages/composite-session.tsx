import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useId, useRef } from "react";
import type React from "react";
import "emoji-picker-element";
import {
  getCompositeSession,
  getCompositeSessionMessages,
  updateCompositeSessionStep,
  updateCompositeSessionStepContent,
  updateCompositeSessionMember,
  addCompositeSessionIntel,
  submitSessionProof,
  uploadSessionProof,
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
  Smile,
  ArrowRight,
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
  const proofFileInputId = useId();

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
    setWsStatus("connecting");
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    ws.addEventListener("open", () => {
      setWsStatus("open");
      ws.send(JSON.stringify({ type: "session:subscribe", sessionId }));
      setLastWsEvent("subscribe_sent");
    });
    ws.addEventListener("error", () => {
      setWsStatus("error");
    });
    ws.addEventListener("close", () => {
      setWsStatus("closed");
    });
    ws.addEventListener("message", (event) => {
      const handle = async () => {
        let raw = "";
        if (typeof event.data === "string") {
          raw = event.data;
        } else if (event.data?.text) {
          raw = await event.data.text();
        } else if (event.data?.toString) {
          raw = event.data.toString();
        }
        if (!raw) return;
        setLastWsEvent("message_received");
        try {
          const payload = JSON.parse(raw);
          setLastWsEvent(payload?.type || "message");
          if (payload?.type === "session:chat_message" && payload.message) {
            queryClient.setQueryData(
              ["composite-session-messages", sessionId],
              (data: SessionChatMessage[] | undefined) => {
                const existing = data || [];
                const already = existing.some((item) => item.id === payload.message.id);
                if (already) return existing;
                if (payload.message.userId === user?.id) {
                  const trimmed = String(payload.message.content || "").trim();
                  const withoutTemp = existing.filter((item) => {
                    if (item.id >= 0) return true;
                    const sameContent = String(item.content || "").trim() === trimmed;
                    const timeGap = Math.abs(new Date(item.createdAt).getTime() - new Date(payload.message.createdAt).getTime());
                    return !(sameContent && timeGap < 60_000);
                  });
                  return [...withoutTemp, payload.message];
                }
                return [...existing, payload.message];
              }
            );
            return;
          }
          if (payload?.type === "session:chat_deleted" && payload.messageId) {
            queryClient.setQueryData(
              ["composite-session-messages", sessionId],
              (data: SessionChatMessage[] | undefined) =>
                (data || []).filter((item) => item.id !== payload.messageId)
            );
            return;
          }
          if (payload?.type === "session:chat_read" && Array.isArray(payload.messageIds)) {
            const reader = session?.members.find((member) => member.userId === payload.userId)?.user || null;
            queryClient.setQueryData(
              ["composite-session-messages", sessionId],
              (data: SessionChatMessage[] | undefined) => {
                if (!data) return data;
                return data.map((message) => {
                  if (!payload.messageIds.includes(message.id)) return message;
                  const existingReads = message.reads || [];
                  if (existingReads.some((read) => read.userId === payload.userId)) return message;
                  return {
                    ...message,
                    reads: [
                      ...existingReads,
                      {
                        id: Date.now(),
                        messageId: message.id,
                        userId: payload.userId,
                        readAt: new Date().toISOString(),
                        user: reader,
                      },
                    ],
                  };
                });
              }
            );
            return;
          }
          if (payload?.type === "session:step_updated") {
            queryClient.invalidateQueries({ queryKey: ["composite-session", sessionId] });
            return;
          }
          if (payload?.type === "session:intel_added" || payload?.type === "session:intel_removed") {
            queryClient.invalidateQueries({ queryKey: ["composite-session", sessionId] });
            return;
          }
          if (payload?.type?.startsWith("session:member_") || payload?.type?.startsWith("session:assignment_")) {
            queryClient.invalidateQueries({ queryKey: ["composite-session", sessionId] });
            return;
          }
          if (payload?.type === "session:proof_submitted") {
            queryClient.invalidateQueries({ queryKey: ["composite-session", sessionId] });
            return;
          }
        } catch {
          // no-op
        }
        queryClient.invalidateQueries({ queryKey: ["composite-session", sessionId] });
        queryClient.invalidateQueries({ queryKey: ["composite-session-messages", sessionId] });
      };
      void handle();
    });
    return () => {
      ws.close();
    };
  }, [sessionId, queryClient, session?.members]);

  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isEditingStep, setIsEditingStep] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [wsStatus, setWsStatus] = useState<"idle" | "connecting" | "open" | "closed" | "error">("idle");
  const [lastWsEvent, setLastWsEvent] = useState<string>("");
  const [activeCenterView, setActiveCenterView] = useState<"chat" | "submission">("chat");
  const [proofContent, setProofContent] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isEditingProof, setIsEditingProof] = useState(false);
  const [lastReadMessageId, setLastReadMessageId] = useState<number | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);

  const currentMember = session?.members.find((m) => m.userId === user?.id) || null;
  const isOwner = !!(session?.ownerId && session.ownerId === user?.id);
  const canEditSteps = isOwner || !!currentMember?.canEditSteps;
  const canEditIntel = isOwner || !!currentMember?.canEditIntel;
  const canEditProof = isOwner || !!currentMember?.canEditProof;
  const canChat = isOwner || !!currentMember?.canChat;

  const compositeSteps = session?.composite?.steps || [];
  const sessionStepsByStepId = useMemo(() => {
    const map = new Map<number, CompositeWorkflowSessionStep>();
    session?.sessionSteps.forEach((s) => map.set(s.stepId, s));
    return map;
  }, [session?.sessionSteps]);

  const assignmentsByStep = useMemo(() => {
    const map = new Map<number, (CompositeWorkflowSessionAssignment & { delegates?: CompositeWorkflowSessionAssignmentDelegate[] })[]>();
    session?.assignments.forEach((assignment) => {
      const list = map.get(assignment.stepId) || [];
      list.push(assignment);
      map.set(assignment.stepId, list);
    });
    return map;
  }, [session?.assignments]);

  const assignmentsByUser = useMemo(() => {
    const map = new Map<string, (CompositeWorkflowSessionAssignment & { delegates?: CompositeWorkflowSessionAssignmentDelegate[] })[]>();
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
    if (isOwner) {
      compositeSteps.forEach(s => accessible.add(s.id));
      return accessible;
    }
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
  const selectedStepIndex = selectedStepId
    ? compositeSteps.findIndex((step) => step.id === selectedStepId)
    : -1;
  const hasNextPhase = selectedStepIndex >= 0 && selectedStepIndex < compositeSteps.length - 1;
  const nextStepId = hasNextPhase ? compositeSteps[selectedStepIndex + 1]?.id ?? null : null;
  const laneStepsForUser = useMemo(() => {
    if (!user?.id) return [];
    const assigned = new Set((assignmentsByUser.get(user.id) || []).map((a) => a.stepId));
    return compositeSteps.filter((step) => assigned.has(step.id));
  }, [assignmentsByUser, compositeSteps, user?.id]);
  const selectedLaneIndex = selectedStepId
    ? laneStepsForUser.findIndex((step) => step.id === selectedStepId)
    : -1;
  const hasNextLanePhase = selectedLaneIndex >= 0 && selectedLaneIndex < laneStepsForUser.length - 1;
  const nextLaneStepId = hasNextLanePhase ? laneStepsForUser[selectedLaneIndex + 1]?.id ?? null : null;

  useEffect(() => {
    if (!session) return;
    if (selectedStepId && accessibleStepIds.has(selectedStepId)) return;
    setSelectedStepId(accessibleStepsOrdered[0]?.id || null);
  }, [session, selectedStepId, accessibleStepIds, accessibleStepsOrdered]);

  const selectedStep = compositeSteps.find((step) => step.id === selectedStepId) || null;
  const selectedSessionStep = selectedStepId ? sessionStepsByStepId.get(selectedStepId) : null;
  const isPhaseCompleted = !!selectedSessionStep?.isCompleted;
  const isProofRequired = !!selectedSessionStep?.proofRequired;
  const isProofSatisfied = !isProofRequired || !!selectedSessionStep?.proofContent || !!selectedSessionStep?.proofFilePath;
  const isProofSubmitted = !!selectedSessionStep?.proofSubmittedAt || !!selectedSessionStep?.proofContent || !!selectedSessionStep?.proofFilePath;
  const proofFileUrl = (selectedSessionStep as any)?.proofFileUrl as string | null | undefined;
  const emojiPickerRef = useRef<HTMLElement | null>(null);
  const emojiPickerContainerRef = useRef<HTMLDivElement | null>(null);
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
  }, [selectedStep]);

  useEffect(() => {
    if (!selectedSessionStep) return;
    setProofContent(selectedSessionStep.proofContent || "");
    setProofFile(null);
    if (!selectedSessionStep.proofRequired) {
      setIsEditingProof(false);
      return;
    }
    setIsEditingProof(!selectedSessionStep.proofSubmittedAt);
  }, [selectedSessionStep]);

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

  const submitProofMutation = useMutation({
    mutationFn: () => {
      if (!selectedSessionStep) {
        throw new Error("No session step selected");
      }
      if (proofFile) {
        return uploadSessionProof(sessionId, selectedSessionStep.id, {
          content: proofContent.trim() || undefined,
          file: proofFile,
        });
      }
      return submitSessionProof(sessionId, selectedSessionStep.id, {
        content: proofContent.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-session", sessionId] });
      setProofFile(null);
      setIsEditingProof(false);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => sendCompositeSessionMessage(sessionId, content),
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey: ["composite-session-messages", sessionId] });
      const previous = queryClient.getQueryData<SessionChatMessage[]>(["composite-session-messages", sessionId]) || [];
      const tempId = -Date.now();
      const optimistic: SessionChatMessage = {
        id: tempId,
        sessionId,
        userId: user?.id || "me",
        content,
        createdAt: new Date(),
        user: currentMember?.user || user || null,
        reads: [],
      };
      queryClient.setQueryData(["composite-session-messages", sessionId], [...previous, optimistic]);
      setChatInput("");
      return { previous, tempId };
    },
    onError: (_err, _content, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["composite-session-messages", sessionId], context.previous);
      }
    },
    onSuccess: (message, _content, context) => {
      queryClient.setQueryData(
        ["composite-session-messages", sessionId],
        (data: SessionChatMessage[] | undefined) => {
          const existing = data || [];
          if (context?.tempId == null) {
            return existing;
          }
          const withoutTemp = existing.filter((item) => item.id !== context.tempId);
          const already = withoutTemp.some((item) => item.id === message.id);
          return already ? withoutTemp : [...withoutTemp, message];
        }
      );
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: number) => deleteCompositeSessionMessage(sessionId, messageId),
    onMutate: async (messageId: number) => {
      await queryClient.cancelQueries({ queryKey: ["composite-session-messages", sessionId] });
      const previous = queryClient.getQueryData<SessionChatMessage[]>(["composite-session-messages", sessionId]) || [];
      queryClient.setQueryData(
        ["composite-session-messages", sessionId],
        previous.filter((message) => message.id !== messageId)
      );
      return { previous };
    },
    onError: (_err, _messageId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["composite-session-messages", sessionId], context.previous);
      }
    },
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

  useEffect(() => {
    if (!showEmojiPicker) return;
    const picker = emojiPickerRef.current;
    if (!picker) return;
    const handleEmojiClick = (event: any) => {
      const emoji = event?.detail?.unicode || event?.detail?.emoji;
      if (!emoji) return;
      setChatInput((prev) => `${prev}${emoji}`);
    };
    picker.addEventListener("emoji-click", handleEmojiClick);
    return () => picker.removeEventListener("emoji-click", handleEmojiClick);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowEmojiPicker(false);
      }
    };
    const handleOutsideClick = (event: MouseEvent) => {
      const container = emojiPickerContainerRef.current;
      if (!container) return;
      if (!container.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showEmojiPicker]);

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
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/sessions`)}
            className="text-white/40 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Sessions
          </Button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">
              <Users className="w-3 h-3" />
              Session
            </div>
            <div className="text-white font-display text-sm">{session.name || session.composite.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveCenterView("chat")}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest border ${activeCenterView === "chat" ? "border-primary/60 text-primary bg-primary/10" : "border-white/10 text-white/40 hover:text-white"
              }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveCenterView("submission")}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest border ${activeCenterView === "submission" ? "border-primary/60 text-primary bg-primary/10" : "border-white/10 text-white/40 hover:text-white"
              }`}
          >
            Submission
          </button>
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
            onClick={() => navigate(`/sessions/${session.id}/manage`)}
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
                        const isSelected = step.id === selectedStepId;
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
                            className={`w-full text-left px-3 py-2 border text-xs transition-all ${
                              isSelected
                                ? "border-primary/80 bg-primary/20 text-white"
                                : isActive
                                  ? "border-primary/60 bg-primary/10 text-white"
                                  : isDone
                                    ? "border-white/10 bg-white/5 text-white/40 line-through"
                                    : "border-white/10 text-white/60 hover:border-white/30"
                              } ${!isAccessible ? "cursor-not-allowed opacity-40" : ""}`}
                          >
                            Phase {index + 1}: {step.name}
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
          <div className="px-6 py-4 border-b border-white/5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-[10px] font-mono text-primary uppercase tracking-widest">
                  Phase {selectedStep ? compositeSteps.findIndex((s) => s.id === selectedStep.id) + 1 : "--"}
                </div>
                <div className="text-xs text-white/40 font-mono uppercase tracking-widest">
                  Shared Session
                </div>
                {selectedStep?.workflowName && (
                  <div className="text-[10px] text-white/40 font-mono uppercase tracking-widest bg-white/5 px-2 py-0.5 border border-white/10">
                    Source: STEP {selectedStep.stepNumber} {selectedStep.workflowName}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {currentMember && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleLaneDelegationMutation.mutate()}
                    className="text-[10px] text-white/40 hover:text-primary"
                  >
                    {currentMember.allowLaneDelegation ? "Lane Opened" : "Open My Lane"}
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
            <div className="mt-3 flex items-start justify-between gap-6">
              <h1 className="text-2xl font-display text-white">
                {selectedStep
                  ? `PHASE ${compositeSteps.findIndex((s) => s.id === selectedStep.id) + 1}: ${selectedStep.name}`
                  : "Select a phase"}
              </h1>
              {selectedSessionStep?.isCompleted && completedByMember && (
                <div className="text-right max-w-xs">
                  <div className="mt-2 flex items-center justify-end gap-2 text-xs text-white/50 font-mono uppercase tracking-widest">
                    <span>Completed by</span>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: completedByMember.laneColor }} />
                      {getDisplayName(completedByMember)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4">
            {activeCenterView === "chat" ? (
              <div className="bg-black/40 border border-white/5 flex flex-col min-h-[480px] max-h-[calc(100vh-220px)]">
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
                      const authorId = author?.id || message.userId;
                      const authorInitials = (authorName || "U").slice(0, 1).toUpperCase();
                      const authorAvatar = (author as any)?.profileImageUrl || "";
                      const readBy = (message.reads || [])
                        .filter((read) => read.userId !== message.userId && read.userId !== user?.id)
                        .map((read) => read.user?.firstName || read.user?.username || read.user?.email || read.userId);
                      const maxSeen = 3;
                      const seenNames = readBy.slice(0, maxSeen);
                      const seenLabel = isOwn && readBy.length > 0
                        ? `Seen by ${seenNames.join(", ")}${readBy.length > maxSeen ? ` +${readBy.length - maxSeen}` : ""}`
                        : null;
                      return (
                        <div key={message.id} className={`flex items-start gap-3 ${isOwn ? "justify-end" : "justify-start"}`}>
                          {!isOwn && (
                            <button
                              type="button"
                              onClick={() => navigate(`/profile/${authorId}`)}
                              className="h-9 w-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-xs font-mono text-white/60 overflow-hidden"
                              aria-label={`View ${authorName} profile`}
                            >
                              {authorAvatar ? (
                                <img src={authorAvatar} alt={authorName} className="h-full w-full object-cover" />
                              ) : (
                                authorInitials
                              )}
                            </button>
                          )}
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
                          {isOwn && (
                            <button
                              type="button"
                              onClick={() => navigate(`/profile/${authorId}`)}
                              className="h-9 w-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-xs font-mono text-white/60 overflow-hidden"
                              aria-label={`View ${authorName} profile`}
                            >
                              {authorAvatar ? (
                                <img src={authorAvatar} alt={authorName} className="h-full w-full object-cover" />
                              ) : (
                                authorInitials
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="border-t border-white/5 p-4 flex items-center gap-3 relative">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white/60 hover:text-white hover:border-white/30 flex items-center justify-center"
                      aria-label="Add emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    {showEmojiPicker && (
                      <div
                        ref={emojiPickerContainerRef}
                        className="absolute bottom-12 left-0 z-20 border border-white/10 bg-zinc-950 shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
                      >
                        <emoji-picker
                          ref={emojiPickerRef as any}
                          class="bg-zinc-950"
                          style={{ "--emoji-size": "20px", "--num-columns": "8" } as React.CSSProperties}
                        />
                      </div>
                    )}
                  </div>
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && chatInput.trim()) {
                        e.preventDefault();
                        if (!canChat) return;
                        sendMessageMutation.mutate(chatInput.trim());
                      }
                    }}
                    placeholder={canChat ? "Write a message..." : "Chat permissions required"}
                    disabled={!canChat}
                    className="flex-1 bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                  />
                  <Button
                    onClick={() => sendMessageMutation.mutate(chatInput.trim())}
                    disabled={!canChat || !chatInput.trim() || sendMessageMutation.isPending}
                    className="h-9 w-9 p-0 bg-primary text-black hover:bg-primary/90"
                  >
                    {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-black/40 border border-white/5 flex flex-col min-h-[480px] max-h-[calc(100vh-220px)]">
                <div className="flex-1 overflow-y-auto p-5 flex flex-col">
                  <div className="border border-white/10 bg-white/5 p-4 space-y-4 flex-1 flex flex-col">
                    <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Phase Brief</p>
                    <div>
                      <h3 className="text-lg text-white">{selectedStep?.name || "Phase overview"}</h3>
                      <p className="text-sm text-white/50 mt-2">{selectedStep?.description || "Add a phase description."}</p>
                    </div>
                    <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                      Submission{isProofRequired ? ": Proofs are required for this phase" : ""}
                    </p>
                    <textarea
                      value={proofContent}
                      onChange={(e) => setProofContent(e.target.value)}
                      placeholder={isProofRequired ? "Write your proof..." : "No proof needed"}
                      disabled={!canEditProof || !isProofRequired || (!isEditingProof && isProofSubmitted)}
                      className="w-full flex-1 bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary min-h-[140px] resize-none disabled:opacity-40"
                    />
                    {(proofFile || proofFileUrl) && (
                      <div className="text-xs text-white/50">
                        {proofFileUrl ? (
                          <a href={proofFileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            View current attachment
                          </a>
                        ) : (
                          <span>Selected file: {proofFile?.name}</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-auto">
                      <Button
                        onClick={() => {
                          if (!isProofRequired) return;
                          if (isProofSubmitted && !isEditingProof) {
                            setIsEditingProof(true);
                            return;
                          }
                          submitProofMutation.mutate();
                        }}
                        disabled={
                          !isProofRequired ||
                          !canEditProof ||
                          submitProofMutation.isPending ||
                          (!(isProofSubmitted && !isEditingProof) && !proofContent.trim() && !proofFile)
                        }
                        className="flex-1 h-11 bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
                      >
                        {submitProofMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        {isProofSubmitted && !isEditingProof ? "Edit Proofs" : "Submit Proofs"}
                      </Button>
                      <label
                        htmlFor={proofFileInputId}
                        className={`h-11 px-4 border border-white/10 text-xs font-mono uppercase tracking-widest flex items-center justify-center cursor-pointer ${!isProofRequired || !canEditProof || (isProofSubmitted && !isEditingProof) ? "opacity-40 cursor-not-allowed" : "hover:border-primary/50"
                          }`}
                      >
                        Upload
                      </label>
                      <input
                        id={proofFileInputId}
                        type="file"
                        accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json,text/*,application/rtf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                        disabled={!isProofRequired || !canEditProof || (isProofSubmitted && !isEditingProof)}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
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

          <div className="border-t border-white/5 p-4 space-y-3">
            <Button
              onClick={() => completeMutation.mutate()}
              disabled={!selectedStepId || isPhaseCompleted || !canCompleteSelectedStep || completeMutation.isPending || !isProofSatisfied}
              className={`w-full h-12 font-mono uppercase tracking-widest ${isPhaseCompleted ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-primary hover:bg-primary/90 text-black"}`}
            >
              {completeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              {isPhaseCompleted ? "Phase Completed" : "Complete Phase"}
            </Button>
            {isPhaseCompleted && hasNextLanePhase && nextLaneStepId && (
              <Button
                onClick={() => setSelectedStepId(nextLaneStepId)}
                className="w-full h-11 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-mono text-[10px] uppercase tracking-[0.2em]"
              >
                Advance to Next Phase
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
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
