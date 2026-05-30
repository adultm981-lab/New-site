import { useState, useEffect } from "react";
import NicknameSetup from "./components/NicknameSetup.tsx";
import ChatWindow from "./components/ChatWindow.tsx";
import InfoModal from "./components/InfoModal.tsx";

interface User {
  id: string;
  nickname: string;
  color: string;
  avatar: string;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load from LocalStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("anon_chat_session");
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Local storage read error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleJoin = (user: User) => {
    try {
      localStorage.setItem("anon_chat_session", JSON.stringify(user));
    } catch (e) {
      console.error("Local storage save error:", e);
    }
    setCurrentUser(user);
  };

  const handleLogOut = () => {
    try {
      localStorage.removeItem("anon_chat_session");
    } catch (e) {
      console.error("Local storage clear error:", e);
    }
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#030406] text-indigo-400 font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs uppercase tracking-widest text-slate-500">Initializing Secure Void...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030406] text-slate-200 font-sans relative overflow-hidden transition-colors duration-300">
      {/* Immersive UI Absolute Orbs */}
      <div className="absolute top-[-15%] right-[-10%] w-[50vw] h-[50vw] bg-indigo-600/10 blur-[130px] rounded-full pointer-events-none select-none"></div>
      <div className="absolute bottom-[-15%] left-[5%] w-[45vw] h-[45vw] bg-emerald-600/5 blur-[120px] rounded-full pointer-events-none select-none"></div>

      {currentUser ? (
        <ChatWindow 
          currentUser={currentUser} 
          onLogOut={handleLogOut} 
          onOpenPrivacyInfo={() => setIsPrivacyOpen(true)}
        />
      ) : (
        <NicknameSetup onJoin={handleJoin} />
      )}

      <InfoModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
    </div>
  );
}
