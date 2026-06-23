import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDailyTask, deleteDailyTask, getDailyTasks, reorderDailyTasks, updateDailyTask } from "@/lib/api";
import type { DailyTask } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronLeft, ListChecks, Loader2, Plus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type DailyTaskView = DailyTask & {
  optimisticKey?: number;
};

const priorityOptions = ["critical", "high", "medium", "low"] as const;
type DailyTaskPriority = typeof priorityOptions[number];

const priorityColors: Record<DailyTaskPriority, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  low: "bg-green-500/20 text-green-400 border-green-500/30",
};

function getPriorityClass(priority?: string | null) {
  return priorityColors[(priority || "medium") as DailyTaskPriority] || priorityColors.medium;
}

function formatTaskDate(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DailyPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<DailyTaskPriority>("medium");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [createError, setCreateError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [reorderError, setReorderError] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["daily-tasks"],
    queryFn: getDailyTasks,
  });
  const orderedTasks = [...tasks].sort((a, b) => {
    const completionOrder = Number(a.isCompleted) - Number(b.isCompleted);
    return completionOrder || a.orderIndex - b.orderIndex;
  });

  const createMutation = useMutation({
    mutationFn: (payload: { title: string; priority: DailyTaskPriority }) => createDailyTask(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["daily-tasks"] });
      setCreateError("");
      setDeleteError("");
      setReorderError("");
      const previousTasks = queryClient.getQueryData<DailyTaskView[]>(["daily-tasks"]);
      const tempId = -Date.now();
      const now = new Date();
      const nextOrderIndex =
        previousTasks && previousTasks.length > 0
          ? Math.min(...previousTasks.map((task) => task.orderIndex)) - 1
          : 0;

      queryClient.setQueryData<DailyTaskView[]>(["daily-tasks"], (currentTasks = []) => [
        {
          id: tempId,
          optimisticKey: tempId,
          userId: "optimistic",
          title: payload.title,
          priority: payload.priority,
          orderIndex: nextOrderIndex,
          isCompleted: false,
          createdAt: now,
          updatedAt: now,
        },
        ...currentTasks,
      ]);

      setTitle("");
      return { previousTasks, tempId };
    },
    onSuccess: (createdTask, _payload, context) => {
      queryClient.setQueryData<DailyTaskView[]>(["daily-tasks"], (currentTasks = []) =>
        currentTasks.map((task) =>
          task.id === context.tempId ? { ...createdTask, optimisticKey: context.tempId } : task
        )
      );
    },
    onError: (_error, _payload, context) => {
      setCreateError("Adding this daily task was unsuccessful. Please try again.");
      queryClient.setQueryData<DailyTaskView[]>(["daily-tasks"], (currentTasks = []) =>
        context?.tempId
          ? currentTasks.filter((task) => task.id !== context.tempId)
          : context?.previousTasks || currentTasks
      );
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
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDailyTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["daily-tasks"] });
      setDeleteError("");
      const previousTasks = queryClient.getQueryData<DailyTaskView[]>(["daily-tasks"]);

      queryClient.setQueryData<DailyTaskView[]>(["daily-tasks"], (currentTasks = []) =>
        currentTasks.filter((task) => task.id !== id)
      );

      if (editingId === id) {
        setEditingId(null);
        setEditTitle("");
      }

      return { previousTasks };
    },
    onError: (_error, _id, context) => {
      setDeleteError("Deleting this daily task was unsuccessful. Please try again.");
      if (context?.previousTasks) {
        queryClient.setQueryData(["daily-tasks"], context.previousTasks);
      }
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) => reorderDailyTasks(orderedIds),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ["daily-tasks"] });
      setReorderError("");
      const previousTasks = queryClient.getQueryData<DailyTaskView[]>(["daily-tasks"]);
      const orderById = new Map(orderedIds.map((id, index) => [id, index]));
      queryClient.setQueryData<DailyTaskView[]>(["daily-tasks"], (currentTasks = []) =>
        currentTasks.map((task) => ({
          ...task,
          orderIndex: orderById.get(task.id) ?? task.orderIndex,
        }))
      );
      return { previousTasks };
    },
    onSuccess: (reorderedTasks) => {
      queryClient.setQueryData(["daily-tasks"], reorderedTasks);
    },
    onError: (_error, _orderedIds, context) => {
      setReorderError("Saving the new task order was unsuccessful. Your previous order was restored.");
      if (context?.previousTasks) {
        queryClient.setQueryData(["daily-tasks"], context.previousTasks);
      }
    },
  });

  const moveTask = (taskId: number, direction: -1 | 1) => {
    const currentIndex = orderedTasks.findIndex((task) => task.id === taskId);
    const targetIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= orderedTasks.length ||
      orderedTasks[targetIndex].isCompleted !== orderedTasks[currentIndex].isCompleted
    ) {
      return;
    }
    const nextOrder = [...orderedTasks];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [
      nextOrder[targetIndex],
      nextOrder[currentIndex],
    ];
    reorderMutation.mutate(nextOrder.map((task) => task.id));
  };

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

        <AnimatePresence>
          {(createError || deleteError || reorderError) && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="mb-5 border border-red-400/25 bg-red-500/10 px-4 py-3 shadow-[0_0_35px_rgba(239,68,68,0.12)]"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center border border-red-300/20 bg-red-500/10 text-red-300">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-red-200">
                    {reorderError ? "Order Not Saved" : deleteError ? "Task Not Deleted" : "Task Not Added"}
                  </p>
                  <p className="mt-1 text-sm text-red-100/80">{reorderError || deleteError || createError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreateError("");
                    setDeleteError("");
                    setReorderError("");
                  }}
                  className="text-red-100/45 transition hover:text-red-100"
                  aria-label="Dismiss error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="border border-white/10 bg-black/40 p-5 mb-8">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/40 mb-3">
            <Plus className="w-3 h-3 text-primary" />
            New Task
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (createError) setCreateError("");
                if (deleteError) setDeleteError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim() && !createMutation.isPending) {
                  e.preventDefault();
                  createMutation.mutate({ title: title.trim(), priority });
                }
              }}
              placeholder="Task title"
              className="flex-1 bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
            />
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {priorityOptions.map((option) => {
                const isSelected = priority === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPriority(option)}
                    className={`border px-3 py-2 text-xs font-mono uppercase tracking-widest transition ${
                      isSelected
                        ? `${priorityColors[option]} shadow-[0_0_22px_rgba(34,211,238,0.08)]`
                        : "border-white/10 bg-black/30 text-white/35 hover:border-white/20 hover:text-white/70"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <Button
              onClick={() => createMutation.mutate({ title: title.trim(), priority })}
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
              {orderedTasks.map((task, taskIndex) => {
                const isEditing = editingId === task.id;
                const previousTask = orderedTasks[taskIndex - 1];
                const nextTask = orderedTasks[taskIndex + 1];
                const canMoveUp = Boolean(previousTask && previousTask.isCompleted === task.isCompleted);
                const canMoveDown = Boolean(nextTask && nextTask.isCompleted === task.isCompleted);
                return (
                  <motion.div
                    key={(task as DailyTaskView).optimisticKey ?? task.id}
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
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${task.isCompleted ? "line-through text-white/40" : "text-white"}`}>
                          {task.title}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                        <span className={`inline-flex border px-2 py-1 text-[10px] font-mono uppercase tracking-widest ${getPriorityClass(task.priority)}`}>
                          {task.priority || "medium"}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">
                          {formatTaskDate(task.createdAt)}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col">
                        <button
                          type="button"
                          onClick={() => moveTask(task.id, -1)}
                          disabled={!canMoveUp || reorderMutation.isPending || createMutation.isPending || task.id < 0}
                          className="p-1 text-white/30 transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-20"
                          aria-label={`Move ${task.title} up`}
                          title="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveTask(task.id, 1)}
                          disabled={!canMoveDown || reorderMutation.isPending || createMutation.isPending || task.id < 0}
                          className="p-1 text-white/30 transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-20"
                          aria-label={`Move ${task.title} down`}
                          title="Move down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
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
