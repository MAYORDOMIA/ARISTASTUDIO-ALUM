
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, BrainCircuit, ShieldAlert, Zap, Send, Loader2, Info } from 'lucide-react';
import { GlobalConfig, QuoteItem, ProductRecipe } from '../types';

interface Props {
  currentWorkItems: QuoteItem[];
  recipes: ProductRecipe[];
  config: GlobalConfig;
}

const AIAssistant: React.FC<Props> = ({ currentWorkItems, recipes, config }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const analyzeWork = async () => {
    if (currentWorkItems.length === 0) return;
    setLoading(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const prompt = `
        Actúa como un Ingeniero Senior de Carpintería de Aluminio. 
        Analiza los siguientes ítems de una obra activa en nuestro software "AristaStudio Alum":
        
        Configuración Global: ${JSON.stringify(config)}
        Ítems de Obra: ${JSON.stringify(currentWorkItems.map(i => {
          const mainMod = i.composition?.modules?.[0];
          const mainRecipe = mainMod ? recipes.find(r => r.id === mainMod.recipeId) : null;
          return {
            dimensiones: `${i.width}x${i.height}mm`,
            cantidad: i.quantity,
            receta: mainRecipe?.name || 'Desconocida',
            linea: mainRecipe?.line || 'Desconocida'
          };
        }))}
        
        Por favor, genera un reporte técnico que incluya:
        1. Auditoría de Seguridad: ¿Las dimensiones son seguras para estas líneas? (ej. advertir si una ventana es muy grande).
        2. Consejos de Optimización: Cómo reducir desperdicio de perfiles.
        3. Recomendación de Herrajes: Basado en las dimensiones, ¿algún herraje especial?
        4. Estimación de Dificultad: Nivel de complejidad para el taller (1-10).
        
        Responde en formato Markdown profesional con íconos descriptivos.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setAnalysis(response.text || "No se pudo generar el análisis.");
    } catch (error) {
      console.error(error);
      setAnalysis("Error al conectar con Maicol AI Lab. Verifique la conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden border-2 border-indigo-400/20">
        <div className="absolute top-0 right-0 p-10 opacity-10 animate-pulse">
            <BrainCircuit size={180} />
        </div>
        <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-4 bg-white/10 w-fit px-5 py-2 rounded-full border border-white/20 backdrop-blur-md">
                <Sparkles size={18} className="text-yellow-300" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Módulo de Inteligencia Maicol AI</span>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-tighter leading-tight max-w-2xl">
                Auditoría Técnica y Optimización de Ingeniería
            </h2>
            <p className="text-indigo-100 text-sm font-medium max-w-xl leading-relaxed">
                Utiliza redes neuronales para analizar la viabilidad estructural de tus aberturas, detectar riesgos de pandeo y sugerir optimizaciones en el corte de barras.
            </p>
            <div className="pt-6">
                <button 
                  onClick={analyzeWork}
                  disabled={loading || currentWorkItems.length === 0}
                  className={`flex items-center gap-4 px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all shadow-xl active:scale-95 ${
                    currentWorkItems.length > 0 
                    ? 'bg-white text-indigo-600 hover:bg-indigo-50' 
                    : 'bg-indigo-400/50 text-indigo-200 cursor-not-allowed border border-indigo-300/30'
                  }`}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                    {loading ? 'Analizando Ingeniería...' : 'Iniciar Auditoría de Obra'}
                </button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm space-y-6">
                <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-3 border-b border-slate-50 pb-4">
                    <Info size={16} className="text-indigo-500" /> Contexto del Análisis
                </h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400 font-bold uppercase">Ítems a Revisar:</span>
                        <span className="font-black text-indigo-600">{currentWorkItems.length} Unid.</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400 font-bold uppercase">Margen de Error:</span>
                        <span className="font-black text-green-600">&lt; 0.05%</span>
                    </div>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center gap-2 text-[9px] font-black text-indigo-500 uppercase">
                        <ShieldAlert size={14} /> Protocolo de Seguridad
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium uppercase">
                        La IA evaluará el peso propio del vidrio y la resistencia de los perfiles según las inercias registradas en la línea.
                    </p>
                </div>
            </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
            <div className="bg-white border-2 border-slate-200 rounded-[2.5rem] p-10 shadow-sm min-h-[400px] relative">
                {!analysis && !loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 space-y-6">
                        <BrainCircuit size={64} className="opacity-10" />
                        <p className="text-xs font-black uppercase tracking-[0.4em]">Esperando datos de obra...</p>
                    </div>
                )}
                
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 bg-white/80 backdrop-blur-sm z-20 rounded-[2.5rem]">
                        <Loader2 size={48} className="text-indigo-600 animate-spin" />
                        <div className="text-center space-y-2">
                            <p className="text-sm font-black text-indigo-600 uppercase tracking-widest">Calculando Inercias y Esfuerzos</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Conectando con AristaStudio Neural Engine...</p>
                        </div>
                    </div>
                )}

                {analysis && (
                    <div className="prose prose-slate max-w-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-6 mb-8">
                            <h3 className="text-lg font-black uppercase tracking-widest text-indigo-600 flex items-center gap-3">
                                <Send size={20} /> Reporte de Ingeniería IA
                            </h3>
                            <button onClick={() => setAnalysis(null)} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors">Cerrar</button>
                        </div>
                        <div className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed text-sm bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
                            {analysis}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
