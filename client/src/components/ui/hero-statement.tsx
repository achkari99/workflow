import { motion } from "framer-motion";

export function HeroStatement() {
  const words = ["BUILD.", "VALIDATE.", "SHIP."];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mb-12 relative z-10"
    >
      <h1 className="text-6xl md:text-8xl font-display font-black tracking-tighter leading-[0.85] text-white">
        {words.map((word, i) => (
          <motion.span
            key={word}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: i * 0.15,
              duration: 0.5,
              ease: "easeOut",
            }}
            className={`block ${i === 1 ? "text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/50" : ""}`}
          >
            {word}
          </motion.span>
        ))}
      </h1>
      
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7, duration: 0.5, ease: "easeOut" }}
        className="mt-6 flex gap-4"
      >
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: "100%" }}
          transition={{ delay: 0.6, duration: 0.4, ease: "easeOut" }}
          className="w-0.5 bg-primary/50 self-stretch"
        />
        <p className="text-lg md:text-xl text-muted-foreground max-w-md font-mono">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.4 }}
            className="block"
          >
            Momentum is everything.
          </motion.span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.95, duration: 0.4 }}
            className="block"
          >
            Don't break the chain.
          </motion.span>
        </p>
      </motion.div>
    </motion.div>
  );
}
