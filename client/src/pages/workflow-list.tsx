import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkflows, setActiveWorkflow, deleteWorkflow } from "@/lib/api";
import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  Plus, 
  Loader2,
  Target,
  Trash2,
  Play,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Workflow } from "@shared/schema";

function WorkflowCard({ 
  workflow, 
  onActivate, 
  onOpen,
  onDelete,
  isActivating 
}: { 
  workflow: Workflow;
  onActivate: () => void;
  onOpen: () => void;
  onDelete: () => void;
  isActivating: boolean;
}) {
  const progress = (workflow.currentStep / workflow.totalSteps) * 100;
  
  const priorityColors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    low: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-black/30 border ${workflow.isActive ? "border-primary/50" : "border-white/10"} p-6 relative group`}
      data-testid={`workflow-card-${workflow.id}`}
    >
      {workflow.isActive && (
        <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-black text-xs font-mono uppercase tracking-wider">
          Active
        </div>
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display text-xl text-white">{workflow.name}</h3>
          <p className="text-white/50 text-sm mt-1">{workflow.description}</p>
        </div>
        <span className={`px-2 py-1 text-xs font-mono uppercase border ${priorityColors[workflow.priority] || priorityColors.medium}`}>
          {workflow.priority}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-white/40 mb-2">
          <span>Progress</span>
          <span>{workflow.currentStep} of {workflow.totalSteps} steps</span>
        </div>
        <div className="h-1 bg-white/10">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={onOpen}
          className="flex-1 bg-white/5 hover:bg-white/10 text-white"
          data-testid={`button-open-${workflow.id}`}
        >
          <Target className="w-4 h-4 mr-2" />
          Open
        </Button>
        
        {!workflow.isActive && (
          <Button
            onClick={onActivate}
            disabled={isActivating}
            className="bg-primary/20 hover:bg-primary/30 text-primary"
            data-testid={`button-activate-${workflow.id}`}
          >
            {isActivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          </Button>
        )}
        
        <Button
          onClick={onDelete}
          variant="ghost"
          className="text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
          data-testid={`button-delete-${workflow.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

export default function WorkflowList() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: workflows, isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: getWorkflows,
  });

  const activateMutation = useMutation({
    mutationFn: setActiveWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["activeWorkflow"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["activeWorkflow"] });
    },
  });

  const activeWorkflows = workflows?.filter(w => w.status === "active") || [];
  const completedWorkflows = workflows?.filter(w => w.currentStep >= w.totalSteps) || [];

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
          Home
        </Button>
        
        <Button
          onClick={() => navigate("/missions/new")}
          className="bg-primary hover:bg-primary/90 text-black"
          data-testid="button-new-workflow"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Mission
        </Button>
      </header>

      <div className="container mx-auto max-w-4xl py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="font-display text-4xl text-white tracking-wide">All Missions</h1>
          <p className="text-white/40 mt-2">Manage and track all your missions</p>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : workflows?.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Target className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 mb-4">No missions found</p>
            <Button
              onClick={() => navigate("/missions/new")}
              className="bg-primary hover:bg-primary/90 text-black"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Mission
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-12">
            {activeWorkflows.length > 0 && (
              <div>
                <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Active Missions ({activeWorkflows.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {activeWorkflows.map((workflow) => (
                    <WorkflowCard
                      key={workflow.id}
                      workflow={workflow}
                      onActivate={() => activateMutation.mutate(workflow.id)}
                      onOpen={() => navigate(`/workflow/${workflow.id}`)}
                      onDelete={() => deleteMutation.mutate(workflow.id)}
                      isActivating={activateMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {completedWorkflows.length > 0 && (
              <div>
                <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3" />
                  Completed Missions ({completedWorkflows.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {completedWorkflows.map((workflow) => (
                    <WorkflowCard
                      key={workflow.id}
                      workflow={workflow}
                      onActivate={() => activateMutation.mutate(workflow.id)}
                      onOpen={() => navigate(`/workflow/${workflow.id}`)}
                      onDelete={() => deleteMutation.mutate(workflow.id)}
                      isActivating={activateMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
