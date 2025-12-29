import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Lock, Target, Zap, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useLocation } from "wouter";

interface MissionCardProps {
  questName: string;
  stepName: string;
  progress: number;
  totalSteps: number;
  currentStep: number;
  workflowId?: number;
  onContinue?: () => void;
  isLoading?: boolean;
}

export function MissionCard({
  questName = "Core Platform Launch",
  stepName = "Step 3 — Lock the Scope",
  progress = 35,
  totalSteps = 8,
  currentStep = 3,
  workflowId,
  onContinue,
  isLoading = false,
}: MissionCardProps) {
  const [, navigate] = useLocation();
  const [showSuccess, setShowSuccess] = useState(false);
  const isComplete = currentStep >= totalSteps;

  const handleContinue = () => {
    if (workflowId) {
      navigate(`/workflow/${workflowId}`);
    } else if (onContinue && !isComplete) {
      setShowSuccess(true);
      onContinue();
      setTimeout(() => setShowSuccess(false), 800);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full max-w-2xl relative group"
    >
      {/* Ambient glow effect - breathing animation */}
      <motion.div
        className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-purple-500/50 rounded-lg blur opacity-20"
        animate={{
          opacity: [0.15, 0.25, 0.15],
          scale: [1, 1.02, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Hover glow intensifier */}
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-purple-500/50 rounded-lg blur opacity-0 group-hover:opacity-30 transition-opacity duration-500" />

      <Card className="relative border-primary/30 bg-card/90 backdrop-blur-sm overflow-hidden clip-corner-tr border-l-4 border-l-primary group-hover:border-l-primary/80 transition-colors duration-300">
        {/* Background icon with subtle rotation */}
        <motion.div
          className="absolute top-0 right-0 p-4 opacity-[0.07] pointer-events-none"
          animate={{ rotate: [0, 3, -3, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <Target className="w-32 h-32 text-primary" />
        </motion.div>

        <CardHeader className="pb-2">
          <motion.div
            className="flex items-center gap-2 mb-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <motion.span
              className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono uppercase tracking-wider border border-primary/20"
              animate={{
                boxShadow: ["0 0 0px hsla(190, 100%, 50%, 0)", "0 0 8px hsla(190, 100%, 50%, 0.3)", "0 0 0px hsla(190, 100%, 50%, 0)"]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              Active Quest
            </motion.span>
            <span className="text-muted-foreground text-xs font-mono uppercase tracking-wider flex items-center gap-1">
              <motion.span
                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Zap className="w-3 h-3 text-yellow-500" />
              </motion.span>
              High Priority
            </span>
          </motion.div>

          <CardTitle className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tight text-white leading-none">
            <AnimatePresence mode="wait">
              <motion.span
                key={questName}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {questName}
              </motion.span>
            </AnimatePresence>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-8 pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-sm text-muted-foreground font-mono mb-1 uppercase tracking-widest">Current Objective</p>
                <AnimatePresence mode="wait">
                  <motion.h3
                    key={stepName}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.25 }}
                    className="text-2xl font-sans font-medium text-white flex items-center gap-2"
                  >
                    <span className="text-primary">{stepName}</span>
                  </motion.h3>
                </AnimatePresence>
              </div>
              <motion.div
                className="text-right font-mono text-xs text-muted-foreground"
                key={currentStep}
                initial={{ scale: 1.1, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                PHASE {currentStep} / {totalSteps}
              </motion.div>
            </div>

            {/* Animated progress indicators */}
            <div className="space-y-2">
              <div className="flex gap-1 h-2">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scaleX: 0 }}
                    animate={{
                      scaleX: 1,
                      backgroundColor: i < currentStep
                        ? "hsl(190, 100%, 50%)"
                        : i === currentStep
                          ? "hsl(190, 100%, 50%)"
                          : "hsl(240, 10%, 16%)"
                    }}
                    transition={{
                      scaleX: { delay: 0.4 + i * 0.05, duration: 0.3 },
                      backgroundColor: { duration: 0.5 }
                    }}
                    className={`h-full flex-1 rounded-sm origin-left ${i === currentStep ? "opacity-50" : ""
                      }`}
                  >
                    {i === currentStep && (
                      <motion.div
                        className="w-full h-full bg-primary rounded-sm"
                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/5">
            {/* Continue Mission Button with breathing and feedback */}
            <motion.div className="flex-1 relative">
              {/* Breathing glow behind button */}
              <motion.div
                className="absolute inset-0 bg-primary/30 rounded-md blur-xl"
                animate={!isComplete && !isLoading ? {
                  opacity: [0.3, 0.5, 0.3],
                  scale: [0.95, 1.02, 0.95],
                } : { opacity: 0 }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />

              <Button
                size="lg"
                onClick={handleContinue}
                disabled={isLoading || isComplete}
                data-testid="button-continue-mission"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-display font-bold text-lg h-14 uppercase tracking-wide group/btn relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* Sweep effect on hover */}
                <motion.div
                  className="absolute inset-0 bg-white/20 skew-x-12"
                  initial={{ x: "-150%" }}
                  whileHover={{ x: "150%" }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />

                {/* Button content with states */}
                <span className="relative flex items-center justify-center gap-2">
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.span
                        key="loading"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2"
                      >
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </motion.span>
                    ) : showSuccess ? (
                      <motion.span
                        key="success"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2 text-primary-foreground"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Step Advanced!
                      </motion.span>
                    ) : isComplete ? (
                      <motion.span
                        key="complete"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Quest Complete
                      </motion.span>
                    ) : (
                      <motion.span
                        key="continue"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                      >
                        Continue Mission
                        <motion.span
                          animate={{ x: [0, 4, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <ArrowRight className="w-5 h-5" />
                        </motion.span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </Button>
            </motion.div>

            <Button
              variant="outline"
              size="lg"
              onClick={() => workflowId && navigate(`/intel/${workflowId}`)}
              data-testid="button-view-intel"
              className="flex-1 font-mono uppercase tracking-wider h-14 border-white/10 hover:bg-white/5 hover:text-white hover:border-white/20 transition-all duration-300"
            >
              <ArrowRight className="w-4 h-4 mr-2 text-primary opacity-50" />
              View Intel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Success ripple effect */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 rounded-lg border-2 border-primary pointer-events-none"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
