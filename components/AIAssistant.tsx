
import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  X, 
  Sparkles, 
  Terminal, 
  Cpu, 
  Calculator, 
  Zap, 
  MessageSquare,
  Maximize2,
  Minimize2,
  AlertCircle
} from 'lucide-react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AluminumProfile, Glass, ProductRecipe, QuoteItem, GlobalConfig } from '../types';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface Props {
  recipes: ProductRecipe[];
  aluminum: AluminumProfile[];
  glasses: Glass[];
  currentWorkItems: QuoteItem[];
  setCurrentWorkItems: (items: QuoteItem[]) => void;
  config: GlobalConfig;
}

const AIAssistant: React.FC<Props> = ({ 
  recipes, 
  aluminum, 
  glasses, 
  currentWorkItems, 
  setCurrentWorkItems,
  config 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Terminal de Ingeniería ARISTA lista. ¿En qué cálculo o configuración puedo asistirte hoy?' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const systemInstruction = `
        Eres el Asistente Técnico Senior de ARISTASTUDIO ALUM, un software de ingeniería de carpintería de aluminio.
        Tu objetivo es ayudar al usuario con cálculos de peso, optimización de cortes, sugerencias de sistemas y dudas técnicas.
        
        CONTEXTO ACTUAL:
        - Sistemas Disponibles: ${recipes.map(r => r.name).join(', ')}
        - Líneas: ${Array.from(new Set(recipes.map(r => r.line))).join(', ')}
        - Perfiles en Base de Datos: ${aluminum.length} registros.
        - Vidrios en Base de Datos: ${glasses.length} registros.
        - Obra Actual: ${currentWorkItems.length} carpinterías cargadas.
        - Costo Base Aluminio: $${config.aluminumPricePerKg}/KG.

        REGLAS:
        1. Sé extremadamente técnico y preciso.
        2. Si te preguntan por pesos, usa los datos de la base si están disponibles.
        3. Si sugieres un sistema, explica por qué (ej: estanqueidad, inercia, estética).
        4. No respondas sobre temas que no sean de carpintería de aluminio o ingeniería civil.
        5. Mantén un tono profesional e industrial.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: messages.concat({ role: 'user', content: userMessage }).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const aiResponse = response.text || "Lo siento, la terminal no ha podido procesar la consulta.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);

    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "ERROR DE CONEXIÓN CON EL NÚCLEO DE IA. Por favor, verifique su conexión." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className={`fixed bottom-6 right-6 z-[300] flex flex-col items-end transition-all duration-500 ${isOpen ? 'w-full max-w-lg' : 'w-auto'}`}>
      
      {/* Chat Window */}
      {isOpen && (
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden mb-4 transition-all duration-300 ${isExpanded ? 'h-[80vh]' : 'h-[500px]'}`}>
          
          {/* Header */}
          <div className="bg-indigo-600 p-5 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
                <Terminal size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest leading-none">Terminal AI</h3>
                <span className="text-[8px] font-bold text-indigo-200 uppercase tracking-tighter">Consultor Técnico Activo</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors">
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[#f8fafc] dark:bg-slate-950">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-[11px] leading-relaxed shadow-sm border ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white border-indigo-700' 
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {m.role === 'assistant' ? <Cpu size={12} className="text-indigo-500" /> : <div className="w-2 h-2 rounded-full bg-white/40" />}
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60">
                      {m.role === 'assistant' ? 'ARISTA ENGINE' : 'OPERADOR'}
                    </span>
                  </div>
                  <div className="font-medium whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start animate-pulse">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Escribe tu consulta técnica..." 
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-5 pr-14 py-4 rounded-2xl text-[11px] font-bold dark:text-white outline-none focus:border-indigo-500 transition-all shadow-inner"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button 
                onClick={handleSendMessage}
                disabled={isTyping}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl transition-all duration-300 active:scale-90 group relative ${
          isOpen ? 'bg-slate-800 rotate-90 scale-75' : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        <div className="absolute inset-0 bg-indigo-400 rounded-[1.5rem] animate-ping opacity-20 group-hover:opacity-40 transition-opacity" />
        {isOpen ? <X size={28} /> : <Bot size={28} />}
        {!isOpen && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-400 text-white rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                <Sparkles size={10} className="animate-pulse" />
            </div>
        )}
      </button>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; }
      `}</style>
    </div>
  );
};

export default AIAssistant;
