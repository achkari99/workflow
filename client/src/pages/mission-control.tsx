import { HeroStatement } from "@/components/ui/hero-statement";
import { MissionCard } from "@/components/ui/mission-card";
import { MomentumTicker } from "@/components/ui/momentum-ticker";
import bgTexture from "@assets/generated_images/subtle_dark_digital_noise_texture_with_faint_grid_overlay.png";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getActiveWorkflow, getWorkflows, advanceWorkflow } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function MissionControl() {
  const queryClient = useQueryClient();
  
  const { data: activeWorkflow, isLoading } = useQuery({
    queryKey: ["activeWorkflow"],
    queryFn: getActiveWorkflow,
  });

  const { data: allWorkflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: getWorkflows,
  });

  const advanceMutation = useMutation({
    mutationFn: advanceWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeWorkflow"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  const handleContinue = () => {
    if (activeWorkflow) {
      advanceMutation.mutate(activeWorkflow.id);
    }
  };

  const secondaryWorkflows = allWorkflows?.filter(w => !w.isActive) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative selection:bg-primary/30 selection:text-primary-foreground">
      {/* Background Texture */}
      <div 
        className="fixed inset-0 opacity-20 pointer-events-none z-0 mix-blend-overlay"
        style={{
          backgroundImage: `url(${bgTexture})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Grid Overlay for technical feel */}
      <div className="fixed inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none z-0" />

      {/* Main Layout */}
      <div className="relative z-10 container mx-auto px-4 py-8 md:py-12 lg:py-16 min-h-screen flex flex-col">
        
        {/* Top Header / Status Bar */}
        <header className="flex justify-between items-center mb-12 md:mb-20 border-b border-white/5 pb-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            System Online
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            LIVING WORKFLOW v1.0
          </div>
        </header>

        <main className="flex-1 grid lg:grid-cols-12 gap-12 lg:gap-8 items-start">
          {/* Left Column - Statement */}
          <div className="lg:col-span-5 flex flex-col justify-between h-full">
            <div>
              <HeroStatement />
              <div className="mt-8 hidden lg:block">
                <MomentumTicker />
              </div>
            </div>
            
            {/* Secondary Missions (Desktop) */}
            {secondaryWorkflows.length > 0 && (
              <div className="mt-auto pt-12 hidden lg:block opacity-60 hover:opacity-100 transition-opacity">
                <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">Secondary Objectives</h3>
                <ul className="space-y-3">
                  {secondaryWorkflows.slice(0, 3).map((workflow) => (
                    <li key={workflow.id} className="flex items-center gap-3 text-sm group cursor-pointer">
                      <span className="w-1.5 h-1.5 bg-white/20 rotate-45 group-hover:bg-primary transition-colors" />
                      <span className="text-muted-foreground group-hover:text-white transition-colors">{workflow.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right Column - Active Mission */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-end justify-center lg:justify-start pt-8 lg:pt-0">
            {activeWorkflow ? (
              <MissionCard 
                questName={activeWorkflow.name}
                stepName={`Step ${activeWorkflow.currentStep} — ${activeWorkflow.description || "In Progress"}`}
                progress={(activeWorkflow.currentStep / activeWorkflow.totalSteps) * 100}
                totalSteps={activeWorkflow.totalSteps}
                currentStep={activeWorkflow.currentStep}
                onContinue={handleContinue}
                isLoading={advanceMutation.isPending}
              />
            ) : (
              <div className="text-center text-muted-foreground max-w-md">
                <p className="text-lg mb-4">No active quest detected.</p>
                <p className="text-sm">Create a new workflow to begin your mission.</p>
              </div>
            )}
            
            {/* Mobile Momentum Ticker */}
            <div className="mt-12 w-full lg:hidden">
              <MomentumTicker />
            </div>

            {/* Mobile Secondary Missions */}
            {secondaryWorkflows.length > 0 && (
              <div className="mt-12 w-full lg:hidden opacity-80">
                <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">Secondary Objectives</h3>
                <ul className="space-y-3">
                  {secondaryWorkflows.slice(0, 3).map((workflow) => (
                    <li key={workflow.id} className="flex items-center gap-3 text-sm border-b border-white/5 pb-2">
                      <span className="w-1.5 h-1.5 bg-white/20 rotate-45" />
                      <span className="text-muted-foreground">{workflow.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
