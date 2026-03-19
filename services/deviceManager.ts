import { supabase } from './supabase';

export async function checkDeviceLimit(tenantId: string, userId: string): Promise<boolean> {
  // 1. Get tenant device limit
  const { data: tenant } = await supabase
    .from('tenants')
    .select('deviceLimit, status, expiresAt')
    .eq('id', tenantId)
    .single();

  if (!tenant) return false;
  if (tenant.status !== 'active') return false;
  if (tenant.expiresAt && new Date(tenant.expiresAt) < new Date()) return false;

  // 2. Get current device identifier (from localStorage or generate one)
  let deviceId = localStorage.getItem('arista_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('arista_device_id', deviceId);
  }

  // 3. Check active sessions for this tenant
  const { data: sessions } = await supabase
    .from('device_sessions')
    .select('id, deviceIdentifier')
    .eq('tenantId', tenantId);

  const activeSessions = sessions || [];
  
  // If this device is already registered, allow access
  if (activeSessions.some(s => s.deviceIdentifier === deviceId)) {
    // Update last active
    await supabase.from('device_sessions').update({ lastActive: new Date().toISOString() }).eq('deviceIdentifier', deviceId);
    return true;
  }

  // If not registered, check if we have room
  if (activeSessions.length < tenant.deviceLimit) {
    // Register new device
    await supabase.from('device_sessions').insert({
      tenantId,
      userId,
      deviceIdentifier: deviceId,
      deviceName: navigator.userAgent.substring(0, 50), // Simple device name
      lastActive: new Date().toISOString()
    });
    return true;
  }

  // Limit reached
  return false;
}
