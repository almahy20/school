/**
 * Run this script ONCE to generate your VAPID keys for Push Notifications.
 *
 * Steps:
 *   1. npm install web-push
 *   2. node scripts/generate-vapid-keys.js
 *   3. Copy the output into your .env.local file and Supabase Edge Function secrets
 */

const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();

console.log('\n✅ VAPID Keys Generated Successfully!\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📋 Add to .env.local:');
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log('\n📋 Add to Supabase Edge Function Secrets:');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:admin@yourschool.com`);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n⚠️  Keep VAPID_PRIVATE_KEY secret and never commit it to git!\n');
