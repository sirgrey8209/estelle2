/**
 * External IP detection
 */
import https from 'https';

export function getExternalIp(): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('IP detection timeout'));
    }, 10000);

    const req = https.get('https://api.ipify.org', { timeout: 5000 }, (res) => {
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        clearTimeout(timeout);
        resolve(data.trim());
      });
      res.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      clearTimeout(timeout);
      reject(new Error('Request timeout'));
    });
  });
}
