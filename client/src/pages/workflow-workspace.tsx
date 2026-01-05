import { useParams, useLocation } from "wouter";
import { useEffect, useState, useId } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkflow, getStep, startStep, completeStep, advanceWorkflow, requestApproval, addIntelDoc, uploadIntelDoc, submitStepProof, uploadStepProof, updateStep } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Lock,
  CheckCircle2,
  Circle,
  Play,
  Clock,
  AlertCircle,
  FileText,
  Plus,
  Send,
  Target,
  ArrowRight,
  Loader2,
  Shield,
  Zap,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Step, StepWithDetails, IntelDoc } from "@shared/schema";

type IntelDocWithFile = IntelDoc & { fileUrl?: string | null };

const statusConfig: Record<string, { icon: typeof Lock; color: string; label: string; bg: string }> = {
  locked: { icon: Lock, color: "text-white/30", label: "Locked", bg: "bg-white/5" },
  active: { icon: Circle, color: "text-primary", label: "Ready", bg: "bg-primary/10" },
  in_progress: { icon: Play, color: "text-amber-400", label: "In Progress", bg: "bg-amber-400/10" },
  pending_approval: { icon: Clock, color: "text-purple-400", label: "Awaiting Approval", bg: "bg-purple-400/10" },
  completed: { icon: CheckCircle2, color: "text-green-400", label: "Completed", bg: "bg-green-400/10" },
};

function JourneyPath({
  steps,
  currentStepId,
  onSelectStep,
  workflowName
}: {
  steps: Step[];
  currentStepId: number | null;
  onSelectStep: (step: Step) => void;
  workflowName: string;
}) {
  return (
    <div className="h-full flex flex-col bg-black/40 border-r border-white/5">
      <div className="p-6 border-b border-white/5">
        <h2 className="font-display text-lg text-white/90 tracking-wide">{workflowName}</h2>
        <p className="text-xs text-white/40 mt-1 font-mono uppercase tracking-widest">Journey Path</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="relative">
          <div className="absolute left-[19px] top-4 bottom-4 w-px bg-gradient-to-b from-primary/50 via-white/10 to-white/5" />

          <div className="space-y-2">
            {steps.map((step, index) => {
              const config = statusConfig[step.status] || statusConfig.locked;
              const Icon = config.icon;
              const isActive = step.id === currentStepId;
              const isClickable = step.status !== "locked";

              return (
                <motion.button
                  key={step.id}
                  onClick={() => isClickable && onSelectStep(step)}
                  disabled={!isClickable}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    w-full flex items-start gap-3 p-3 rounded-none text-left transition-all relative
                    ${isActive ? "bg-primary/10 border-l-2 border-primary" : "border-l-2 border-transparent"}
                    ${isClickable ? "hover:bg-white/5 cursor-pointer" : "cursor-not-allowed opacity-60"}
                  `}
                  data-testid={`step-nav-${step.id}`}
                >
                  <div className={`relative z-10 p-1.5 rounded-none ${config.bg}`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-white/30 uppercase">SEQ-0{index + 1}</span>
                      {step.requiresApproval && (
                        <Shield className="w-3 h-3 text-purple-400" />
                      )}
                    </div>
                    <p className={`text-sm mt-0.5 truncate ${isActive ? "text-white" : "text-white/70"}`}>
                      {step.name}
                    </p>
                    <p className={`text-xs mt-0.5 ${config.color}`}>{config.label}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {isEditingStep && stepDetails && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4"
          onClick={() => setIsEditingStep(false)}
        >
          <div
            className="bg-black/90 border border-white/10 p-6 w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-white font-display">Edit Step</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsEditingStep(false)}>
                <ChevronLeft className="w-4 h-4 text-white/40 rotate-180" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Title</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-2 w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-2 w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary min-h-[90px] resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button
                onClick={() => editStepMutation.mutate()}
                disabled={editStepMutation.isPending || !editName.trim()}
                className="flex-1 bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
              >
                {editStepMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="ghost" onClick={() => setIsEditingStep(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExecutionCenter({
  step,
  isLoading,
  proofContent,
  onProofContentChange,
  proofFile,
  proofFileUrl,
  onSelectProofFile,
  isProofRequired,
  isProofSubmitted,
  isEditingProof,
  onToggleEditProof,
  onSubmitProof,
  onEditStep,
  canEditStep,
  canEditProof,
  isSubmittingProof,
  proofFileInputId,
  onStartStep,
  onCompleteStep,
  onRequestApproval,
  onNextStep,
  isActionPending,
  isProofSatisfied,
}: {
  step: StepWithDetails | null;
  isLoading: boolean;
  proofContent: string;
  onProofContentChange: (value: string) => void;
  proofFile: File | null;
  proofFileUrl?: string | null;
  onSelectProofFile: (file: File | null) => void;
  isProofRequired: boolean;
  isProofSubmitted: boolean;
  isEditingProof: boolean;
  onToggleEditProof: () => void;
  onSubmitProof: () => void;
  onEditStep: () => void;
  canEditStep: boolean;
  canEditProof: boolean;
  isSubmittingProof: boolean;
  proofFileInputId: string;
  onStartStep: () => void;
  onCompleteStep: () => void;
  onRequestApproval: () => void;
  onNextStep?: () => void;
  isActionPending: boolean;
  isProofSatisfied: boolean;
}) {
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!step) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Target className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <p className="text-white/40">Select a step to begin</p>
        </div>
      </div>
    );
  }

  const config = statusConfig[step.status] || statusConfig.locked;
  const Icon = config.icon;

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-white/5 bg-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${config.bg}`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div>
              <h1 className="font-display text-2xl text-white tracking-wide">
                STEP {step.stepNumber}: {step.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEditStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEditStep}
                className="text-white/50 hover:text-primary"
              >
                Edit Step
              </Button>
            )}
            <div className={`px-3 py-1.5 ${config.bg} ${config.color} text-xs font-mono uppercase tracking-wider flex items-center gap-2`}>
              <Icon className="w-3 h-3" />
              {config.label}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Step Brief</p>
            <span className={`text-[10px] font-mono uppercase tracking-widest ${isProofRequired ? "text-primary" : "text-white/30"}`}>
              {isProofRequired ? "Proof required" : "Proof optional"}
            </span>
          </div>
          <h3 className="text-lg text-white mt-3">{step.name}</h3>
          <p className="text-sm text-white/50 mt-2">{step.description || "Add a step description."}</p>
          {!isProofRequired && (
            <p className="text-[10px] text-white/30 mt-3 font-mono uppercase tracking-widest">
              Proof not required for this step.
            </p>
          )}
        </div>

        <div className="border border-white/10 bg-white/5 p-5 space-y-3">
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
            Submission{isProofRequired ? ": Proofs are required for this step" : ""}
          </p>
          <textarea
            value={proofContent}
            onChange={(e) => onProofContentChange(e.target.value)}
            placeholder={isProofRequired ? "Write your proof..." : "No proof needed"}
            disabled={!canEditProof || !isProofRequired || (!isEditingProof && isProofSubmitted)}
            className="w-full bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary min-h-[180px] resize-none disabled:opacity-40"
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
        </div>

        <div className="border border-white/10 bg-white/5 p-5 flex items-center gap-3">
          <Button
            onClick={() => {
              if (!isProofRequired) return;
              if (isProofSubmitted && !isEditingProof) {
                onToggleEditProof();
                return;
              }
              onSubmitProof();
            }}
            disabled={
              !isProofRequired ||
              !canEditProof ||
              isSubmittingProof ||
              (!(isProofSubmitted && !isEditingProof) && !proofContent.trim() && !proofFile)
            }
            className="flex-1 h-12 bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
          >
            {isSubmittingProof ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {isProofSubmitted && !isEditingProof ? "Edit Proofs" : "Submit Proofs"}
          </Button>
          <label
            htmlFor={proofFileInputId}
            className={`h-12 px-4 border border-white/10 text-xs font-mono uppercase tracking-widest flex items-center justify-center cursor-pointer ${!isProofRequired || !canEditProof || (isProofSubmitted && !isEditingProof) ? "opacity-40 cursor-not-allowed" : "hover:border-primary/50"
              }`}
          >
            Upload
          </label>
          <input
            id={proofFileInputId}
            type="file"
            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json,text/*,application/rtf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            onChange={(e) => onSelectProofFile(e.target.files?.[0] || null)}
            disabled={!isProofRequired || !canEditProof || (isProofSubmitted && !isEditingProof)}
            className="hidden"
          />
        </div>
      </div>
      <div className="border-t border-white/5 p-4 bg-black/30">
        <div className="space-y-3">
          {step.status === "active" && (
            <Button
              onClick={onStartStep}
              disabled={isActionPending}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
              data-testid="button-start-step"
            >
              {isActionPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Begin Step
            </Button>
          )}

          {step.status === "in_progress" && !step.requiresApproval && (
            <Button
              onClick={onCompleteStep}
              disabled={isActionPending || !isProofSatisfied}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
              data-testid="button-complete-step"
            >
              {isActionPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Complete Step
            </Button>
          )}

          {step.status === "in_progress" && step.requiresApproval && (
            <Button
              onClick={onRequestApproval}
              disabled={isActionPending}
              className="w-full h-11 bg-purple-500 hover:bg-purple-500/90 text-white font-mono uppercase tracking-widest"
              data-testid="button-request-approval"
            >
              {isActionPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Request Approval
            </Button>
          )}

          {step.status === "pending_approval" && (
            <div className="w-full bg-purple-500/10 border border-purple-500/30 p-3 text-center">
              <p className="text-purple-300 font-mono text-sm">Awaiting client approval...</p>
            </div>
          )}

          {step.status === "completed" && (
            <div className="space-y-3">
              <div className="h-11 flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-xs uppercase tracking-widest">
                <CheckCircle2 className="w-4 h-4" /> Step Completed
              </div>
              {onNextStep && (
                <Button
                  onClick={onNextStep}
                  className="w-full h-11 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-mono text-[10px] uppercase tracking-[0.2em]"
                >
                  Advance to Next Step
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          )}

          {step.status === "locked" && (
            <div className="w-full bg-white/5 border border-white/10 p-3 text-center flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-white/30" />
              <p className="text-white/30 font-mono text-sm">Complete previous steps to unlock</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IntelPanel({
  step,
  onStartStep,
  onCompleteStep,
  onRequestApproval,
  onNextStep,
  isActionPending,
  isProofSatisfied,
}: {
  step: StepWithDetails | null;
  onStartStep: () => void;
  onCompleteStep: () => void;
  onRequestApproval: () => void;
  onNextStep?: () => void;
  isActionPending: boolean;
  isProofSatisfied: boolean;
}) {
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const fileInputId = useId();
  const queryClient = useQueryClient();

  const addDocMutation = useMutation({
    mutationFn: () => {
      if (newDocFile) {
        return uploadIntelDoc(step!.id, { title: newDocTitle, docType: "note", file: newDocFile });
      }
      return addIntelDoc(step!.id, { title: newDocTitle, content: newDocContent, docType: "note" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["step", step?.id] });
      setIsAddingDoc(false);
      setNewDocTitle("");
      setNewDocContent("");
      setNewDocFile(null);
    },
  });

  if (!step) {
    return (
      <div className="h-full flex flex-col bg-black/40 border-l border-white/5">
        <div className="p-6 border-b border-white/5">
          <h2 className="font-display text-lg text-white/90 tracking-wide">Intel</h2>
          <p className="text-xs text-white/40 mt-1 font-mono uppercase tracking-widest">Documentation & Notes</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/30 text-sm">Select a step to view intel</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black/40 border-l border-white/5">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg text-white/90 tracking-wide">Intel</h2>
          <p className="text-xs text-white/40 mt-1 font-mono uppercase tracking-widest">
            Step {step.stepNumber}: {step.name}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.location.href = `/intel/${step.workflowId}/${step.id}`}
            className="text-white/40 hover:text-primary transition-colors"
            title="Open Full Center"
          >
            <BookOpen className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsAddingDoc(true)}
            className="text-primary hover:bg-primary/10"
            data-testid="button-add-intel"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {isAddingDoc && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white/5 border border-white/10 p-4 space-y-3"
            >
              <input
                type="text"
                placeholder="Title"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                className="w-full bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                data-testid="input-intel-title"
              />
              <textarea
                placeholder="Content"
                value={newDocContent}
                onChange={(e) => setNewDocContent(e.target.value)}
                className="w-full bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary min-h-[100px] resize-none"
                data-testid="input-intel-content"
                disabled={!!newDocFile}
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
                  onChange={(e) => setNewDocFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <span className="text-[11px] text-white/40 truncate">
                  {newDocFile ? newDocFile.name : "No file selected"}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => addDocMutation.mutate()}
                  disabled={!newDocTitle || (!newDocContent && !newDocFile) || addDocMutation.isPending}
                  className="bg-primary text-black"
                  data-testid="button-save-intel"
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsAddingDoc(false)}
                  data-testid="button-cancel-intel"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {step.intelDocs.length === 0 && !isAddingDoc ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No intel documents yet</p>
            <button
              onClick={() => setIsAddingDoc(true)}
              className="text-primary text-sm mt-2 hover:underline"
            >
              Add first document
            </button>
          </div>
        ) : (
          (step.intelDocs as IntelDocWithFile[]).map((doc, index) => {
            const hasImagePreview = !!doc.fileUrl && !!doc.mimeType && doc.mimeType.startsWith("image/");
            const fallbackNameMatch = doc.content?.startsWith("Attached file: ") ? doc.content.replace("Attached file: ", "") : null;
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/5 border border-white/10 p-4"
                data-testid={`intel-doc-${doc.id}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-medium text-white">{doc.title}</h4>
                </div>
                <p className="text-sm text-white/60">{doc.content}</p>
                {hasImagePreview && (
                  <div className="mt-2 border border-white/10 bg-black/40 p-2">
                    <img
                      src={doc.fileUrl ?? undefined}
                      alt={doc.fileName || "Attachment preview"}
                      className="max-h-40 w-full object-contain"
                    />
                  </div>
                )}
                {!hasImagePreview && (doc.fileUrl || displayFileName) && (
                  doc.fileUrl ? (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 flex items-center gap-3 border border-white/10 bg-emerald-900/30 px-3 py-2 text-white/80 hover:border-emerald-400/60"
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
                    <div className="mt-2 flex items-center gap-3 border border-white/10 bg-emerald-900/30 px-3 py-2 text-white/60">
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
                <p className="text-xs text-white/30 mt-2 font-mono">{doc.docType}</p>
              </motion.div>
            )
          })
        )}

        {step.approvals.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-3">Approval History</h3>
            {step.approvals.map((approval) => (
              <div
                key={approval.id}
                className="bg-purple-500/10 border border-purple-500/20 p-3 mb-2"
                data-testid={`approval-${approval.id}`}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-purple-300 capitalize">{approval.status}</span>
                </div>
                {approval.comments && (
                  <p className="text-sm text-purple-300/60 mt-2">{approval.comments}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkflowWorkspace() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const workflowId = parseInt(params.id || "0");
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [proofContent, setProofContent] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isEditingProof, setIsEditingProof] = useState(false);
  const [isEditingStep, setIsEditingStep] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const proofFileInputId = useId();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: workflow, isLoading: workflowLoading } = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: () => getWorkflow(workflowId),
    enabled: !!workflowId,
  });

  const { data: stepDetails, isLoading: stepLoading } = useQuery({
    queryKey: ["step", selectedStepId],
    queryFn: () => getStep(selectedStepId!),
    enabled: !!selectedStepId,
  });

  const isProofRequired = !!stepDetails?.proofRequired;
  const isProofSubmitted = !!stepDetails?.proofSubmittedAt || !!stepDetails?.proofContent || !!stepDetails?.proofFilePath;
  const isProofSatisfied = !isProofRequired || isProofSubmitted;
  const proofFileUrl = (stepDetails as any)?.proofFileUrl as string | null | undefined;

  // Auto-select current active step or first step
  useEffect(() => {
    if (workflow && !selectedStepId) {
      const currentStep = workflow.steps.find(s => s.status === "active" || s.status === "in_progress") ||
        workflow.steps.find(s => !s.isCompleted) ||
        workflow.steps[0];
      if (currentStep) {
        setSelectedStepId(currentStep.id);
      }
    }
  }, [workflow, selectedStepId]);

  useEffect(() => {
    if (!stepDetails) return;
    setProofContent(stepDetails.proofContent || "");
    setProofFile(null);
    setEditName(stepDetails.name || "");
    setEditDescription(stepDetails.description || "");
    if (!stepDetails.proofRequired) {
      setIsEditingProof(false);
      return;
    }
    setIsEditingProof(!stepDetails.proofSubmittedAt);
  }, [stepDetails]);

  const startMutation = useMutation({
    mutationFn: () => startStep(selectedStepId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["step", selectedStepId] });
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["activeWorkflow"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const stepId = selectedStepId!;
      await completeStep(stepId);
      await advanceWorkflow(workflowId, stepId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["step", selectedStepId] });
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["activeWorkflow"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  const approvalMutation = useMutation({
    mutationFn: () => requestApproval(selectedStepId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["step", selectedStepId] });
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["activeWorkflow"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  const submitProofMutation = useMutation({
    mutationFn: () => {
      if (!selectedStepId) {
        throw new Error("No step selected");
      }
      if (proofFile) {
        return uploadStepProof(selectedStepId, { content: proofContent.trim() || undefined, file: proofFile });
      }
      return submitStepProof(selectedStepId, { content: proofContent.trim() || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["step", selectedStepId] });
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["activeWorkflow"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setProofFile(null);
      setIsEditingProof(false);
    },
  });

  const editStepMutation = useMutation({
    mutationFn: () => {
      if (!selectedStepId) {
        throw new Error("No step selected");
      }
      return updateStep(selectedStepId, {
        name: editName,
        description: editDescription,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["step", selectedStepId] });
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      setIsEditingStep(false);
    },
  });

  const handleSelectStep = (step: Step) => {
    setSelectedStepId(step.id);
  };

  if (!workflowId) {
    navigate("/");
    return null;
  }

  if (workflowLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-white/60">Workflow not found</p>
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mt-4 text-primary"
          >
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      <header className="h-14 border-b border-white/5 bg-black/40 flex items-center px-4 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="text-white/60 hover:text-white mr-4"
          data-testid="button-back"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Home
        </Button>

        <div className="flex-1 flex items-center justify-center gap-3">
          <motion.span
            className="w-2 h-2 rounded-full bg-green-500"
            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="font-mono text-xs text-white/40 uppercase tracking-widest">Active Session</span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/missions/${workflowId}/manage`)}
            className="text-white/50 hover:text-primary"
          >
            Manage
          </Button>
          <div className="text-xs font-mono text-white/40">
            Step {workflow.currentStep} of {workflow.totalSteps}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-72 shrink-0"
        >
          <JourneyPath
            steps={workflow.steps}
            currentStepId={selectedStepId}
            onSelectStep={handleSelectStep}
            workflowName={workflow.name}
          />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-1 bg-gradient-to-br from-black/20 to-black/40"
        >
          <ExecutionCenter
            step={stepDetails || null}
            isLoading={stepLoading}
            proofContent={proofContent}
            onProofContentChange={setProofContent}
            proofFile={proofFile}
            proofFileUrl={proofFileUrl}
            onSelectProofFile={setProofFile}
            isProofRequired={isProofRequired}
            isProofSubmitted={isProofSubmitted}
            isEditingProof={isEditingProof}
            onToggleEditProof={() => setIsEditingProof(true)}
            onSubmitProof={() => submitProofMutation.mutate()}
            onEditStep={() => setIsEditingStep(true)}
            canEditStep={!!user}
            canEditProof={!!user}
            isSubmittingProof={submitProofMutation.isPending}
            proofFileInputId={proofFileInputId}
            onStartStep={() => startMutation.mutate()}
            onCompleteStep={() => completeMutation.mutate()}
            onRequestApproval={() => approvalMutation.mutate()}
            onNextStep={(() => {
              const currentIndex = workflow.steps.findIndex(s => s.id === selectedStepId);
              if (currentIndex !== -1 && currentIndex < workflow.steps.length - 1) {
                return () => setSelectedStepId(workflow.steps[currentIndex + 1].id);
              }
              return undefined;
            })()}
            isActionPending={startMutation.isPending || completeMutation.isPending || approvalMutation.isPending}
            isProofSatisfied={isProofSatisfied}
          />
        </motion.div>

        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-80 shrink-0"
        >
          <IntelPanel
            step={stepDetails || null}
            onStartStep={() => startMutation.mutate()}
            onCompleteStep={() => completeMutation.mutate()}
            onRequestApproval={() => approvalMutation.mutate()}
            onNextStep={(() => {
              const currentIndex = workflow.steps.findIndex(s => s.id === selectedStepId);
              if (currentIndex !== -1 && currentIndex < workflow.steps.length - 1) {
                return () => setSelectedStepId(workflow.steps[currentIndex + 1].id);
              }
              return undefined;
            })()}
            isActionPending={startMutation.isPending || completeMutation.isPending || approvalMutation.isPending}
            isProofSatisfied={isProofSatisfied}
          />
        </motion.div>
      </div>
    </div>
  );
}
