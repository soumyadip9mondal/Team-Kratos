import React, { useState, useEffect } from 'react';
import SessionSidebar from '../components/chatbot/SessionSidebar';
import MessageList from '../components/chatbot/MessageList';
import MessageInput from '../components/chatbot/MessageInput';
import { API_BASE } from '../lib/api';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { Sparkles, CloudSun, Moon, Sun, Menu, Cpu, Crown } from 'lucide-react';

const SUGGESTION_PROMPTS = [
  "Who is on leave today?",
  "What is our leave policy?",
  "Any high attrition risk employees?",
  "Show me the headcount",
  "Who joined the company this month?",
  "Give me a summary of last month's payroll",
  "Who has been absent for more than 3 days?",
  "List employees with perfect attendance",
  "What are the core working hours?",
  "Are there any pending leave requests?",
  "Which department has the most employees?",
  "Show me a breakdown of salary costs"
];

export default function AIChatbot({ user }) {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [socket, setSocket] = useState(null);
  const [randomPrompts, setRandomPrompts] = useState([]);

  const [greeting, setGreeting] = useState('');
  const [GreetingIcon, setGreetingIcon] = useState(null);

  useEffect(() => {
    const shuffled = [...SUGGESTION_PROMPTS].sort(() => 0.5 - Math.random());
    setRandomPrompts(shuffled.slice(0, 4));
    
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting("Good morning");
      setGreetingIcon(() => CloudSun);
    } else if (hour < 17) {
      setGreeting("Good afternoon");
      setGreetingIcon(() => Sun);
    } else {
      setGreeting("Good evening");
      setGreetingIcon(() => Moon);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    const newSocket = io(API_BASE, {
      auth: { token: localStorage.getItem('token') }
    });
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('chatbot:chunk', (data) => {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.id === 'streaming') {
          return [
            ...prev.slice(0, -1),
            { ...lastMsg, content: lastMsg.content + data.text }
          ];
        } else {
          const filtered = prev.filter(m => m.id !== 'thinking');
          return [...filtered, { role: 'model', content: data.text, id: 'streaming' }];
        }
      });
    });

    socket.on('chatbot:done', (data) => {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.id === 'streaming') {
          return [
            ...prev.slice(0, -1),
            { ...lastMsg, id: Date.now() } 
          ];
        } else {
          const filtered = prev.filter(m => m.id !== 'thinking');
          return [...filtered, { role: 'model', content: data.text, id: Date.now() }];
        }
      });
      setIsStreaming(false);
    });

    socket.on('chatbot:error', (data) => {
      toast.error(data.error);
      setMessages(prev => prev.filter(m => m.id !== 'thinking' && m.id !== 'streaming'));
      setIsStreaming(false);
    });

    socket.on('chatbot:session', (data) => {
      setCurrentSessionId(data.sessionId);
      loadSessions();
    });

    return () => {
      socket.off('chatbot:chunk');
      socket.off('chatbot:done');
      socket.off('chatbot:error');
      socket.off('chatbot:session');
    };
  }, [socket]);

  const handleSelectSession = (id) => {
    setCurrentSessionId(id);
    if (id) {
      loadSessionMessages(id);
    } else {
      setMessages([]);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chatbot/sessions`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed to load sessions", err);
    }
  };

  const loadSessionMessages = async (id) => {
    setIsLoadingSession(true);
    try {
      const res = await fetch(`${API_BASE}/api/chatbot/sessions/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handleDeleteSession = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/chatbot/sessions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        if (currentSessionId === id) {
          setCurrentSessionId(null);
          setMessages([]);
        }
        loadSessions();
      }
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  const handleSendMessage = (prompt, attachedFile = null) => {
    if (!prompt.trim() || isStreaming || !socket) return;

    setMessages(prev => [...prev, { 
      role: 'user', 
      content: prompt, 
      attachedFile: attachedFile ? { name: attachedFile.name, type: attachedFile.type } : null,
      id: Date.now() 
    }]);
    setMessages(prev => [...prev, { role: 'model', content: '', id: 'thinking' }]);
    setIsStreaming(true);
    socket.emit('chatbot:query', { prompt, sessionId: currentSessionId });
  };

  return (
    <div className="flex h-[calc(100%-16px)] overflow-hidden bg-white rounded-2xl md:rounded-3xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/80 m-1 sm:m-2 relative isolate">
      
      {/* MAIN CHAT AREA (LEFT) */}
      <div className="flex-1 flex flex-col h-full relative min-w-0 bg-[#FAF9F6]/50 rounded-2xl md:rounded-3xl">
        <div className="p-3 sm:p-4 border-b border-slate-100 flex justify-between items-center bg-white/60 backdrop-blur-md z-10 sticky top-0 rounded-t-2xl md:rounded-t-3xl">
          <div className="flex items-center gap-4 w-full justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0F172A] border border-[#1E293B] flex items-center justify-center shadow-sm">
                <Cpu size={18} className="text-sky-400" />
              </div>
              <h2 className="font-semibold text-slate-800 text-[17px] tracking-tight flex items-center gap-1.5">
                Iris <Crown size={16} className="text-sky-500" strokeWidth={2.5} />
              </h2>
            </div>
            
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className={`p-2 text-slate-500 hover:text-slate-900 rounded-xl transition-colors shadow-sm border ${isSidebarOpen ? 'bg-slate-200/50 border-slate-200' : 'bg-white hover:bg-slate-50 border-transparent hover:border-slate-200'}`}
              title="Toggle History"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative bg-transparent flex flex-col">
          {isLoadingSession ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
              <p className="font-medium text-sm">Loading chat history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 px-4 sm:px-6">
              {GreetingIcon && <GreetingIcon className="w-12 h-12 sm:w-16 sm:h-16 text-indigo-200/80 mb-4 sm:mb-6 drop-shadow-sm" />}
              <h3 className="text-2xl sm:text-[28px] font-extrabold text-slate-800 mb-2 sm:mb-3 tracking-tight text-center">{greeting}, {user?.displayName?.split(' ')[0] || 'there'}!</h3>
              <p className="text-center text-slate-500 max-w-md mb-8 sm:mb-10 text-sm sm:text-[15px] leading-relaxed">
                I am Iris, your intelligent HR assistant. I am here to help you navigate policies, analyze team attendance, and provide payroll insights with absolute clarity.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 w-full max-w-2xl">
                {randomPrompts.map((q, i) => (
                  <button 
                    key={i}
                    onClick={() => handleSendMessage(q)}
                    className="p-3 sm:p-4 text-xs sm:text-sm font-medium text-left text-slate-600 bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-2xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 group"
                  >
                    "{q}"
                    <span className="block mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-semibold text-slate-400 group-hover:text-indigo-400 transition-colors">Try this prompt &rarr;</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <MessageList messages={messages} isStreaming={isStreaming} onSendMessage={handleSendMessage} />
          )}
        </div>

        <div className="px-3 sm:px-4 pb-4 sm:pb-6 pt-2 bg-transparent relative z-10">
          <div className="max-w-4xl mx-auto">
            <MessageInput onSend={handleSendMessage} disabled={isStreaming} />
          </div>
        </div>
      </div>

      {/* SIDEBAR AREA (RIGHT) */}
      <div 
        className={`absolute md:relative right-0 h-full border-l border-slate-200/80 bg-slate-50 transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden shrink-0 z-50 ${
          isSidebarOpen ? 'w-[280px] md:w-64 opacity-100 translate-x-0 shadow-[-10px_0_30px_rgba(0,0,0,0.05)] md:shadow-none' : 'w-0 opacity-0 translate-x-4 border-l-0 shadow-none'
        }`}
      >
        <div className="w-[280px] md:w-64 h-full">
          <SessionSidebar 
            sessions={sessions} 
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onNewChat={() => {
              handleSelectSession(null);
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            onClose={() => setIsSidebarOpen(false)}
          />
        </div>
      </div>
      
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="md:hidden absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
