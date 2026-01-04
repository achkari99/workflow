import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronLeft, Loader2, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCompositeSessions } from "@/lib/api";
import type { CompositeWorkflowWithItems } from "@shared/schema";

type CompositeSessionSummary = {
  id: number;
  name: string | null;
  compositeId: number;
  ownerId: string | null;
  createdAt: string;
  composite?: { id: number; name: string | null } | null;
};

export default function SessionsHub() {
  const [, navigate] = useLocation();

  const { data: sessions, isLoading } = useQuery<CompositeSessionSummary[]>({
    queryKey: ["composite-sessions"],
    queryFn: getCompositeSessions,
  });

  return (
    <div className="min-h-screen bg-black text-foreground">
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
          onClick={() => navigate("/sessions/new")}
          className="bg-primary hover:bg-primary/90 text-black"
          data-testid="button-new-session"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Session
        </Button>
      </header>

      <div className="container mx-auto max-w-5xl py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="font-display text-4xl text-white tracking-wide">Sessions</h1>
          <p className="text-white/40 mt-2">Jump back into active collaborations or start a new one.</p>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Users className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 mb-4">No sessions yet</p>
            <Button onClick={() => navigate("/sessions/new")} className="bg-primary hover:bg-primary/90 text-black">
              <Plus className="w-4 h-4 mr-2" />
              Create First Session
            </Button>
          </motion.div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => navigate(`/sessions/${session.id}`)}
                className="border border-white/10 bg-black/40 p-5 text-left hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-white/40 uppercase tracking-widest">Session</span>
                  <span className="text-[10px] text-white/30">
                    {new Date(session.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-white text-lg font-display">
                  {session.name || session.composite?.name || "Untitled Session"}
                </h3>
                <p className="text-xs text-white/40 mt-1">
                  {session.composite?.name || "Workflow Session"}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
