import { motion } from "framer-motion";
import { Flame, Zap, Flag } from "lucide-react";

export function MomentumTicker() {
  const items = [
    { icon: Flame, text: "3-day build streak", color: "text-orange-500" },
    { icon: Zap, text: "Velocity: High", color: "text-yellow-400" },
    { icon: Flag, text: "3 steps to delivery", color: "text-primary" },
  ];

  return (
    <div className="flex gap-4 md:gap-8 overflow-x-auto pb-4 md:pb-0 scrollbar-hide">
      {items.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 + index * 0.1, duration: 0.4 }}
          whileHover={{ 
            y: -2, 
            borderColor: "rgba(255,255,255,0.2)",
            transition: { duration: 0.2 }
          }}
          className="flex items-center gap-2 bg-secondary/50 backdrop-blur-sm px-4 py-2 rounded border border-white/5 transition-colors whitespace-nowrap cursor-default"
        >
          <motion.div
            animate={{ 
              scale: [1, 1.15, 1],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{ 
              duration: 2 + index * 0.5, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <item.icon className={`w-4 h-4 ${item.color}`} />
          </motion.div>
          <span className="text-sm font-mono font-medium text-secondary-foreground uppercase tracking-wide">
            {item.text}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
