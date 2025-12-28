import { motion } from "framer-motion";

export function HeroStatement() {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="mb-12 relative z-10"
    >
      <h1 className="text-6xl md:text-8xl font-display font-black tracking-tighter leading-[0.85] text-white">
        BUILD.<br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/50">VALIDATE.</span><br />
        SHIP.
      </h1>
      <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-md font-mono border-l-2 border-primary/50 pl-4 ml-2">
        Momentum is everything.
        <br />
        Don't break the chain.
      </p>
    </motion.div>
  );
}
