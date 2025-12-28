import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getComposites, getWorkflows, createComposite, deleteComposite } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  Plus,
  Loader2,
  Layers,
  Trash2,
  ArrowRight,
  X,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { Workflow } from "@shared/schema";

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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const createMutation = useMutation({
    mutationFn: () => createComposite(name, description, selectedIds),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const toggleWorkflow = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-background border border-white/10 p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl text-white">Create Composite Workflow</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-widest mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Combined Project Workflow"
              className="w-full bg-black/30 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary font-display"
              data-testid="input-composite-name"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-widest mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this combined workflow..."
              className="w-full bg-black/30 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary min-h-[80px] resize-none"
              data-testid="input-composite-description"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-widest mb-3">
              Select Workflows to Combine ({selectedIds.length} selected)
            </label>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  onClick={() => toggleWorkflow(workflow.id)}
                  className={`w-full text-left p-4 border transition-all flex items-center justify-between ${
                    selectedIds.includes(workflow.id)
                      ? "bg-primary/10 border-primary/50"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                  data-testid={`workflow-select-${workflow.id}`}
                >
                  <div>
                    <p className="text-white font-medium">{workflow.name}</p>
                    <p className="text-white/40 text-sm mt-1">{workflow.totalSteps} steps</p>
                  </div>
                  {selectedIds.includes(workflow.id) && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {selectedIds.length > 1 && (
            <div className="bg-white/5 border border-white/10 p-4">
              <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-3">
                Workflow Order
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedIds.map((id, index) => {
                  const wf = workflows.find(w => w.id === id);
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-primary/20 text-primary text-sm">
                        {wf?.name}
                      </span>
                      {index < selectedIds.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-white/30" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name || selectedIds.length < 2 || createMutation.isPending}
              className="flex-1 bg-primary hover:bg-primary/90 text-black font-mono uppercase"
              data-testid="button-create-composite"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Layers className="w-4 h-4 mr-2" />
              )}
              Create Composite
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
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

  const { data: composites, isLoading: compositesLoading } = useQuery({
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
          Mission Control
        </Button>
        
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary hover:bg-primary/90 text-black"
          data-testid="button-create-composite"
        >
          <Plus className="w-4 h-4 mr-2" />
          Combine Workflows
        </Button>
      </header>

      <div className="container mx-auto max-w-4xl py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10">
              <Layers className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl text-white tracking-wide">Composite Workflows</h1>
              <p className="text-white/40 mt-1">Combine multiple workflows into one unified process</p>
            </div>
          </div>
        </motion.div>

        {compositesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : composites?.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Layers className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 mb-4">No composite workflows yet</p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary hover:bg-primary/90 text-black"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Composite
            </Button>
          </motion.div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {composites?.map((composite) => (
              <motion.div
                key={composite.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/30 border border-white/10 p-6 group"
                data-testid={`composite-card-${composite.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display text-xl text-white">{composite.name}</h3>
                    <p className="text-white/50 text-sm mt-1">{composite.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(composite.id)}
                    className="text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-delete-${composite.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <span className="text-sm text-white/40">Combined workflow</span>
                </div>
              </motion.div>
            ))}
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
    </div>
  );
}
