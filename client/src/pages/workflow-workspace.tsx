import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkflow, getStep, startStep, completeStep, advanceWorkflow, requestApproval, addIntelDoc } from "@/lib/api";
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
  ListChecks,
  ArrowRight,
  Loader2,
  Shield,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { Step, StepWithDetails } from "@shared/schema";

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
                      <span className="text-xs font-mono text-white/30">0{step.stepNumber}</span>
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
    </div>
  );
}

function ExecutionCenter({ 
  step, 
  workflowId,
  isLoading,
  onStartStep,
  onCompleteStep,
  onRequestApproval,
  isActionPending
}: { 
  step: StepWithDetails | null;
  workflowId: number;
  isLoading: boolean;
  onStartStep: () => void;
  onCompleteStep: () => void;
  onRequestApproval: () => void;
  isActionPending: boolean;
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
              <p className="text-xs font-mono text-white/40 uppercase tracking-widest">Step {step.stepNumber}</p>
              <h1 className="font-display text-2xl text-white tracking-wide">{step.name}</h1>
            </div>
          </div>
          
          <div className={`px-3 py-1.5 ${config.bg} ${config.color} text-xs font-mono uppercase tracking-wider flex items-center gap-2`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {step.description && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h3 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
              <FileText className="w-3 h-3" /> Description
            </h3>
            <p className="text-white/70 leading-relaxed">{step.description}</p>
          </motion.div>
        )}

        {step.objective && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <h3 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Target className="w-3 h-3" /> Objective
            </h3>
            <div className="bg-primary/5 border border-primary/20 p-4">
              <p className="text-primary">{step.objective}</p>
            </div>
          </motion.div>
        )}

        {step.instructions && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h3 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ListChecks className="w-3 h-3" /> Instructions
            </h3>
            <div className="bg-white/5 p-4 font-mono text-sm text-white/60 whitespace-pre-wrap">
              {step.instructions}
            </div>
          </motion.div>
        )}

        {step.requiresApproval && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <div className="bg-purple-500/10 border border-purple-500/20 p-4 flex items-start gap-3">
              <Shield className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-purple-300 font-medium">Approval Required</p>
                <p className="text-purple-300/60 text-sm mt-1">This step requires client approval before it can be marked complete.</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-6 border-t border-white/5 bg-black/20">
        <div className="flex gap-3">
          {step.status === "active" && (
            <Button 
              onClick={onStartStep}
              disabled={isActionPending}
              className="flex-1 bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-wider"
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
              disabled={isActionPending}
              className="flex-1 bg-green-500 hover:bg-green-500/90 text-black font-mono uppercase tracking-wider"
              data-testid="button-complete-step"
            >
              {isActionPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Mark Complete
            </Button>
          )}
          
          {step.status === "in_progress" && step.requiresApproval && (
            <Button 
              onClick={onRequestApproval}
              disabled={isActionPending}
              className="flex-1 bg-purple-500 hover:bg-purple-500/90 text-white font-mono uppercase tracking-wider"
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
            <div className="flex-1 bg-purple-500/10 border border-purple-500/30 p-4 text-center">
              <p className="text-purple-300 font-mono text-sm">Awaiting client approval...</p>
            </div>
          )}
          
          {step.status === "completed" && (
            <div className="flex-1 bg-green-500/10 border border-green-500/30 p-4 text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <p className="text-green-300 font-mono text-sm">Step Completed</p>
            </div>
          )}
          
          {step.status === "locked" && (
            <div className="flex-1 bg-white/5 border border-white/10 p-4 text-center flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-white/30" />
              <p className="text-white/30 font-mono text-sm">Complete previous steps to unlock</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IntelPanel({ step }: { step: StepWithDetails | null }) {
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const queryClient = useQueryClient();

  const addDocMutation = useMutation({
    mutationFn: () => addIntelDoc(step!.id, { title: newDocTitle, content: newDocContent, docType: "note" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["step", step?.id] });
      setIsAddingDoc(false);
      setNewDocTitle("");
      setNewDocContent("");
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
          <p className="text-xs text-white/40 mt-1 font-mono uppercase tracking-widest">Step {step.stepNumber} Resources</p>
        </div>
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
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => addDocMutation.mutate()}
                  disabled={!newDocTitle || !newDocContent || addDocMutation.isPending}
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
          step.intelDocs.map((doc, index) => (
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
              <p className="text-xs text-white/30 mt-2 font-mono">{doc.docType}</p>
            </motion.div>
          ))
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
  const queryClient = useQueryClient();

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

  const startMutation = useMutation({
    mutationFn: () => startStep(selectedStepId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["step", selectedStepId] });
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await completeStep(selectedStepId!);
      await advanceWorkflow(workflowId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["step", selectedStepId] });
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
    },
  });

  const approvalMutation = useMutation({
    mutationFn: () => requestApproval(selectedStepId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["step", selectedStepId] });
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
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
            Return to Mission Control
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
          Mission Control
        </Button>
        
        <div className="flex-1 flex items-center justify-center gap-3">
          <motion.span 
            className="w-2 h-2 rounded-full bg-green-500"
            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="font-mono text-xs text-white/40 uppercase tracking-widest">Active Session</span>
        </div>
        
        <div className="text-xs font-mono text-white/40">
          Step {workflow.currentStep} of {workflow.totalSteps}
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
            workflowId={workflowId}
            isLoading={stepLoading}
            onStartStep={() => startMutation.mutate()}
            onCompleteStep={() => completeMutation.mutate()}
            onRequestApproval={() => approvalMutation.mutate()}
            isActionPending={startMutation.isPending || completeMutation.isPending || approvalMutation.isPending}
          />
        </motion.div>

        <motion.div 
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-80 shrink-0"
        >
          <IntelPanel step={stepDetails || null} />
        </motion.div>
      </div>
    </div>
  );
}
