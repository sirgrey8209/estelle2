/**
 * Local IP detection using os.networkInterfaces()
 * No network call needed - instant response
 */
import os from 'os';

export function getExternalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces).flat()) {
    if (iface && iface.family === 'IPv4' && !iface.internal) {
      return iface.address;
    }
  }
  return 'unknown';
}
