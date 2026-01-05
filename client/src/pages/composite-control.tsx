import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getComposite, updateStep, updateStepProofConfig, deleteStepProof } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Shield, CheckCircle2, Layers } from "lucide-react";
import type { CompositeWorkflowWithItems, Step } from "@shared/schema";

const statusLabel: Record<string, string> = {
  locked: "Locked",
  active: "Ready",
  in_progress: "In Progress",
  pending_approval: "Awaiting Approval",
  completed: "Completed",
};

export default function CompositeControl() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const compositeId = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [proofRequired, setProofRequired] = useState(false);
  const [isEditingPhase, setIsEditingPhase] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const { data: composite, isLoading } = useQuery<CompositeWorkflowWithItems>({
    queryKey: ["composite", compositeId],
    queryFn: () => getComposite(compositeId),
    enabled: !!compositeId,
  });

  const selectedStep = useMemo(
    () => composite?.steps.find((step) => step.id === selectedStepId) || null,
    [composite, selectedStepId]
  );
  const selectedPhaseIndex = selectedStep
    ? composite?.steps.findIndex((step) => step.id === selectedStep.id) ?? -1
    : -1;

  useEffect(() => {
    if (!composite?.steps?.length) return;
    if (selectedStepId) return;
    setSelectedStepId(composite.steps[0].id);
  }, [composite, selectedStepId]);

  useEffect(() => {
    if (!selectedStep) return;
    setProofRequired(!!selectedStep.proofRequired);
    setEditName(selectedStep.name || "");
    setEditDescription(selectedStep.description || "");
  }, [selectedStep]);

  const updateProofMutation = useMutation({
    mutationFn: () =>
      updateStepProofConfig(selectedStep!.id, {
        proofRequired,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite", compositeId] });
    },
  });

  const deleteProofMutation = useMutation({
    mutationFn: () => deleteStepProof(selectedStep!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite", compositeId] });
    },
  });

  const editPhaseMutation = useMutation({
    mutationFn: () =>
      updateStep(selectedStep!.id, {
        name: editName,
        description: editDescription,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite", compositeId] });
      setIsEditingPhase(false);
    },
  });

  return (
    <div className="min-h-screen bg-black text-foreground">
      <header className="h-14 border-b border-white/5 bg-black/60 flex items-center justify-between px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/workflows/${compositeId}`)}
          className="text-white/60 hover:text-white"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Workflow
        </Button>
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/50">
          <Layers className="w-4 h-4" />
          Workflow Control
        </div>
        <div className="text-white/30 text-xs">{composite?.steps?.length || 0} phases</div>
      </header>

      <div className="grid grid-cols-[260px_1fr] min-h-[calc(100vh-56px)]">
        <aside className="border-r border-white/5 bg-black/60 p-4">
          <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-4">Phases</h2>
          {isLoading ? (
            <div className="flex justify-center py-10 text-white/40 text-xs">Loading...</div>
          ) : !composite?.steps?.length ? (
            <div className="text-xs text-white/40">No phases found.</div>
          ) : (
            <div className="space-y-3">
              {composite.steps.map((step, index) => {
                const isActive = step.id === selectedStepId;
                const workflowName = (step as Step & { workflowName?: string }).workflowName;
                return (
                  <button
                    key={step.id}
                    onClick={() => setSelectedStepId(step.id)}
                    className={`w-full text-left border px-3 py-2 text-xs transition-colors ${
                      isActive
                        ? "border-primary/50 bg-primary/10 text-white"
                        : "border-white/10 text-white/60 hover:border-white/30"
                    }`}
                  >
                    <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                      Phase {index + 1}: {step.name}
                    </p>
                    <p className="text-[10px] text-white/40 mt-1">{workflowName || "Independent Phase"}</p>
                    <p className="text-[10px] text-white/40 mt-1">{statusLabel[step.status] || "Locked"}</p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <main className="p-8">
          {!selectedStep ? (
            <div className="text-center text-white/40">Select a phase to manage.</div>
          ) : (
            <div className="max-w-3xl space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                <div className="text-xs font-mono text-white/40 uppercase tracking-widest">Selected Phase</div>
                <h1 className="text-2xl font-display text-white mt-2">
                  {selectedPhaseIndex >= 0 ? `PHASE ${selectedPhaseIndex + 1}: ${selectedStep.name}` : selectedStep.name}
                </h1>
                <p className="text-sm text-white/40 mt-1">{selectedStep.description}</p>
                {(selectedStep as Step & { workflowName?: string }).workflowName && (
                  <p className="text-[10px] text-white/40 mt-2 font-mono uppercase tracking-widest">
                    Source: STEP {selectedStep.stepNumber} {(selectedStep as Step & { workflowName?: string }).workflowName}
                  </p>
                )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingPhase(true)}
                  className="text-white/50 hover:text-primary"
                >
                  Edit Phase
                </Button>
              </div>

              <div className="border border-white/10 bg-black/40 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-mono text-white/60 uppercase tracking-widest">Proof Requirements</h2>
                  {selectedStep.proofSubmittedAt && (
                    <span className="text-[10px] text-emerald-300 font-mono uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3" /> Submitted
                    </span>
                  )}
                </div>
                <label className="flex items-center gap-2 text-[11px] text-white/50 font-mono mb-3">
                  <input
                    type="checkbox"
                    checked={proofRequired}
                    onChange={(e) => setProofRequired(e.target.checked)}
                  />
                  Require proof for this phase
                </label>
                {proofRequired && (
                  <p className="mt-3 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                    Proof required for this phase.
                  </p>
                )}
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    size="sm"
                    onClick={() => updateProofMutation.mutate()}
                    disabled={updateProofMutation.isPending}
                    className="bg-primary text-black font-mono uppercase tracking-widest"
                  >
                    Save Proof Settings
                  </Button>
                  {selectedStep.proofSubmittedAt && (
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

              <div className="border border-white/10 bg-black/40 p-6">
                <div className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                  <Shield className="w-3 h-3" />
                  Proof Summary
                </div>
                <p className="text-sm text-white/60 mt-3">
                  {selectedStep.proofContent || "No proof submitted yet."}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {isEditingPhase && selectedStep && (
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
    </div>
  );
}
