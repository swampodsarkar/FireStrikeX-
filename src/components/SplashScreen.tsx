import { motion } from 'motion/react';
import { Sword, Zap, ShieldAlert } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  return (
    <div className="relative flex flex-col items-center justify-between h-full w-full bg-[#050508] text-white p-6 overflow-hidden select-none">
      {/* Cinematic Background Gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-orange-600/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-sky-500/10 blur-[120px]" />

      <div /> {/* Spacer */}

      {/* Main Logo */}
      <div className="flex flex-col items-center space-y-4 z-10">
        <motion.div 
          initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-tr from-orange-600 to-red-650 shadow-2xl shadow-orange-500/20 border-t-2 border-orange-400"
        >
          <Sword className="w-12 h-12 text-slate-100" />
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }} 
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-1 -right-1"
          >
            <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300" />
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <h1 className="font-heading text-4xl font-extrabold tracking-wider bg-gradient-to-r from-orange-400 via-amber-200 to-sky-400 bg-clip-text text-transparent uppercase">
            Hero Arena
          </h1>
          <p className="font-sans text-xs tracking-[0.25em] text-slate-400 uppercase font-bold">
            Legends • Tactical 1v1
          </p>
        </motion.div>
      </div>

      {/* Tap Instruction / Loader */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex flex-col items-center space-y-6 w-full max-w-xs z-10"
      >
        <button 
          onClick={onFinish}
          id="btn_splash_enter"
          className="group relative w-full overflow-hidden p-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-650 transition-all font-heading font-bold text-center tracking-wider text-slate-100 shadow-xl shadow-orange-950/40 active:scale-95"
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 w-1/2 h-full bg-white/25 -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000" />
          TAP TO ENTER ARENA
        </button>

        <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
          <ShieldAlert className="w-3.5 h-3.5 text-orange-500/70" />
          <span>V2026.06 • SECURE CLOUD SANDBOX</span>
        </div>
      </motion.div>
    </div>
  );
}
