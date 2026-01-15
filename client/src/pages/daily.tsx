import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDailyTask, deleteDailyTask, getDailyTasks, updateDailyTask } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Check, ChevronLeft, ListChecks, Loader2, Plus, Trash2, X } from "lucide-react";

export default function DailyPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["daily-tasks"],
    queryFn: getDailyTasks,
  });

  const createMutation = useMutation({
    mutationFn: () => createDailyTask({ title: title.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      setTitle("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => updateDailyTask(editingId!, { title: editTitle.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      setEditingId(null);
      setEditTitle("");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (payload: { id: number; isCompleted: boolean }) =>
      updateDailyTask(payload.id, { isCompleted: payload.isCompleted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDailyTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
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
          Home
        </Button>
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/40">
          <ListChecks className="w-4 h-4 text-primary" />
          Daily
        </div>
        <div className="w-[72px]" />
      </header>

      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl text-white tracking-wide">Daily Tasks</h1>
          <p className="text-white/40 mt-2">Simple checklist that resets whenever you want.</p>
        </div>

        <div className="border border-white/10 bg-black/40 p-5 mb-8">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/40 mb-3">
            <Plus className="w-3 h-3 text-primary" />
            New Task
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="flex-1 bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
            />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !title.trim()}
              className="bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : tasks.length > 0 ? (
          <div className="grid gap-3">
            {tasks.map((task) => {
              const isEditing = editingId === task.id;
              return (
                <div
                  key={task.id}
                  className={`border border-white/10 bg-white/5 p-4 flex items-center gap-3 ${task.isCompleted ? "opacity-70" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: task.id, isCompleted: !task.isCompleted })}
                    className={`h-6 w-6 border border-white/20 flex items-center justify-center ${task.isCompleted ? "bg-primary/20 border-primary/40" : "bg-black/40"}`}
                  >
                    {task.isCompleted && <Check className="w-3 h-3 text-primary" />}
                  </button>
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                      />
                      <Button
                        size="sm"
                        onClick={() => updateMutation.mutate()}
                        disabled={updateMutation.isPending || !editTitle.trim()}
                        className="bg-primary hover:bg-primary/90 text-black text-xs"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditTitle("");
                        }}
                        className="text-white/50 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className={`text-sm ${task.isCompleted ? "line-through text-white/40" : "text-white"}`}>
                          {task.title}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(task.id);
                          setEditTitle(task.title);
                        }}
                        className="text-white/40 hover:text-primary"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(task.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-white/40">
            No tasks yet. Add your first one above.
          </div>
        )}
      </div>
    </div>
  );
}
