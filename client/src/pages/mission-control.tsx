import { HeroStatement } from "@/components/ui/hero-statement";
import { MissionCard } from "@/components/ui/mission-card";
import { MomentumTicker } from "@/components/ui/momentum-ticker";
import bgTexture from "@assets/generated_images/subtle_dark_digital_noise_texture_with_faint_grid_overlay.png";

export default function MissionControl() {
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
            <div className="mt-auto pt-12 hidden lg:block opacity-60 hover:opacity-100 transition-opacity">
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">Secondary Objectives</h3>
              <ul className="space-y-3">
                {["Review Q4 Analytics", "Update Design System", "Client Sync Prep"].map((mission, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm group cursor-pointer">
                    <span className="w-1.5 h-1.5 bg-white/20 rotate-45 group-hover:bg-primary transition-colors" />
                    <span className="text-muted-foreground group-hover:text-white transition-colors">{mission}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column - Active Mission */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-end justify-center lg:justify-start pt-8 lg:pt-0">
            <MissionCard 
              questName="Core Platform Launch"
              stepName="Step 3 — Lock the Scope"
              progress={35}
              totalSteps={8}
              currentStep={3}
            />
            
            {/* Mobile Momentum Ticker */}
            <div className="mt-12 w-full lg:hidden">
              <MomentumTicker />
            </div>

            {/* Mobile Secondary Missions */}
            <div className="mt-12 w-full lg:hidden opacity-80">
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">Secondary Objectives</h3>
               <ul className="space-y-3">
                {["Review Q4 Analytics", "Update Design System", "Client Sync Prep"].map((mission, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm border-b border-white/5 pb-2">
                    <span className="w-1.5 h-1.5 bg-white/20 rotate-45" />
                    <span className="text-muted-foreground">{mission}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
