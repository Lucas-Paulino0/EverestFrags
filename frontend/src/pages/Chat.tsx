/**
 * Chat — página /chat com WebSocket em tempo real
 *
 * Requer login. Conecta via WS /api/chat/ws?token=<JWT>.
 * Mensagens de tipo: "message" | "join" | "leave"
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Navbar } from "../components/Navbar";

interface ChatMessage {
  type: "message" | "join" | "leave";
  player_id: number | null;
  nickname: string;
  avatar_initials: string;
  text: string;
  timestamp: string;
}

interface HistoryPayload {
  type: "history";
  messages: ChatMessage[];
}

const WS_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/^http/, "ws") + "/api/chat/ws"
  : `ws://${window.location.hostname}:8001/api/chat/ws`;

export function Chat() {
  const { player, isLoading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !player) navigate("/login");
  }, [player, isLoading, navigate]);

  useEffect(() => {
    if (!player) return;
    const token = localStorage.getItem("ef_token");
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => { setConnected(false); wsRef.current = null; };
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const data: ChatMessage | HistoryPayload = JSON.parse(e.data);
        if (data.type === "history") {
          setMessages(data.messages.slice(-200));
        } else {
          setMessages(prev => [...prev.slice(-199), data]);
        }
      } catch {}
    };

    return () => { ws.close(); };
  }, [player]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send() {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text }));
    setInput("");
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  if (isLoading || !player) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#070a0e", color: "#dde6f0", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Scanlines */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, background: "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.10) 4px, rgba(0,0,0,0) 5px)", opacity: 0.35 }} />

      {/* Header */}
      <header style={{ borderBottom: "1px solid #1b2530", background: "linear-gradient(180deg,#0d1218,#070a0e)", padding: "22px 48px", flexShrink: 0 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 38, height: 38, border: "2px solid #0e7490", display: "flex", alignItems: "center", justifyContent: "center", background: "#04222b" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M2 21 L9 7 L12.5 13 L15.5 6 L22 21 Z" fill="#0e7490" />
                <path d="M15.5 6 L13.2 10 L17.8 10 Z" fill="#cfe6ee" />
                <path d="M9 7 L7.3 10 L10.7 10 Z" fill="#cfe6ee" />
              </svg>
            </div>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: 1 }}>
              <span style={{ color: "#f0f9ff" }}>EVEREST</span>
              <span style={{ color: "#0e7490" }}>FRAGS</span>
            </span>
          </div>
          {/* Status da conexão */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "1px", color: connected ? "#34d399" : "#f87171" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#34d399" : "#f87171", boxShadow: connected ? "0 0 6px #34d399" : "none" }} />
            {connected ? "CONECTADO" : "DESCONECTADO"}
          </div>
        </div>
      </header>

      <Navbar />

      {/* Corpo do chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 860, width: "100%", margin: "0 auto", padding: "24px 32px 0", position: "relative", zIndex: 10, boxSizing: "border-box" }}>

        {/* Título */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#0e7490" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: "3px", color: "#5d6d80" }}>CHAT DO GRUPO</span>
          <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#1e2a36,transparent)" }} />
        </div>

        {/* Área de mensagens */}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid #1b2530", background: "#0a0e13", padding: "16px", minHeight: 400, maxHeight: "calc(100vh - 340px)", display: "flex", flexDirection: "column", gap: 2 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#2a3a4a", letterSpacing: "1px" }}>
              // sem mensagens ainda — seja o primeiro
            </div>
          )}
          {messages.map((msg, i) => {
            if (msg.type === "join" || msg.type === "leave") {
              return (
                <div key={i} style={{ padding: "4px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: msg.type === "join" ? "#34d399" : "#566476", letterSpacing: "0.5px", textAlign: "center" }}>
                  — {msg.text} — {formatTime(msg.timestamp)}
                </div>
              );
            }
            const isMe = msg.player_id === player.id;
            return (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 4px", flexDirection: isMe ? "row-reverse" : "row" }}>
                {/* Avatar */}
                <div style={{ width: 32, height: 32, border: `1px solid ${isMe ? "#0e7490" : "#1e2a36"}`, background: isMe ? "#04222b" : "#0d1218", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: isMe ? "#22d3ee" : "#566476" }}>
                  {msg.avatar_initials}
                </div>
                {/* Balão */}
                <div style={{ maxWidth: "70%", background: isMe ? "rgba(14,116,144,0.12)" : "#0f1620", border: `1px solid ${isMe ? "#0e7490" : "#1a2535"}`, padding: "8px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color: isMe ? "#22d3ee" : "#aebccd", letterSpacing: "0.5px" }}>
                      {msg.nickname}
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#3a4757" }}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#c8d8e8", lineHeight: 1.5, wordBreak: "break-word" }}>
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "16px 0 32px", display: "flex", gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={connected ? "mensagem... (Enter para enviar)" : "aguardando conexão..."}
            disabled={!connected}
            maxLength={500}
            style={{ flex: 1, background: "#080c11", border: "1px solid #212d3a", color: "#e3ebf3", fontFamily: "'Inter', sans-serif", fontSize: 13, padding: "11px 14px", outline: "none", opacity: connected ? 1 : 0.5 }}
          />
          <button
            onClick={send}
            disabled={!connected || !input.trim()}
            style={{ background: connected && input.trim() ? "#0e7490" : "#0a2733", border: "1px solid #0e7490", color: connected && input.trim() ? "#fff" : "#2a5060", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "2px", padding: "11px 22px", cursor: connected && input.trim() ? "pointer" : "default" }}
          >
            ENVIAR
          </button>
        </div>
      </div>
    </div>
  );
}
