
import { supabase } from './supabase';
import { 
  GlobalConfig, 
  AluminumProfile, 
  Glass, 
  BlindPanel, 
  Accessory, 
  DVHInput, 
  Treatment, 
  ProductRecipe, 
  Quote,
  CustomVisualType,
  QuoteItem
} from '../types';

export const supabaseService = {
  // Config
  async getConfig(): Promise<GlobalConfig | null> {
    const { data, error } = await supabase
      .from('config')
      .select('*')
      .single();
    if (error) return null;
    return data;
  },

  async saveConfig(config: GlobalConfig) {
    const { error } = await supabase
      .from('config')
      .upsert({ id: 1, ...config });
    if (error) throw error;
  },

  // Aluminum Profiles
  async getAluminum(): Promise<AluminumProfile[]> {
    const { data, error } = await supabase.from('aluminum_profiles').select('*');
    if (error) return [];
    return data || [];
  },

  async saveAluminum(profiles: AluminumProfile[]) {
    const { error } = await supabase.from('aluminum_profiles').upsert(profiles);
    if (error) throw error;
  },

  // Glasses
  async getGlasses(): Promise<Glass[]> {
    const { data, error } = await supabase.from('glasses').select('*');
    if (error) return [];
    return data || [];
  },

  async saveGlasses(glasses: Glass[]) {
    const { error } = await supabase.from('glasses').upsert(glasses);
    if (error) throw error;
  },

  // Blind Panels
  async getBlindPanels(): Promise<BlindPanel[]> {
    const { data, error } = await supabase.from('blind_panels').select('*');
    if (error) return [];
    return data || [];
  },

  async saveBlindPanels(panels: BlindPanel[]) {
    const { error } = await supabase.from('blind_panels').upsert(panels);
    if (error) throw error;
  },

  // Accessories
  async getAccessories(): Promise<Accessory[]> {
    const { data, error } = await supabase.from('accessories').select('*');
    if (error) return [];
    return data || [];
  },

  async saveAccessories(accessories: Accessory[]) {
    const { error } = await supabase.from('accessories').upsert(accessories);
    if (error) throw error;
  },

  // DVH Inputs
  async getDvhInputs(): Promise<DVHInput[]> {
    const { data, error } = await supabase.from('dvh_inputs').select('*');
    if (error) return [];
    return data || [];
  },

  async saveDvhInputs(inputs: DVHInput[]) {
    const { error } = await supabase.from('dvh_inputs').upsert(inputs);
    if (error) throw error;
  },

  // Treatments
  async getTreatments(): Promise<Treatment[]> {
    const { data, error } = await supabase.from('treatments').select('*');
    if (error) return [];
    return data || [];
  },

  async saveTreatments(treatments: Treatment[]) {
    const { error } = await supabase.from('treatments').upsert(treatments);
    if (error) throw error;
  },

  // Recipes
  async getRecipes(): Promise<ProductRecipe[]> {
    const { data, error } = await supabase.from('product_recipes').select('*');
    if (error) return [];
    return data || [];
  },

  async saveRecipes(recipes: ProductRecipe[]) {
    const { error } = await supabase.from('product_recipes').upsert(recipes);
    if (error) throw error;
  },

  // Quotes
  async getQuotes(): Promise<Quote[]> {
    const { data, error } = await supabase.from('quotes').select('*');
    if (error) return [];
    return data || [];
  },

  async saveQuotes(quotes: Quote[]) {
    const { error } = await supabase.from('quotes').upsert(quotes);
    if (error) throw error;
  },

  // Custom Visual Types
  async getCustomVisualTypes(): Promise<CustomVisualType[]> {
    const { data, error } = await supabase.from('custom_visual_types').select('*');
    if (error) return [];
    return data || [];
  },

  async saveCustomVisualTypes(types: CustomVisualType[]) {
    const { error } = await supabase.from('custom_visual_types').upsert(types);
    if (error) throw error;
  },

  // Current Work Items (Obras)
  async getCurrentWorkItems(): Promise<QuoteItem[]> {
    const { data, error } = await supabase.from('current_work_items').select('*');
    if (error) return [];
    return data || [];
  },

  async saveCurrentWorkItems(items: QuoteItem[]) {
    const { error } = await supabase.from('current_work_items').upsert(items);
    if (error) throw error;
  }
};
