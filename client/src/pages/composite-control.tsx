import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getComposite, updateStepProofConfig, deleteStepProof } from "@/lib/api";
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
  const [proofTitle, setProofTitle] = useState("");
  const [proofDescription, setProofDescription] = useState("");

  const { data: composite, isLoading } = useQuery<CompositeWorkflowWithItems>({
    queryKey: ["composite", compositeId],
    queryFn: () => getComposite(compositeId),
    enabled: !!compositeId,
  });

  const selectedStep = useMemo(
    () => composite?.steps.find((step) => step.id === selectedStepId) || null,
    [composite, selectedStepId]
  );

  useEffect(() => {
    if (!composite?.steps?.length) return;
    if (selectedStepId) return;
    setSelectedStepId(composite.steps[0].id);
  }, [composite, selectedStepId]);

  useEffect(() => {
    if (!selectedStep) return;
    setProofRequired(!!selectedStep.proofRequired);
    setProofTitle(selectedStep.proofTitle || "");
    setProofDescription(selectedStep.proofDescription || "");
  }, [selectedStep]);

  const updateProofMutation = useMutation({
    mutationFn: () =>
      updateStepProofConfig(selectedStep!.id, {
        proofRequired,
        proofTitle,
        proofDescription,
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
                    <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Phase {index + 1}</p>
                    <p className="text-sm text-white truncate">{step.name}</p>
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
              <div>
                <div className="text-xs font-mono text-white/40 uppercase tracking-widest">Selected Phase</div>
                <h1 className="text-2xl font-display text-white mt-2">{selectedStep.name}</h1>
                <p className="text-sm text-white/40 mt-1">{selectedStep.description}</p>
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
                <input
                  value={proofTitle}
                  onChange={(e) => setProofTitle(e.target.value)}
                  placeholder="Proof title"
                  disabled={!proofRequired}
                  className="w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary disabled:opacity-40"
                />
                <textarea
                  value={proofDescription}
                  onChange={(e) => setProofDescription(e.target.value)}
                  placeholder="Proof description"
                  disabled={!proofRequired}
                  className="mt-3 w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary min-h-[100px] resize-none disabled:opacity-40"
                />
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
    </div>
  );
}
