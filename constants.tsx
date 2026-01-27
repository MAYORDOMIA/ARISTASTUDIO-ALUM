
import React from 'react';
import { 
  Database, 
  Hammer, 
  Calculator, 
  Settings,
  Package,
  Layers,
  Thermometer,
  Wind,
  FileText,
  Layout,
  History,
  Briefcase
} from 'lucide-react';

export const COLORS = {
  bg: '#f8fafc',
  card: '#ffffff',
  accent: '#4f46e5',
  text: '#0f172a',
  textDim: '#64748b'
};

export const MENU_ITEMS = [
  { id: 'quoter', label: 'Cotizador', icon: <Calculator size={20} /> },
  { id: 'obras', label: 'Obras Activas', icon: <Briefcase size={20} /> },
  { id: 'history', label: 'Historial', icon: <History size={20} /> },
  { id: 'recipes', label: 'Recetas / Sistemas', icon: <Hammer size={20} /> },
  { id: 'database', label: 'Base de Datos', icon: <Database size={20} /> },
  { id: 'config', label: 'Ajustes', icon: <Settings size={20} /> },
];

export const DATABASE_TABS = [
  { id: 'aluminum', label: 'Aluminio', icon: <Package size={18} /> },
  { id: 'glasses', label: 'Vidrios / Espejos', icon: <Layers size={18} /> },
  { id: 'blindPanels', label: 'Ciegos / Paneles', icon: <Layout size={18} /> },
  { id: 'accessories', label: 'Accesorios', icon: <Wind size={18} /> },
  { id: 'dvh', label: 'Insumos DVH', icon: <Thermometer size={18} /> },
  { id: 'treatments', label: 'Pinturas', icon: <FileText size={18} /> },
];
