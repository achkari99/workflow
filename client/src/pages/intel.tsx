import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkflow, getStepIntel, addIntelDoc } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  FileText, 
  Plus,
  Loader2,
  BookOpen,
  Link2,
  StickyNote,
  FileCode,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { IntelDoc, Step } from "@shared/schema";

const docTypeIcons: Record<string, typeof FileText> = {
  note: StickyNote,
  guideline: BookOpen,
  reference: Link2,
  code: FileCode,
};

const docTypeColors: Record<string, string> = {
  note: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  guideline: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  reference: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  code: "bg-green-500/20 text-green-400 border-green-500/30",
};

function IntelCard({ doc }: { doc: IntelDoc }) {
  const Icon = docTypeIcons[doc.docType] || FileText;
  const colorClass = docTypeColors[doc.docType] || docTypeColors.note;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/30 border border-white/10 p-6 hover:border-primary/30 transition-colors group"
      data-testid={`intel-card-${doc.id}`}
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 ${colorClass} border`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-lg text-white mb-2">{doc.title}</h3>
          <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap">{doc.content}</p>
          <div className="mt-4 flex items-center gap-3 text-xs text-white/30">
            <span className={`px-2 py-1 border ${colorClass}`}>{doc.docType}</span>
            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AddDocModal({ 
  stepId, 
  onClose, 
  onSuccess 
}: { 
  stepId: number; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState("note");

  const addMutation = useMutation({
    mutationFn: () => addIntelDoc(stepId, { title, content, docType }),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

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
        className="bg-background border border-white/10 p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl text-white">Add Intel Document</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-widest mb-2">
              Document Type
            </label>
            <div className="flex gap-2 flex-wrap">
              {["note", "guideline", "reference", "code"].map((type) => (
                <button
                  key={type}
                  onClick={() => setDocType(type)}
                  className={`px-3 py-2 text-sm border transition-all ${
                    docType === type 
                      ? docTypeColors[type] 
                      : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                  }`}
                  data-testid={`button-doctype-${type}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-widest mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="w-full bg-black/30 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
              data-testid="input-doc-title"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-widest mb-2">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Document content..."
              className="w-full bg-black/30 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary min-h-[150px] resize-none"
              data-testid="input-doc-content"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!title || !content || addMutation.isPending}
              className="flex-1 bg-primary hover:bg-primary/90 text-black font-mono uppercase"
              data-testid="button-save-doc"
            >
              {addMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Document
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

export default function IntelPage() {
  const params = useParams<{ workflowId: string; stepId?: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const workflowId = parseInt(params.workflowId || "0");
  const stepIdParam = params.stepId ? parseInt(params.stepId) : null;
  
  const [selectedStepId, setSelectedStepId] = useState<number | null>(stepIdParam);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: workflow, isLoading: workflowLoading } = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: () => getWorkflow(workflowId),
    enabled: !!workflowId,
  });

  const { data: intelDocs, isLoading: intelLoading } = useQuery({
    queryKey: ["intel", selectedStepId],
    queryFn: () => getStepIntel(selectedStepId!),
    enabled: !!selectedStepId,
  });

  if (workflowLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 border-b border-white/5 bg-black/40 flex items-center justify-between px-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(`/workflow/${workflowId}`)}
          className="text-white/60 hover:text-white"
          data-testid="button-back"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Workspace
        </Button>
        
        {selectedStepId && (
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-primary/20 hover:bg-primary/30 text-primary"
            data-testid="button-add-doc"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Document
          </Button>
        )}
      </header>

      <div className="container mx-auto max-w-6xl py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl text-white tracking-wide">Intel Center</h1>
              <p className="text-white/40 mt-1">{workflow?.name}</p>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4">
              Steps
            </h2>
            <div className="space-y-2">
              {workflow?.steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  className={`w-full text-left p-3 border transition-all ${
                    selectedStepId === step.id
                      ? "bg-primary/10 border-primary/50 text-white"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                  }`}
                  data-testid={`step-select-${step.id}`}
                >
                  <span className="text-xs font-mono text-white/30 block mb-1">
                    Step {step.stepNumber}
                  </span>
                  <span className="text-sm">{step.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            {!selectedStepId ? (
              <div className="text-center py-20">
                <BookOpen className="w-16 h-16 text-white/10 mx-auto mb-4" />
                <p className="text-white/40">Select a step to view intel documents</p>
              </div>
            ) : intelLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : intelDocs?.length === 0 ? (
              <div className="text-center py-20">
                <FileText className="w-16 h-16 text-white/10 mx-auto mb-4" />
                <p className="text-white/40 mb-4">No intel documents for this step</p>
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="bg-primary hover:bg-primary/90 text-black"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Document
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {intelDocs?.map((doc) => (
                  <IntelCard key={doc.id} doc={doc} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && selectedStepId && (
          <AddDocModal
            stepId={selectedStepId}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["intel", selectedStepId] });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
