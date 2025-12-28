import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import MissionControl from "@/pages/mission-control";
import WorkflowWorkspace from "@/pages/workflow-workspace";
import WorkflowCreate from "@/pages/workflow-create";
import WorkflowList from "@/pages/workflow-list";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={MissionControl} />
      <Route path="/workflow/:id" component={WorkflowWorkspace} />
      <Route path="/workflows" component={WorkflowList} />
      <Route path="/workflows/new" component={WorkflowCreate} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
