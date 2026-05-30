import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import * as Icons from "lucide-react";
import { RANDOM_NICKNAMES_BN, RANDOM_NICKNAMES_EN, AVATAR_COLORS, AVATAR_ICONS } from "../data.ts";

interface NicknameSetupProps {
  onJoin: (user: { id: string; nickname: string; color: string; avatar: string }) => void;
}

export function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = (Icons as any)[name] || Icons.User;
  return <IconComponent className={className} />;
}

export default function NicknameSetup({ onJoin }: NicknameSetupProps) {
  const [nickname, setNickname] = useState("");
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(AVATAR_ICONS[0]);
  const [error, setError] = useState("");

  // Auto-generate one random nickname on load
  useEffect(() => {
    generateRandom();
  }, []);

  const generateRandom = () => {
    const list = RANDOM_NICKNAMES_EN;
    const randomIdx = Math.floor(Math.random() * list.length);
    const randomColorIdx = Math.floor(Math.random() * AVATAR_COLORS.length);
    const randomIconIdx = Math.floor(Math.random() * AVATAR_ICONS.length);

    setNickname(list[randomIdx]);
    setSelectedColor(AVATAR_COLORS[randomColorIdx]);
    setSelectedIcon(AVATAR_ICONS[randomIconIdx]);
    setError("");
  };

  const cycleColor = () => {
    const currentIdx = AVATAR_COLORS.indexOf(selectedColor);
    const nextIdx = (currentIdx + 1) % AVATAR_COLORS.length;
    setSelectedColor(AVATAR_COLORS[nextIdx]);
  };

  const cycleIcon = () => {
    const currentIdx = AVATAR_ICONS.indexOf(selectedIcon);
    const nextIdx = (currentIdx + 1) % AVATAR_ICONS.length;
    setSelectedIcon(AVATAR_ICONS[nextIdx]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError("Please enter or generate a nickname.");
      return;
    }
    if (nickname.length > 50) {
      setError("Nickname must be less than 50 characters.");
      return;
    }

    // Secure generation of a safe local ID
    const randomUserId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    onJoin({
      id: randomUserId,
      nickname: nickname.trim(),
      color: selectedColor,
      avatar: selectedIcon
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-transparent relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: "spring" }}
        className="w-full max-w-md bg-black/50 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10"
        id="nickname-setup-card"
      >
        {/* Header - Transparent Dark Cyber Title */}
        <div className="border-b border-white/10 px-6 py-7 text-center relative bg-white/[0.02]">
          <div className="mx-auto bg-white/5 border border-white/10 p-3 rounded-2xl w-fit mb-4">
            <Icons.Milestone className="w-8 h-8 text-indigo-400" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
            <h1 className="text-xl font-bold tracking-widest text-white uppercase font-sans">Anomalous Room</h1>
          </div>
          <p className="text-slate-400 text-xs font-semibold">
            100% Untraceable Public Space
          </p>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">

          {/* Avatar Settings and Live Preview */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              Secure Mask Creator
            </label>
            
            {/* Live Interactive Avatar Bubble */}
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                style={{ background: selectedColor }}
                className="w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] relative cursor-pointer border border-white/20"
                onClick={cycleColor}
                title="Change Avatar Background Color"
                id="interactive-avatar-bubble"
              >
                <DynamicIcon name={selectedIcon} className="w-9 h-9 drop-shadow-md" />
                <div className="absolute -bottom-1 -right-1 bg-slate-900 border border-white/20 p-1 rounded-full shadow-md">
                  <Icons.Palette className="w-3.5 h-3.5 text-indigo-400" />
                </div>
              </motion.div>

              {/* Quick Cycle Controls */}
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={cycleColor}
                  className="px-3 py-1.5 text-xs font-semibold border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 flex items-center gap-1.5 cursor-pointer transition-all"
                  id="cycle-color-btn"
                >
                  <Icons.Paintbrush className="w-3.5 h-3.5 text-slate-400" />
                  Next Color
                </button>
                <button
                  type="button"
                  onClick={cycleIcon}
                  className="px-3 py-1.5 text-xs font-semibold border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 flex items-center gap-1.5 cursor-pointer transition-all"
                  id="cycle-icon-btn"
                >
                  <Icons.Activity className="w-3.5 h-3.5 text-slate-400" />
                  Next Symbol
                </button>
              </div>
            </div>
          </div>

          {/* Nickname Inputs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="nickname" className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                Your Pen Name
              </label>
              <button
                type="button"
                onClick={generateRandom}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-all"
                id="random-rename-btn"
              >
                <Icons.Sparkles className="w-3.5 h-3.5" />
                Pick Random
              </button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Icons.UserPen className="w-4.5 h-4.5 text-slate-500" />
              </div>
              <input
                id="nickname"
                type="text"
                autoComplete="off"
                placeholder="Enter name or pick random..."
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setError("");
                }}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus:border-indigo-500/50 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-indigo-950/20 transition-all text-white font-medium placeholder-slate-650 text-sm md:text-base"
              />
            </div>
            
            {error && (
              <p className="text-xs text-rose-400 flex items-center gap-1 font-semibold mt-1">
                <Icons.AlertCircle className="w-3.5 h-3.5" />
                {error}
              </p>
            )}
          </div>

          {/* Privacy Note Banner */}
          <div className="bg-indigo-500/15 border border-indigo-550/20 p-3.5 rounded-2xl flex items-start gap-2.5">
            <Icons.Lock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
            <p className="text-[11px] text-slate-300 leading-normal font-sans">
              No telemetry or registration required. Security masking and absolute peer anonymity are guaranteed.
            </p>
          </div>

          {/* Join Submit Button */}
          <button
            type="submit"
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-widest text-xs rounded-2xl cursor-pointer flex items-center justify-center gap-2 transform transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 border border-indigo-500/30"
            id="join-chat-submit-btn"
          >
            <span>Enter public void</span>
            <Icons.LogIn className="w-4.5 h-4.5" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
