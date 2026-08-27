import { supabase } from "./supabaseClient";

export type EventType = 'login' | 'config_change' | 'error' | 'action';

export const logEvent = async (
  userId: string | null,
  userEmail: string | null,
  eventType: EventType,
  description: string,
  metadata?: any
) => {
  try {
    await supabase.from('activity_logs').insert([{
      user_id: userId,
      user_email: userEmail || 'unknown',
      event_type: eventType,
      description,
      metadata
    }]);
  } catch (err) {
    console.error("Failed to log event:", err);
  }
};
