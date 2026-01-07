import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createNote, deleteNote, getNotes, updateNote } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2, Plus, StickyNote, Trash2, PencilLine, X } from "lucide-react";
import { useLocation } from "wouter";

export default function NotesPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const { data: notes, isLoading } = useQuery({
    queryKey: ["notes"],
    queryFn: getNotes,
  });

  const createMutation = useMutation({
    mutationFn: () => createNote({ title: title.trim(), content: content.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setTitle("");
      setContent("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateNote(editingId!, {
        title: editTitle.trim(),
        content: editContent.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setEditingId(null);
      setEditTitle("");
      setEditContent("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const startEdit = (note: { id: number; title: string; content: string | null }) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content || "");
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
          <StickyNote className="w-4 h-4 text-primary" />
          Notes
        </div>
        <div className="w-[72px]" />
      </header>

      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl text-white tracking-wide">Quick Notes</h1>
          <p className="text-white/40 mt-2">Capture random thoughts and ideas.</p>
        </div>

        <div className="border border-white/10 bg-black/40 p-5 mb-8">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/40 mb-3">
            <Plus className="w-3 h-3 text-primary" />
            New Note
          </div>
          <div className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note..."
              className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary min-h-[140px] resize-none"
            />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !title.trim()}
              className="bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Note
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : notes && notes.length > 0 ? (
          <div className="grid gap-4">
            {notes.map((note) => {
              const isEditing = editingId === note.id;
              return (
                <div key={note.id} className="border border-white/10 bg-black/30 p-5">
                  {isEditing ? (
                    <div className="space-y-3">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                      />
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary min-h-[120px] resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => updateMutation.mutate()}
                          disabled={updateMutation.isPending || !editTitle.trim()}
                          className="bg-primary hover:bg-primary/90 text-black font-mono uppercase tracking-widest"
                        >
                          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingId(null);
                            setEditTitle("");
                            setEditContent("");
                          }}
                          className="text-white/50 hover:text-white"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg text-white">{note.title}</h2>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(note)}
                            className="text-white/50 hover:text-primary"
                          >
                            <PencilLine className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(note.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-white/50 whitespace-pre-wrap">
                        {note.content || "No content."}
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-white/40">
            No notes yet. Add your first note above.
          </div>
        )}
      </div>
    </div>
  );
}
