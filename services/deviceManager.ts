import { supabase } from './supabase';

export async function checkDeviceLimit(tenantId: string, userId: string): Promise<boolean> {
  // 1. Get tenant device limit
  const { data: tenant } = await supabase
    .from('tenants')
    .select('device_limit, status, expires_at')
    .eq('id', tenantId)
    .single();

  if (!tenant) return false;
  if (tenant.status !== 'active') return false;
  if (tenant.expires_at && new Date(tenant.expires_at) < new Date()) return false;

  // 2. Get current device identifier (from localStorage or generate one)
  let deviceId = localStorage.getItem('arista_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('arista_device_id', deviceId);
  }

  // 3. Check active sessions for this tenant
  const { data: sessions } = await supabase
    .from('device_sessions')
    .select('id, device_identifier')
    .eq('tenant_id', tenantId);

  const activeSessions = sessions || [];
  
  // If this device is already registered, allow access
  if (activeSessions.some(s => s.device_identifier === deviceId)) {
    // Update last active
    await supabase.from('device_sessions').update({ last_active: new Date().toISOString() }).eq('device_identifier', deviceId);
    return true;
  }

  // If not registered, check if we have room
  if (activeSessions.length < tenant.device_limit) {
    // Register new device
    await supabase.from('device_sessions').insert({
      tenant_id: tenantId,
      user_id: userId,
      device_identifier: deviceId,
      device_name: navigator.userAgent.substring(0, 50), // Simple device name
      last_active: new Date().toISOString()
    });
    return true;
  }

  // Limit reached
  return false;
}
