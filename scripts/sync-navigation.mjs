import { syncSite } from './sync-site.mjs';
await syncSite({ check: process.argv.includes('--check') });
console.log('Fælles sideramme er opdateret.');
