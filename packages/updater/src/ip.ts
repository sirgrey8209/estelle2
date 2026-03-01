/**
 * External IP detection
 */
import https from 'https';

export function getExternalIp(): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get('https://api.ipify.org', (res) => {
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data.trim()));
      res.on('error', reject);
    }).on('error', reject);
  });
}
