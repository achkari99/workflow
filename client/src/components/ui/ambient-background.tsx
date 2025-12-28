import { motion } from "framer-motion";

export function AmbientBackground() {
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
