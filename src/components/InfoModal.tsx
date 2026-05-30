import { motion, AnimatePresence } from "motion/react";
import * as Icons from "lucide-react";

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InfoModal({ isOpen, onClose }: InfoModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/60"
        id="info-modal-overlay"
        onClick={(e) => {
          if ((e.target as HTMLElement).id === "info-modal-overlay") {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl md:p-8 backdrop-blur-xl"
          id="info-modal-card"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <h3 className="text-lg font-bold tracking-wider text-white flex items-center gap-2">
              <Icons.ShieldAlert className="w-5 h-5 text-indigo-400" />
              Privacy & Security
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              aria-label="Close modal"
              id="close-info-modal-btn"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="py-6 space-y-6 max-h-[60vh] overflow-y-auto pr-2 text-slate-300 text-sm leading-relaxed scrollbar-thin scrollbar-thumb-white/10">
            {/* English Section */}
            <div className="space-y-3">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-900/40 text-indigo-300 border border-indigo-500/20 uppercase tracking-widest">
                Security Blueprint
              </span>
              <p className="font-semibold text-white">
                This anonymous chatroom protects your identity with absolute zero-tracking mechanics:
              </p>
              <ul className="space-y-2.5 list-disc list-inside text-slate-300">
                <li>
                  <strong className="text-indigo-400">No Sign-up required:</strong> No Emails, Google Logins, or Passwords. Instant click & connect.
                </li>
                <li>
                  <strong className="text-indigo-400">Zero IP Logging:</strong> IP addresses are never registered or exposed inside the server files.
                </li>
                <li>
                  <strong className="text-indigo-400">Transient State:</strong> Your custom or randomly-generated pen name is stored safely inside your local browser.
                </li>
                <li>
                  <strong className="text-indigo-400">No Inter-user Checks:</strong> Nobody in the chat has access to look up profiles, settings, or trace your device origin.
                </li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-650/80 border border-indigo-500/30 text-white font-bold tracking-widest text-[10px] uppercase rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
              id="got-it-info-modal-btn"
            >
              Got It!
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
