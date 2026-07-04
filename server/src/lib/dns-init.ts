import dns from 'node:dns';

// Google and Cloudflare public DNS servers required for resolving MongoDB Atlas SRV records
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1']);
console.log('🌐 Using Google & Cloudflare DNS servers (8.8.8.8, 1.1.1.1)');
