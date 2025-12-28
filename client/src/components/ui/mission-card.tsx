import { motion } from "framer-motion";
import { ArrowRight, Lock, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MissionCardProps {
  questName: string;
  stepName: string;
  progress: number;
  totalSteps: number;
  currentStep: number;
  onContinue?: () => void;
  isLoading?: boolean;
}

export function MissionCard({
  questName = "Core Platform Launch",
  stepName = "Step 3 — Lock the Scope",
  progress = 35,
  totalSteps = 8,
  currentStep = 3,
  onContinue,
  isLoading = false,
}: MissionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
      className="w-full max-w-2xl relative group"
    >
      {/* Glow effect behind */}
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-purple-500/50 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500" />
      
      <Card className="relative border-primary/30 bg-card/90 backdrop-blur-sm overflow-hidden clip-corner-tr border-l-4 border-l-primary">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Target className="w-32 h-32 text-primary" />
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono uppercase tracking-wider border border-primary/20">
              Active Quest
            </span>
            <span className="text-muted-foreground text-xs font-mono uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-500" />
              High Priority
            </span>
          </div>
          <CardTitle className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tight text-white leading-none">
            {questName}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-8 pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-sm text-muted-foreground font-mono mb-1 uppercase tracking-widest">Current Objective</p>
                <h3 className="text-2xl font-sans font-medium text-white flex items-center gap-2">
                  <span className="text-primary">{stepName}</span>
                </h3>
              </div>
              <div className="text-right font-mono text-xs text-muted-foreground">
                PHASE {currentStep} / {totalSteps}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-1 h-2">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 rounded-sm transition-all duration-500 ${
                      i < currentStep
                        ? "bg-primary"
                        : i === currentStep
                        ? "bg-primary/50 animate-pulse"
                        : "bg-secondary"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/5">
            <Button 
              size="lg" 
              onClick={onContinue}
              disabled={isLoading || currentStep >= totalSteps}
              data-testid="button-continue-mission"
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] transition-all font-display font-bold text-lg h-14 uppercase tracking-wide group/btn relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-500 ease-in-out skew-x-12" />
              <span className="relative flex items-center gap-2">
                {currentStep >= totalSteps ? "Quest Complete" : "Continue Mission"} <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
              </span>
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              className="flex-1 font-mono uppercase tracking-wider h-14 border-white/10 hover:bg-white/5 hover:text-white hover:border-white/20"
            >
              <Lock className="w-4 h-4 mr-2 text-muted-foreground" />
              View Intel
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
