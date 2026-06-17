import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDailyTask, deleteDailyTask, getDailyTasks, updateDailyTask } from "@/lib/api";
import type { DailyTask } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Check, ChevronLeft, ListChecks, Loader2, Plus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

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
    mutationFn: (taskTitle: string) => createDailyTask({ title: taskTitle }),
    onMutate: async (taskTitle) => {
      await queryClient.cancelQueries({ queryKey: ["daily-tasks"] });
      const previousTasks = queryClient.getQueryData<DailyTask[]>(["daily-tasks"]);
      const tempId = -Date.now();
      const now = new Date();

      queryClient.setQueryData<DailyTask[]>(["daily-tasks"], (currentTasks = []) => [
        {
          id: tempId,
          userId: "optimistic",
          title: taskTitle,
          isCompleted: false,
          createdAt: now,
          updatedAt: now,
        },
        ...currentTasks,
      ]);

      setTitle("");
      return { previousTasks, tempId };
    },
    onSuccess: (createdTask, _taskTitle, context) => {
      queryClient.setQueryData<DailyTask[]>(["daily-tasks"], (currentTasks = []) =>
        currentTasks.map((task) => (task.id === context.tempId ? createdTask : task))
      );
    },
    onError: (_error, _taskTitle, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["daily-tasks"], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
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
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["daily-tasks"] });
      const previousTasks = queryClient.getQueryData<DailyTask[]>(["daily-tasks"]);

      queryClient.setQueryData<DailyTask[]>(["daily-tasks"], (currentTasks = []) =>
        currentTasks.map((task) =>
          task.id === payload.id ? { ...task, isCompleted: payload.isCompleted } : task
        )
      );

      return { previousTasks };
    },
    onError: (_error, _payload, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["daily-tasks"], context.previousTasks);
      }
    },
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim() && !createMutation.isPending) {
                  e.preventDefault();
                  createMutation.mutate(title.trim());
                }
              }}
              placeholder="Task title"
              className="flex-1 bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
            />
            <Button
              onClick={() => createMutation.mutate(title.trim())}
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
            <AnimatePresence initial={false}>
              {tasks.map((task) => {
                const isEditing = editingId === task.id;
                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: task.isCompleted ? 0.7 : 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 18, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="border border-white/10 bg-white/5 p-4 flex items-center gap-3"
                  >
                  <motion.button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: task.id, isCompleted: !task.isCompleted })}
                    whileTap={{ scale: 0.82 }}
                    animate={{
                      scale: task.isCompleted ? 1.08 : 1,
                      boxShadow: task.isCompleted
                        ? "0 0 22px rgba(34, 211, 238, 0.35)"
                        : "0 0 0 rgba(34, 211, 238, 0)",
                    }}
                    transition={{ type: "spring", stiffness: 520, damping: 28 }}
                    className={`h-6 w-6 border flex items-center justify-center transition-colors duration-150 ${task.isCompleted ? "bg-primary/20 border-primary/50" : "bg-black/40 border-white/20 hover:border-primary/40"}`}
                    aria-pressed={task.isCompleted}
                  >
                    <AnimatePresence initial={false}>
                      {task.isCompleted && (
                        <motion.span
                          key="check"
                          initial={{ opacity: 0, scale: 0.4, rotate: -45 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.35, rotate: 35 }}
                          transition={{ duration: 0.16 }}
                        >
                          <Check className="w-3 h-3 text-primary" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
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
                  </motion.div>
                );
              })}
            </AnimatePresence>
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
