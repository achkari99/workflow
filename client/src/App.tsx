import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import MissionControl from "@/pages/mission-control";
import WorkflowWorkspace from "@/pages/workflow-workspace";
import WorkflowCreate from "@/pages/workflow-create";
import WorkflowList from "@/pages/workflow-list";
import IntelPage from "@/pages/intel";
import CompositesPage from "@/pages/composites";
import CompositeWorkspace from "@/pages/composite-workspace";
import CompositeSession from "@/pages/composite-session";
import CompositeSessions from "@/pages/composite-sessions";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component, ...rest }: { component: any, path: string }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-lime-500" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/">
        {(params) => <ProtectedRoute component={MissionControl} path="/" {...params} />}
      </Route>
      <Route path="/workflow/:id">
        {(params) => <ProtectedRoute component={WorkflowWorkspace} path="/workflow/:id" {...params} />}
      </Route>
      <Route path="/workflows">
        {(params) => <ProtectedRoute component={WorkflowList} path="/workflows" {...params} />}
      </Route>
      <Route path="/workflows/new">
        {(params) => <ProtectedRoute component={WorkflowCreate} path="/workflows/new" {...params} />}
      </Route>
      <Route path="/intel/:workflowId/:stepId?">
        {(params) => <ProtectedRoute component={IntelPage} path="/intel/:workflowId/:stepId?" {...params} />}
      </Route>
      <Route path="/composites">
        {(params) => <ProtectedRoute component={CompositesPage} path="/composites" {...params} />}
      </Route>
      <Route path="/composite-sessions">
        {(params) => <ProtectedRoute component={CompositeSessions} path="/composite-sessions" {...params} />}
      </Route>
      <Route path="/composite-sessions/:id/manage">
        {(params) => <ProtectedRoute component={CompositeSessions} path="/composite-sessions/:id/manage" {...params} />}
      </Route>
      <Route path="/composites/:id">
        {(params) => <ProtectedRoute component={CompositeWorkspace} path="/composites/:id" {...params} />}
      </Route>
      <Route path="/composite-sessions/:id">
        {(params) => <ProtectedRoute component={CompositeSession} path="/composite-sessions/:id" {...params} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-lime-500/30">
          <Toaster position="bottom-right" theme="dark" />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
