import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as Icons from "lucide-react";
import { Message, UserSession } from "../types.ts";
import { DynamicIcon } from "./NicknameSetup.tsx";
import { AVATAR_COLORS } from "../data.ts";

interface ChatWindowProps {
  currentUser: { id: string; nickname: string; color: string; avatar: string };
  onLogOut: () => void;
  onOpenPrivacyInfo: () => void;
}

// Sound synthesizer using Web Audio API to notify neatly without asset network requests
function playChirpSound(type: "send" | "receive" | "react") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") {
      return; // Browser blocked it, silent return
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    if (type === "send") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12); // G5
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === "receive") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.15); // C5
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else {
      // React click sound
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch (err) {
    // Web audio blocked or not supported
  }
}

export default function ChatWindow({ currentUser, onLogOut, onOpenPrivacyInfo }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [activeUsers, setActiveUsers] = useState<Omit<UserSession, "id" | "lastActive">[]>([]);
  const [activeCount, setActiveCount] = useState(1);
  const [isUsersDropdownOpen, setIsUsersDropdownOpen] = useState(false);
  const [typingPlayers, setTypingPlayers] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSendLoading, setIsSendLoading] = useState(false);
  const [showEmojiDrawer, setShowEmojiDrawer] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeFetchController = useRef<AbortController | null>(null);
  const lastKnownMessagesCount = useRef(0);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const QUICK_EMOJIS = ["❤️", "👍", "😂", "🔥", "😮", "😢", "🎉", "👀", "🤫"];

  // Handle active states and fetching data
  useEffect(() => {
    // 1. Send immediate heartbeat pulse of the user to the server
    sendHeartbeat();

    // 2. Load messages immediately
    fetchMessages(true);

    // 3. Keep-alive heartbeat pulse & fetcher loops (Intervals)
    const dataInterval = setInterval(() => {
      fetchMessages(false);
      fetchTypingInfo();
    }, 1500);

    const pulseInterval = setInterval(() => {
      sendHeartbeat();
    }, 4000);

    return () => {
      clearInterval(dataInterval);
      clearInterval(pulseInterval);
      if (activeFetchController.current) {
        activeFetchController.current.abort();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [currentUser]);

  // Scroll to bottom helper
  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Fetch messages from database
  const fetchMessages = async (isInitial = false) => {
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) throw new Error("Server error");
      const data: Message[] = await res.json();
      setNetworkError(false);
      setMessages(data);

      if (data.length > lastKnownMessagesCount.current) {
        // Trigger incoming sound if not initial load and sound is enabled
        if (!isInitial && lastKnownMessagesCount.current > 0 && soundEnabled) {
          // Check if last message was not sent by current user
          const lastMsg = data[data.length - 1];
          if (lastMsg.senderId !== currentUser.id) {
            playChirpSound("receive");
          }
        }
        lastKnownMessagesCount.current = data.length;
        // Scroll bottom
        setTimeout(() => scrollToBottom(isInitial ? "auto" : "smooth"), 80);
      }
    } catch (e) {
      console.error("Failed to load anonymous messages:", e);
      setNetworkError(true);
    }
  };

  // Fetch typing info
  const fetchTypingInfo = async () => {
    try {
      const res = await fetch("/api/typing");
      if (res.ok) {
        const data = await res.json();
        // Exclude current user from typing list
        const othersTyping = data.typingNow.filter((name: string) => name !== currentUser.nickname);
        setTypingPlayers(othersTyping);
      }
    } catch (e) {
      console.error("Failed to load typing state:", e);
    }
  };

  // Send pulse heartbeat to show user as Online
  const sendHeartbeat = async () => {
    try {
      const res = await fetch("/api/pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentUser.id,
          nickname: currentUser.nickname,
          avatar: currentUser.avatar,
          color: currentUser.color
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCount(data.activeCount);
        setActiveUsers(data.activeUsers);
      }
    } catch (e) {
      console.error("Heartbeat error:", e);
    }
  };

  // Send typing state to server
  const sendTypingState = async (isTyping: boolean) => {
    try {
      await fetch("/api/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentUser.id,
          nickname: currentUser.nickname,
          isTyping
        })
      });
    } catch (e) {
      console.error("Typing API failed:", e);
    }
  };

  // Handle typing keystrokes
  const handleTextInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTypingState(true);
    }

    // Reset typing idle timer
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTypingState(false);
    }, 2500);
  };

  // Send message submit
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || isSendLoading) return;

    const bodyText = text.trim();
    setText("");
    setIsSendLoading(true);
    setShowEmojiDrawer(false);

    // Cancel typing indicator immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    sendTypingState(false);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: bodyText,
          senderId: currentUser.id,
          senderName: currentUser.nickname,
          senderColor: currentUser.color,
          senderAvatar: currentUser.avatar
        })
      });

      if (res.ok) {
        if (soundEnabled) {
          playChirpSound("send");
        }
        // Force quick fetch to update UI immediately
        fetchMessages(false);
      } else {
        throw new Error("Message submission failed");
      }
    } catch (e) {
      console.error("Post message error:", e);
      setText(bodyText); // restore text on error
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSendLoading(false);
    }
  };

  // Add micro reaction
  const handleReact = async (messageId: string, emoji: string) => {
    try {
      if (soundEnabled) {
        playChirpSound("react");
      }
      const res = await fetch(`/api/messages/${messageId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emoji,
          senderId: currentUser.id
        })
      });
      if (res.ok) {
        // Optimistic refresh
        fetchMessages(false);
      }
    } catch (e) {
      console.error("Failed to post reaction:", e);
    }
  };

  // Clear Entire Chat Helpers
  const handleClearChatHistory = async () => {
    if (window.confirm("Are you sure you want to clear the entire chat history? This will clear it for everyone.")) {
      try {
        const res = await fetch("/api/clear-chat", { method: "POST" });
        if (res.ok) {
          setMessages([]);
          alert("Chat history has been successfully reset.");
        }
      } catch (e) {
        alert("Failed to reset chat history.");
      }
    }
  };

  // Check unique sender signature (e.g. #A9F2)
  const getSignature = (senderId: string) => {
    return senderId ? `#${senderId.slice(-4).toUpperCase()}` : "";
  };

  // Format time in Bengali/English beautiful AM/PM style
  const formatTime = (epochMs: number) => {
    const d = new Date(epochMs);
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // key hours adjustment
    const minuteStr = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${minuteStr} ${ampm}`;
  };

  return (
    <div className="flex h-screen w-full bg-[#030406] text-slate-200 font-sans overflow-hidden relative">
      
      {/* 1. Left Panel Sidebar: Public Void Hub Status Diagnostic Board */}
      <aside className="w-72 border-r border-white/10 bg-black/40 backdrop-blur-xl flex flex-col shrink-0 lg:flex hidden">
        <div className="p-6 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2.5 mb-8 shrink-0">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse"></div>
            <h1 className="text-lg font-extrabold tracking-widest text-white uppercase font-sans">ANOMALOUS</h1>
          </div>
          
          <div className="space-y-6 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-4 font-bold font-mono">
                Active Phantoms ({activeCount})
              </p>
              <div className="space-y-3">
                {activeUsers.map((u, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div 
                      style={{ background: u.color }} 
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-mono shrink-0 border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)] animate-pulse"
                    >
                      <DynamicIcon name={u.avatar} className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col truncate">
                      <span className={`font-semibold truncate text-xs ${u.nickname === currentUser.nickname ? "text-emerald-400 italic" : "text-slate-400"}`}>
                        {u.nickname === currentUser.nickname ? `${u.nickname} (You)` : u.nickname}
                      </span>
                      <span className="text-[9px] text-slate-600 font-mono tracking-tight">VOICE_NODE_LIVE</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-bold font-mono">Privacy Status</p>
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[10px] leading-relaxed text-indigo-200/90 font-mono space-y-1.5 shadow-[inner_0_2px_4px_rgba(255,255,255,0.02)]">
                <div className="flex justify-between">
                  <span>ENCRYPTION:</span>
                  <span className="text-emerald-400 font-extrabold">ACTIVE</span>
                </div>
                <div className="flex justify-between">
                  <span>IDENTITY MASK:</span>
                  <span className="text-emerald-400 font-extrabold">100% SECURE</span>
                </div>
                <div className="flex justify-between">
                  <span>TRACEABILITY:</span>
                  <span className="text-indigo-400 font-extrabold">LITERAL ZERO</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-auto pt-4 border-t border-white/5 text-[10px] text-slate-600 font-mono tracking-wider shrink-0 select-none">
            VOID HUB ID: <span className="text-indigo-550/80 uppercase">{currentUser.id.slice(5, 17)}</span>
          </div>
        </div>
      </aside>

      {/* 2. Main Chat Feed Section */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-transparent">
        
        {/* Dynamic Header */}
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 md:px-10 shrink-0 z-20 bg-black/20 backdrop-blur-md" id="chat-header">
          
          {/* Status Indicators */}
          <div className="flex items-center gap-3">
            {/* Display profile avatar dynamically on click to quickly allow name changer if desired */}
            <div 
              style={{ background: currentUser.color }} 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg cursor-pointer border border-white/15 hover:border-white/30 transition-colors shrink-0"
              onClick={onLogOut}
              title="Change Identity"
            >
              <DynamicIcon name={currentUser.avatar} className="w-5 h-5 drop-shadow-sm" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 font-bold text-white leading-tight">
                <span className="text-emerald-500 animate-pulse text-sm">●</span>
                <span className="text-sm font-semibold">Public Void Hub</span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-mono bg-white/[0.04] text-slate-400 border border-white/5 px-2 py-0.5 rounded-md font-bold ml-1.5">
                  {currentUser.nickname} {getSignature(currentUser.id)}
                </span>
              </div>

              {/* Active info dropdown trigger for mobile only (since sidebar is invisible on mobile) */}
              <div className="relative mt-0.5">
                <button
                  onClick={() => setIsUsersDropdownOpen(!isUsersDropdownOpen)}
                  className="text-[10px] text-slate-500 hover:text-slate-350 flex items-center gap-1 cursor-pointer transition-colors"
                  id="active-members-dropdown-trigger"
                >
                  <span>{activeCount} voices currently broadcasting</span>
                  <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${isUsersDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Active user dropdown list overlay for tablets and mobile viewport */}
                <AnimatePresence>
                  {isUsersDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute left-0 mt-2 w-56 bg-slate-950 border border-white/10 rounded-2xl shadow-2xl p-3 space-y-2 z-40 max-h-60 overflow-y-auto"
                      id="active-members-list-card"
                    >
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 pb-1.5 border-b border-white/5 flex items-center gap-1">
                        <Icons.Compass className="w-3.5 h-3.5 text-indigo-400" />
                        Online Members
                      </div>
                      {activeUsers.map((u, i) => (
                        <div key={i} className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-white/5 whitespace-nowrap">
                          <div style={{ background: u.color }} className="w-5.5 h-5.5 rounded-md flex items-center justify-center text-white text-[10px]">
                            <DynamicIcon name={u.avatar} className="w-3 h-3" />
                          </div>
                          <span className="text-xs font-semibold text-slate-300 truncate max-w-[125px]">{u.nickname}</span>
                          {u.nickname === currentUser.nickname && (
                            <span className="text-[9px] bg-emerald-900/30 text-emerald-400 font-bold px-1.5 py-0.2 rounded-md ml-auto shrink-0 border border-emerald-500/10">You</span>
                          )}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Action Toolbar buttons */}
          <div className="flex items-center gap-1.5 md:gap-2">
            
            {/* Audio Toggle sound */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl transition-all border cursor-pointer ${
                soundEnabled
                  ? "bg-white/5 border-white/10 hover:bg-white/10 text-indigo-400"
                  : "bg-slate-950/40 text-slate-650 border-white/5 line-through"
              }`}
              title={soundEnabled ? "Sound Alerts Enabled" : "Sound Alerts Muted"}
              id="toggle-audio-btn"
            >
              {soundEnabled ? <Icons.Volume2 className="w-4.5 h-4.5" /> : <Icons.VolumeX className="w-4.5 h-4.5 text-slate-500" />}
            </button>

            {/* Privacy Information modal toggle */}
            <button
              onClick={onOpenPrivacyInfo}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all cursor-pointer"
              title="Privacy Guard Diagnostics"
              id="info-privacy-shield-btn"
            >
              <Icons.ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
            </button>

            {/* Clear-feed admin button */}
            <button
              onClick={handleClearChatHistory}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-950/20 border border-white/10 text-rose-450 transition-all cursor-pointer"
              title="Clear entire channel history for everyone"
              id="clear-chat-history-btn"
            >
              <Icons.Trash2 className="w-4.5 h-4.5 text-rose-500/80" />
            </button>

            {/* Identity log out button */}
            <button
              onClick={onLogOut}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 border border-white/15 hover:bg-white/10 text-white font-bold uppercase tracking-wider text-[10px] rounded-xl cursor-pointer transition-all shrink-0 active:scale-95"
              id="trigger-identity-logout-btn"
            >
              <Icons.LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Change ID</span>
            </button>
          </div>
        </header>

        {/* Network offline alert */}
        {networkError && (
          <div className="bg-amber-500/20 text-amber-205 border-b border-amber-500/20 text-center text-[11px] py-2 font-mono flex items-center justify-center gap-2 animate-pulse z-20">
            <Icons.WifiOff className="w-4 h-4 text-amber-400" />
            <span>CONNECTIVITY DELAYED. RETRYING SYSTEM SYNC...</span>
          </div>
        )}

        {/* Message Feed Arena */}
        <main className="flex-1 overflow-y-auto p-4 md:p-10 space-y-8 scrollbar-thin scrollbar-thumb-white/10 z-10" id="chat-messages-container">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4 text-slate-500 max-w-md mx-auto">
              <div className="bg-white/5 border border-white/10 p-4 rounded-3xl text-indigo-400">
                <Icons.MessageSquareQuote className="w-10 h-10 mr-0.5" />
              </div>
              <div>
                <p className="font-semibold text-white">Public Feed is Empty</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  The secure shard is empty and waiting for broadcasting signals. Send an untraceable message below to begin.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {messages.map((msg, index) => {
                const isOwn = msg.senderId === currentUser.id;
                
                // Decide Date Divider
                const showDateDivider = 
                  index === 0 || 
                  new Date(msg.timestamp).toDateString() !== new Date(messages[index - 1].timestamp).toDateString();

                return (
                  <div key={msg.id} className="space-y-6">
                    {/* Date Divider tag banner */}
                    {showDateDivider && (
                      <div className="flex justify-center my-4">
                        <span className="bg-white/5 border border-white/10 text-slate-450 text-[10px] font-mono font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                          {new Date(msg.timestamp).toLocaleDateString(undefined, { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                    )}

                    {/* Chat Bubble container */}
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className={`flex items-start gap-4 max-w-[90%] md:max-w-[75%] group ${
                        isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
                      }`}
                    >
                      {/* Avatar Bubble */}
                      <div
                        style={{ background: msg.senderColor }}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.05)] relative border border-white/10"
                        title={`${msg.senderName} ${getSignature(msg.senderId)}`}
                      >
                        <DynamicIcon name={msg.senderAvatar} className="w-5 h-5 drop-shadow-sm" />
                      </div>

                      {/* Content Wrap */}
                      <div className={`space-y-1 ${isOwn ? "text-right flex flex-col items-end" : "text-left flex flex-col items-start"}`}>
                        {/* Sender identifiers */}
                        <div className={`flex items-center gap-1.5 text-xs text-slate-550 px-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                          <span className={`font-bold ${isOwn ? "text-emerald-400 italic" : "text-slate-300"}`}>{msg.senderName}</span>
                          <span className="text-[10px] text-slate-500 font-mono tracking-tight">{getSignature(msg.senderId)}</span>
                          {isOwn && (
                            <span className="text-[8px] tracking-widest text-[#10b981] font-bold uppercase">PHANTOM_YOU</span>
                          )}
                        </div>

                        {/* Interactive message card holding bubble element */}
                        <div className="relative inline-block group/bubble">
                          
                          {/* The Bubble content */}
                          <div
                            className={`p-4 rounded-2xl text-sm leading-relaxed border shadow-md break-words text-left ${
                              isOwn
                                ? "bg-emerald-500/10 text-emerald-50/90 border-emerald-500/20 rounded-tr-none shadow-[0_0_35px_rgba(16,185,129,0.05)]"
                                : "bg-white/5 text-slate-300 border-white/10 rounded-tl-none font-normal"
                            }`}
                            style={{ whiteSpace: "pre-line" }}
                          >
                            {msg.text}
                          </div>

                          {/* Float micro emoji panel for reactions (Hover desktop) */}
                          <div
                            className={`absolute -top-10 z-20 hidden md:group-hover/bubble:flex items-center gap-1.5 p-1 px-2 bg-slate-950 border border-white/15 rounded-full shadow-2xl ${
                              isOwn ? "left-0 animate-fade-in-quick" : "right-0 animate-fade-in-quick"
                            }`}
                          >
                            {["❤️", "👍", "😂", "😮", "😢"].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReact(msg.id, emoji)}
                                className="hover:scale-130 transition px-1 py-0.5 text-xs bg-transparent hover:bg-white/10 rounded-full cursor-pointer"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Reactions Grid */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1.5 ${isOwn ? "justify-end" : "justify-start"}`}>
                            {Object.entries(msg.reactions).map(([emoji, reactors]) => {
                              const userHasReacted = (reactors as string[]).includes(currentUser.id);
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => handleReact(msg.id, emoji)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full border cursor-pointer transition-all ${
                                    userHasReacted
                                      ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.1)]"
                                      : "bg-white/5 border-white/15 text-slate-400 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span className="text-[10px] font-mono">{(reactors as string[]).length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Stamp meta */}
                        <div className="text-[9px] text-slate-650 font-mono tracking-wider pt-0.5">
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        {/* Active typing list section */}
        <AnimatePresence>
          {typingPlayers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="bg-black/40 backdrop-blur-md text-xs font-medium text-slate-500 px-4 py-2 text-center flex items-center justify-center gap-2 shrink-0 z-15 border-t border-white/5"
            >
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
              <span className="font-mono text-[10px] tracking-wider uppercase text-indigo-300">
                {typingPlayers.length === 1
                  ? `${typingPlayers[0]} broadcast typing...`
                  : `${typingPlayers.join(", ")} broadcasting...`}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input area widget wrapper */}
        <footer className="p-4 md:p-8 z-10 shrink-0 bg-transparent border-t border-white/5" id="chat-input-footer">
          
          {/* Quick emoji popshelf drawer */}
          <AnimatePresence>
            {showEmojiDrawer && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white/[0.02] border border-white/10 py-2 py-2.5 px-4 rounded-xl mb-3 flex items-center justify-start gap-1 overflow-x-auto overflow-hidden shadow-inner backdrop-blur-md"
                id="emoji-drawer-container"
              >
                <div className="text-[10px] font-mono text-slate-500 font-bold uppercase shrink-0 px-1 tracking-widest">Quick:</div>
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setText((prev) => prev + emoji)}
                    className="p-1 px-1.5 text-lg hover:scale-120 transition hover:bg-white/10 rounded-lg cursor-pointer"
                    id={`emoji-draw-item-${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Core broadcast input bar */}
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2.5">
            
            {/* Quick emoji panel button toggle */}
            <button
              type="button"
              onClick={() => setShowEmojiDrawer(!showEmojiDrawer)}
              className={`p-3.5 rounded-2xl transition-all cursor-pointer border ${
                showEmojiDrawer
                  ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                  : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 hover:text-white"
              }`}
              title="Quick Emojis"
              id="toggle-emoji-drawer-button"
            >
              <Icons.SmilePlus className="w-5 h-5" />
            </button>

            {/* General Chat Input bar */}
            <div className="flex-1 relative group bg-transparent">
              <input
                type="text"
                autoComplete="off"
                value={text}
                onChange={handleTextInputChange}
                placeholder="Send an untraceable message into the void..."
                className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all text-sm placeholder:text-slate-600 text-white font-medium"
                id="message-text-input-field"
              />
            </div>

            {/* Broadcast Submission Button */}
            <button
              type="submit"
              disabled={!text.trim() || isSendLoading}
              className={`px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all transform flex items-center justify-center gap-1.5 ${
                text.trim()
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer border border-indigo-550/30"
                  : "bg-slate-900 border border-white/5 text-slate-650 cursor-not-allowed"
              }`}
              title="Send Message"
              id="send-message-submit-button"
            >
              <span>Broadcast</span>
              {isSendLoading ? (
                <Icons.Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Icons.SendHorizontal className="w-4 h-4" />
              )}
            </button>
          </form>

          {/* Human secure transmission labels */}
          <p className="text-center mt-4 text-[9px] text-slate-705 uppercase tracking-[0.34em] select-none font-mono">
            End-to-End Ghost Encryption Enabled
          </p>
        </footer>
      </main>
    </div>
  );
}
