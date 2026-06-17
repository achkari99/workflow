import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

export function AmbientBackground() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,hsla(var(--primary),0.08),transparent_34%),radial-gradient(circle_at_85%_85%,rgba(168,85,247,0.05),transparent_32%),linear-gradient(to_bottom,transparent,rgba(0,0,0,0.18))]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Slow-moving gradient orbs */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full bg-primary/5 blur-[100px]"
        style={{ left: "-10%", top: "-10%" }}
        animate={{
          x: [0, 100, 50, 0],
          y: [0, 50, 100, 0],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full bg-purple-500/3 blur-[120px]"
        style={{ right: "-5%", bottom: "-15%" }}
        animate={{
          x: [0, -80, -40, 0],
          y: [0, -60, -30, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full bg-cyan-500/3 blur-[80px]"
        style={{ right: "20%", top: "30%" }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Subtle scan line effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent"
        style={{ height: "4px" }}
        animate={{
          top: ["0%", "100%"],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}
