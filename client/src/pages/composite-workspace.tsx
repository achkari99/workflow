import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getComposite,
    getStep,
    startStep,
    completeStep,
    updateStep,
    requestApproval,
    addIntelDoc,
    uploadIntelDoc,
    submitStepProof,
    uploadStepProof
} from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft,
    Lock,
    CheckCircle2,
    Circle,
    Play,
    Clock,
    FileText,
    Plus,
    Send,
    Target,
    ArrowRight,
    Loader2,
    Zap,
    BookOpen,
    Layers,
    Workflow as WorkflowIcon,
    Activity as PulseIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useId } from "react";
import type { Step, IntelDoc } from "@shared/schema";

type IntelDocWithFile = IntelDoc & { fileUrl?: string | null };

const statusConfig: Record<string, { icon: any; color: string; label: string; bg: string }> = {
    locked: { icon: Lock, color: "text-white/30", label: "Locked", bg: "bg-white/5" },
    active: { icon: Circle, color: "text-primary", label: "Ready", bg: "bg-primary/10" },
    in_progress: { icon: Play, color: "text-amber-400", label: "In Progress", bg: "bg-amber-400/10" },
    pending_approval: { icon: Clock, color: "text-purple-400", label: "Awaiting Approval", bg: "bg-purple-400/10" },
    completed: { icon: CheckCircle2, color: "text-green-400", label: "Completed", bg: "bg-green-400/10" },
};

function MasterJourneyPath({
    steps,
    currentStepId,
    onSelectStep,
    masterName
}: {
    steps: (Step & { workflowName: string })[];
    currentStepId: number | null;
    onSelectStep: (step: Step) => void;
    masterName: string;
}) {
    return (
        <div className="h-full flex flex-col bg-black/60 border-r border-white/5 backdrop-blur-xl">
            <div className="p-6 border-b border-white/5 bg-gradient-to-b from-primary/5 to-transparent">
                <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    <p className="text-[10px] font-mono text-primary uppercase tracking-[0.3em]">Master Workflow</p>
                </div>
                <h2 className="font-display text-xl text-white tracking-tight">{masterName}</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="relative">
                    {/* Animated Glow Line */}
                    <div className="absolute left-[19px] top-4 bottom-4 w-px bg-white/5" />
                    <motion.div
                        className="absolute left-[19px] top-4 w-px bg-primary shadow-[0_0_10px_rgba(132,204,22,0.5)]"
                        initial={{ height: 0 }}
                        animate={{ height: '100%' }}
                        transition={{ duration: 2, ease: "easeInOut" }}
                    />

                    <div className="space-y-4">
                        {steps.map((step, index) => {
                            const config = statusConfig[step.status] || statusConfig.locked;
                            const Icon = config.icon;
                            const isActive = step.id === currentStepId;

                            return (
                                <motion.button
                                    key={step.id}
                                    onClick={() => onSelectStep(step)}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`
                    w-full flex items-start gap-4 p-3 transition-all relative group
                    ${isActive ? "bg-white/5 border-l-2 border-primary" : "border-l-2 border-transparent hover:bg-white/5"}
                  `}
                                >
                                    <div className={`relative z-10 p-1.5 rounded-none ${config.bg} shadow-lg ring-1 ring-white/10 group-hover:ring-primary/30 transition-all`}>
                                        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[10px] font-mono text-white/20">SEQ-0{index + 1}</span>
                                            <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-white/5 border border-white/5">
                                                <WorkflowIcon className="w-2.5 h-2.5 text-white/30" />
                                                <span className="text-[9px] font-mono text-white/40 uppercase truncate max-w-[80px]">
                                                    {step.workflowName}
                                                </span>
                                            </div>
                                        </div>
                                        <p className={`text-sm font-medium truncate ${isActive ? "text-white" : "text-white/60 group-hover:text-white/90"}`}>
                                            Phase {index + 1}: {step.name}
                                        </p>
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

export default function CompositeWorkspace() {
    const params = useParams<{ id: string }>();
    const [, navigate] = useLocation();
    const compositeId = parseInt(params.id || "0");
    const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
    const [isAddingDoc, setIsAddingDoc] = useState(false);
    const [newDocTitle, setNewDocTitle] = useState("");
    const [newDocContent, setNewDocContent] = useState("");
    const [newDocFile, setNewDocFile] = useState<File | null>(null);
    const [proofContent, setProofContent] = useState("");
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [isEditingProof, setIsEditingProof] = useState(false);
    const [isEditingPhase, setIsEditingPhase] = useState(false);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const fileInputId = useId();
    const proofFileInputId = useId();
    const queryClient = useQueryClient();

    const { data: composite, isLoading: compositeLoading } = useQuery({
        queryKey: ["composite", compositeId],
        queryFn: () => getComposite(compositeId),
        enabled: !!compositeId,
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

    // Auto-select first incomplete step or first step
    useEffect(() => {
        if (composite && !selectedStepId) {
            const nextStep = composite.steps.find(s => !s.isCompleted) || composite.steps[0];
            if (nextStep) setSelectedStepId(nextStep.id);
        }
    }, [composite, selectedStepId]);

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
            queryClient.invalidateQueries({ queryKey: ["composite", compositeId] });
        },
    });

    const completeMutation = useMutation({
        mutationFn: async () => {
            await completeStep(selectedStepId!);

            // Advance logic: if this is a composite, enable the NEXT step in order
            if (composite) {
                const currentIndex = composite.steps.findIndex(s => s.id === selectedStepId);
                const nextStep = composite.steps[currentIndex + 1];
                if (nextStep && nextStep.status === "locked") {
                    await updateStep(nextStep.id, { status: "active" });
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["step", selectedStepId] });
            queryClient.invalidateQueries({ queryKey: ["composite", compositeId] });
        },
    });

    const approvalMutation = useMutation({
        mutationFn: () => requestApproval(selectedStepId!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["step", selectedStepId] });
            queryClient.invalidateQueries({ queryKey: ["composite", compositeId] });
        },
    });

    const addDocMutation = useMutation({
        mutationFn: () => {
            if (newDocFile) {
                return uploadIntelDoc(selectedStepId!, { title: newDocTitle, docType: "note", file: newDocFile });
            }
            return addIntelDoc(selectedStepId!, { title: newDocTitle, content: newDocContent, docType: "note" });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["step", selectedStepId] });
            setIsAddingDoc(false);
            setNewDocTitle("");
            setNewDocContent("");
            setNewDocFile(null);
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
            setProofFile(null);
            setIsEditingProof(false);
        },
    });

    const editPhaseMutation = useMutation({
        mutationFn: () => {
            if (!selectedStepId) {
                throw new Error("No phase selected");
            }
            return updateStep(selectedStepId, {
                name: editName,
                description: editDescription,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["step", selectedStepId] });
            queryClient.invalidateQueries({ queryKey: ["composite", compositeId] });
            setIsEditingPhase(false);
        },
    });

    if (compositeLoading) {
        return (
            <div className="h-screen bg-background flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-xs font-mono text-white/20 uppercase tracking-[0.4em] animate-pulse">Syncing Master Workflow</p>
            </div>
        );
    }

    if (!composite) return null;

    const completedSteps = composite.steps.filter(s => s.isCompleted).length;
    const totalSteps = composite.steps.length;
    const progressPercent = Math.round((completedSteps / totalSteps) * 100);

    // Identify the current active step index (first non-completed)
    const currentStepIndex = composite.steps.findIndex(s => !s.isCompleted);
    const effectiveCurrentStepId = currentStepIndex !== -1 ? composite.steps[currentStepIndex].id : null;
    const selectedStepIndex = selectedStepId
        ? composite.steps.findIndex(s => s.id === selectedStepId)
        : -1;
    const selectedStepOrder = selectedStepIndex !== -1 ? selectedStepIndex + 1 : null;

    return (
        <>
        <div className="h-screen bg-[#050505] text-foreground flex flex-col overflow-hidden">
            {/* Master Ticker / Status Bar */}
            <header className="h-16 border-b border-white/5 bg-black flex items-center px-6 shrink-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-50" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/workflows")}
                    className="text-white/40 hover:text-white mr-6 relative z-10"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Workflows
                </Button>

                <div className="flex-1 flex items-center gap-8 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 border border-primary/20 flex items-center justify-center relative overflow-hidden group">
                            <motion.div
                                className="absolute inset-0 bg-primary/20"
                                animate={{ opacity: [0, 0.4, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                            <PulseIcon className="w-4 h-4 text-primary relative z-10 animate-pulse" />
                        </div>
                        <div>
                            <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest leading-none mb-1">Active Integration</p>
                            <h2 className="text-sm font-display text-white">{composite.name}</h2>
                        </div>
                    </div>

                    <div className="hidden md:flex flex-1 max-w-md items-center gap-4">
                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <motion.div
                                className="h-full bg-primary"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-mono text-primary">{progressPercent}% SYNCED</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-mono text-white/60">LIVE TERMINAL</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/workflows/${compositeId}/manage`)}
                        className="text-white/50 hover:text-primary"
                    >
                        Manage
                    </Button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="w-80 shrink-0"
                >
                    <MasterJourneyPath
                        steps={composite.steps}
                        currentStepId={selectedStepId}
                        onSelectStep={(s) => setSelectedStepId(s.id)}
                        masterName={composite.name}
                    />
                </motion.div>

                {/* Main Execution Area */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/[0.02] to-transparent"
                >
                    {stepLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
                        </div>
                    ) : stepDetails ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <header className="p-6 border-b border-white/5 bg-black/20 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-[10px] font-mono text-primary uppercase tracking-widest">
                                                Phase {selectedStepOrder ?? stepDetails.stepNumber}
                                            </div>
                                            <div className="text-white/20 text-xs font-mono">/</div>
                                            <div className="flex items-center gap-2 text-white/40 text-xs font-mono bg-white/5 px-2 py-0.5 border border-white/5">
                                                <WorkflowIcon className="w-3 h-3" />
                                                Source: STEP {stepDetails.stepNumber} {composite.steps.find(s => s.id === stepDetails.id)?.workflowName}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setIsEditingPhase(true)}
                                                className="text-white/50 hover:text-primary"
                                            >
                                                Edit Phase
                                            </Button>
                                            <div className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest border ${statusConfig[stepDetails.status].bg} ${statusConfig[stepDetails.status].color} flex items-center gap-2`}>
                                                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                                {statusConfig[stepDetails.status].label}
                                            </div>
                                        </div>
                                    </div>
                                    <h1 className="text-3xl font-display font-bold text-white tracking-tight mt-4">
                                        PHASE {selectedStepOrder ?? stepDetails.stepNumber}: {stepDetails.name}
                                    </h1>
                                </header>

                                {/* Submission Area */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    <div className="border border-white/10 bg-white/5 p-5">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Phase Brief</p>
                                            <span className={`text-[10px] font-mono uppercase tracking-widest ${isProofRequired ? "text-primary" : "text-white/30"}`}>
                                                {isProofRequired ? "Proof required" : "Proof optional"}
                                            </span>
                                        </div>
                                        <h3 className="text-lg text-white mt-3">{stepDetails.name}</h3>
                                        <p className="text-sm text-white/50 mt-2">{stepDetails.description || "Add a phase description."}</p>
                                        {!isProofRequired && (
                                            <p className="text-[10px] text-white/30 mt-3 font-mono uppercase tracking-widest">
                                                Proof not required for this phase.
                                            </p>
                                        )}
                                    </div>

                                    <div className="border border-white/10 bg-white/5 p-5 space-y-3">
                                        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                                            Submission{isProofRequired ? ": Proofs are required for this phase" : ""}
                                        </p>
                                        <textarea
                                            value={proofContent}
                                            onChange={(e) => setProofContent(e.target.value)}
                                            placeholder={isProofRequired ? "Write your proof..." : "No proof needed"}
                                            disabled={!isProofRequired || (!isEditingProof && isProofSubmitted)}
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
                                </div>

                                {/* Action Footer */}
                                <div className="p-6 border-t border-white/5 bg-black/20">
                                    <div className="flex items-center gap-3">
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
                                                submitProofMutation.isPending ||
                                                (!(isProofSubmitted && !isEditingProof) && !proofContent.trim() && !proofFile)
                                            }
                                            className="flex-1 h-12 bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
                                        >
                                            {submitProofMutation.isPending ? (
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            ) : null}
                                            {isProofSubmitted && !isEditingProof ? "Edit Proofs" : "Submit Proofs"}
                                        </Button>
                                        <label
                                            htmlFor={proofFileInputId}
                                            className={`h-12 px-4 border border-white/10 text-xs font-mono uppercase tracking-widest flex items-center justify-center cursor-pointer ${
                                                !isProofRequired || (isProofSubmitted && !isEditingProof) ? "opacity-40 cursor-not-allowed" : "hover:border-primary/50"
                                            }`}
                                        >
                                            Upload
                                        </label>
                                        <input
                                            id={proofFileInputId}
                                            type="file"
                                            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json,text/*,application/rtf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                                            disabled={!isProofRequired || (isProofSubmitted && !isEditingProof)}
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-30 grayscale">
                            <Layers className="w-24 h-24 text-white" />
                            <p className="font-mono text-xs uppercase tracking-[0.5em]">Awaiting Selection</p>
                        </div>
                    )}
                </motion.div>

                {/* Right Panel - Intel */}
                <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="w-80 shrink-0 bg-black/40 border-l border-white/5 backdrop-blur-md flex flex-col"
                >
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <h2 className="text-xs font-mono text-white/80 uppercase tracking-widest">Intelligence</h2>
                        </div>
                        <div className="flex items-center gap-1">
                            {stepDetails && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/intel/${stepDetails.workflowId}/${stepDetails.id}`)}
                                    className="text-white/20 hover:text-primary transition-colors h-7 px-2"
                                >
                                    <BookOpen className="w-3 h-3" />
                                </Button>
                            )}
                            {stepDetails && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsAddingDoc(true)}
                                    className="text-primary hover:bg-primary/10 h-7 px-2"
                                    data-testid="button-add-intel"
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="p-4 space-y-4 overflow-y-auto flex-1">
                        {!stepDetails ? (
                            <div className="flex flex-col items-center justify-center h-40 opacity-20">
                                <Target className="w-8 h-8 mb-2" />
                                <span className="text-[10px] font-mono">No Active Link</span>
                            </div>
                        ) : (
                            <>
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
                                {stepDetails?.intelDocs && stepDetails.intelDocs.length === 0 && !isAddingDoc ? (
                                    <div className="p-6 text-center border border-dashed border-white/10 opacity-30">
                                        <p className="text-xs font-mono uppercase tracking-widest">No Tactical Intel Found</p>
                                    </div>
                                ) : (
                                    (stepDetails?.intelDocs as IntelDocWithFile[] | undefined)?.map((doc, i) => {
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
                                                                        : "FILE";
                                        const fileSizeLabel = doc.fileSize ? `${Math.max(1, Math.round(doc.fileSize / 1024))} KB` : null;
                                        return (
                                            <motion.div
                                                key={doc.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.1 }}
                                                className="p-4 bg-white/5 border border-white/5 hover:border-white/10 transition-colors group"
                                            >
                                                <h4 className="text-xs font-bold text-white/90 mb-2 truncate group-hover:text-primary">{doc.title}</h4>
                                                <p className="text-[11px] text-white/40 leading-relaxed mb-3 line-clamp-3">{doc.content}</p>
                                                {hasImagePreview && (
                                                    <div className="mb-3 border border-white/10 bg-black/40 p-2">
                                                        <img
                                                            src={doc.fileUrl ?? undefined}
                                                            alt={doc.fileName || "Attachment preview"}
                                                            className="max-h-32 w-full object-contain"
                                                        />
                                                    </div>
                                                )}
                                                {!hasImagePreview && (doc.fileUrl || displayFileName) && (
                                                    doc.fileUrl ? (
                                                        <a
                                                            href={doc.fileUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="mb-3 flex items-center gap-3 border border-white/10 bg-emerald-900/30 px-3 py-2 text-white/80 hover:border-emerald-400/60"
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
                                                        <div className="mb-3 flex items-center gap-3 border border-white/10 bg-emerald-900/30 px-3 py-2 text-white/60">
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

                                                <div className="flex justify-between items-center text-[9px] font-mono text-white/20">
                                                    <span className="uppercase tracking-tighter">{doc.docType}</span>
                                                    <span>ID-{doc.id}</span>
                                                </div>
                                            </motion.div>
                                        )
                                    })
                                )}
                            </>
                        )}
                    </div>

                    <div className="border-t border-white/5 p-4 bg-black/40">
                        {!stepDetails ? (
                            <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest text-center">
                                Awaiting phase selection
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {(stepDetails.status === "active" || (stepDetails.status === "locked" && stepDetails.id === effectiveCurrentStepId)) && (
                                    <Button
                                        onClick={() => startMutation.mutate()}
                                        disabled={startMutation.isPending}
                                        className="w-full h-12 bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
                                    >
                                        {startMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        ) : (
                                            <Zap className="w-4 h-4 mr-2" />
                                        )}
                                        Begin Phase
                                    </Button>
                                )}

                                {stepDetails.status === "in_progress" && !stepDetails.requiresApproval && (
                                    <Button
                                        onClick={() => completeMutation.mutate()}
                                        disabled={completeMutation.isPending || !isProofSatisfied}
                                        className="w-full h-12 bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
                                    >
                                        {completeMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        ) : (
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                        )}
                                        Complete Phase
                                    </Button>
                                )}

                                {stepDetails.status === "in_progress" && stepDetails.requiresApproval && (
                                    <Button
                                        onClick={() => approvalMutation.mutate()}
                                        disabled={approvalMutation.isPending}
                                        className="w-full h-12 bg-purple-500 hover:bg-purple-600 text-white font-mono uppercase tracking-widest"
                                    >
                                        {approvalMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        ) : (
                                            <Send className="w-4 h-4 mr-2" />
                                        )}
                                        Request Approval
                                    </Button>
                                )}

                                {stepDetails.status === "pending_approval" && (
                                    <div className="w-full bg-purple-500/10 border border-purple-500/30 p-3 text-center">
                                        <p className="text-purple-300 font-mono text-sm uppercase tracking-widest">Awaiting client approval...</p>
                                    </div>
                                )}

                                {stepDetails.status === "completed" && (
                                    <div className="space-y-3">
                                        <div className="h-12 flex items-center justify-center gap-3 bg-green-500/10 border border-green-500/20 text-green-400 font-mono text-[10px] uppercase tracking-widest">
                                            <CheckCircle2 className="w-4 h-4" /> Phase Completed
                                        </div>
                                        {composite && selectedStepIndex !== -1 && selectedStepIndex < composite.steps.length - 1 && (
                                            <Button
                                                onClick={() => {
                                                    const nextStepId = composite.steps[selectedStepIndex + 1].id;
                                                    setSelectedStepId(nextStepId);
                                                }}
                                                className="w-full h-11 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-mono text-[10px] uppercase tracking-[0.2em]"
                                            >
                                                Advance to Next Phase
                                                <ArrowRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>

        {isEditingPhase && stepDetails && (
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4"
                onClick={() => setIsEditingPhase(false)}
            >
                <div
                    className="bg-black/90 border border-white/10 p-6 w-full max-w-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg text-white font-display">Edit Phase</h3>
                        <Button variant="ghost" size="sm" onClick={() => setIsEditingPhase(false)}>
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
                            onClick={() => editPhaseMutation.mutate()}
                            disabled={editPhaseMutation.isPending || !editName.trim()}
                            className="flex-1 bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
                        >
                            {editPhaseMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                        <Button variant="ghost" onClick={() => setIsEditingPhase(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
