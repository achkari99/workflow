import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createWorkflow, setActiveWorkflow } from "@/lib/api";
import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  Plus, 
  Minus, 
  Loader2,
  Zap,
  Target,
  ListChecks
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkflowCreate() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [totalSteps, setTotalSteps] = useState(5);
  const [priority, setPriority] = useState("high");
  const [stepConfig, setStepConfig] = useState<{ title: string; description: string }[]>(
    Array.from({ length: 5 }, () => ({ title: "", description: "" }))
  );
  const [proofConfig, setProofConfig] = useState<{ proofRequired: boolean }[]>(
    Array.from({ length: 5 }, () => ({ proofRequired: false }))
  );

  useEffect(() => {
    setStepConfig((prev) => {
      const next = [...prev];
      if (totalSteps > next.length) {
        for (let i = next.length; i < totalSteps; i += 1) {
          next.push({ title: "", description: "" });
        }
      } else if (totalSteps < next.length) {
        next.length = totalSteps;
      }
      return next;
    });
    setProofConfig((prev) => {
      const next = [...prev];
      if (totalSteps > next.length) {
        for (let i = next.length; i < totalSteps; i += 1) {
          next.push({ proofRequired: false });
        }
      } else if (totalSteps < next.length) {
        next.length = totalSteps;
      }
      return next;
    });
  }, [totalSteps]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const workflow = await createWorkflow({
        name,
        description,
        totalSteps,
        currentStep: 1,
        isActive: false,
        status: "active",
        priority,
        stepConfig,
        proofConfig,
      });
      await setActiveWorkflow(workflow.id);
      return workflow;
    },
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["activeWorkflow"] });
      navigate(`/workflow/${workflow.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && stepConfig.every((step) => step.title.trim() && step.description.trim())) {
      createMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 border-b border-white/5 bg-black/40 flex items-center px-4">
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
      </header>

      <div className="container mx-auto max-w-2xl py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-primary/10">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl text-white tracking-wide">New Mission</h1>
              <p className="text-white/40 text-sm mt-1">Create a new mission to track</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-widest mb-2">
                <Target className="w-3 h-3 inline mr-2" />
                Mission Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Core Platform Launch"
                className="w-full bg-black/30 border border-white/10 px-4 py-3 text-lg text-white placeholder:text-white/30 focus:outline-none focus:border-primary font-display"
                required
                data-testid="input-name"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-widest mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the objective of this mission..."
                className="w-full bg-black/30 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary min-h-[100px] resize-none"
                data-testid="input-description"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-widest mb-2">
                <ListChecks className="w-3 h-3 inline mr-2" />
                Number of Steps
              </label>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTotalSteps(Math.max(1, totalSteps - 1))}
                  className="bg-white/5 hover:bg-white/10"
                  data-testid="button-decrease-steps"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-3xl font-display text-primary w-16 text-center" data-testid="text-step-count">
                  {totalSteps}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTotalSteps(Math.min(20, totalSteps + 1))}
                  className="bg-white/5 hover:bg-white/10"
                  data-testid="button-increase-steps"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-mono text-white/40 uppercase tracking-widest">
                  Step Briefs + Proof
                </label>
                <span className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Briefs required</span>
              </div>
              <div className="space-y-3">
                {proofConfig.map((config, index) => (
                  <div key={`proof-step-${index}`} className="border border-white/10 bg-white/5 p-3">
                    <div className="mb-3">
                      <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                        Step {index + 1}{stepConfig[index]?.title ? `: ${stepConfig[index].title}` : ""}
                      </label>
                    </div>
                    <div className="space-y-2">
                      <input
                        value={stepConfig[index]?.title || ""}
                        onChange={(e) =>
                          setStepConfig((prev) =>
                            prev.map((item, idx) =>
                              idx === index ? { ...item, title: e.target.value } : item
                            )
                          )
                        }
                        placeholder={`Step ${index + 1} title`}
                        required
                        className="w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                      />
                      <textarea
                        value={stepConfig[index]?.description || ""}
                        onChange={(e) =>
                          setStepConfig((prev) =>
                            prev.map((item, idx) =>
                              idx === index ? { ...item, description: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Step description"
                        required
                        className="w-full bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary min-h-[80px] resize-none"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                        Proof Requirements
                      </span>
                      <label className="flex items-center gap-2 text-[10px] font-mono text-white/50 uppercase tracking-widest">
                        <input
                          type="checkbox"
                          checked={config.proofRequired}
                          onChange={(e) =>
                            setProofConfig((prev) =>
                              prev.map((item, idx) =>
                                idx === index ? { ...item, proofRequired: e.target.checked } : item
                              )
                            )
                          }
                        />
                        Require proof
                      </label>
                    </div>
                    {config.proofRequired && (
                      <p className="mt-3 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                        Proof required for this step.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-widest mb-3">
                Priority Level
              </label>
              <div className="flex gap-3">
                {["low", "medium", "high", "critical"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`
                      px-4 py-2 text-sm font-mono uppercase tracking-wider transition-all
                      ${priority === p 
                        ? p === "critical" ? "bg-red-500/20 border-red-500 text-red-400 border" 
                          : p === "high" ? "bg-amber-500/20 border-amber-500 text-amber-400 border"
                          : p === "medium" ? "bg-blue-500/20 border-blue-500 text-blue-400 border"
                          : "bg-green-500/20 border-green-500 text-green-400 border"
                        : "bg-white/5 border border-white/10 text-white/50 hover:bg-white/10"
                      }
                    `}
                    data-testid={`button-priority-${p}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <Button
                type="submit"
                disabled={!name.trim() || stepConfig.some((step) => !step.title.trim() || !step.description.trim()) || createMutation.isPending}
                className="w-full bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-wider py-6 text-lg"
                data-testid="button-create-workflow"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Zap className="w-5 h-5 mr-2" />
                )}
                Initialize Mission
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
