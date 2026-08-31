import { readFile, writeFile, stat } from 'node:fs/promises';

const requiredFiles = [
  ['src/main.tsx', 'createRoot'],
  ['src/main.tsx', '<App />'],
  ['src/integrations/supabase/client.ts', 'export const supabase'],
  ['src/hooks/queries/useConversations.ts', 'export'],
  ['src/hooks/queries/useNotifications.ts', 'export'],
  ['src/hooks/queries/useOrders.ts', 'export'],
  ['src/hooks/queries/useSuperAdmin.ts', 'export'],
  ['src/components/exams/ExamTakingView.tsx', 'export'],
];

for (const [file, requiredText] of requiredFiles) {
  const fileStats = await stat(file);
  const source = await readFile(file, 'utf8');

  if (fileStats.size === 0 || !source.includes(requiredText)) {
    throw new Error(`Build stopped: ${file} is missing or incomplete.`);
  }
}

console.log('✅ Entry-point integrity check passed.');

// ── Auto-version Service Worker on every build ──────────────────────────────
const buildTimestamp = Date.now();
const swPath = 'public/sw.js';

try {
  let swContent = await readFile(swPath, 'utf8');
  // Replace CACHE_NAME with unique build timestamp
  swContent = swContent.replace(
    /const CACHE_NAME = ['"][^'"]+['"];/,
    `const CACHE_NAME = 'school-cache-v${buildTimestamp}';`
  );
  await writeFile(swPath, swContent, 'utf8');
  console.log(`✅ Updated Service Worker cache version: school-cache-v${buildTimestamp}`);

  // Write version.json for client version tracking
  const versionData = {
    version: buildTimestamp,
    builtAt: new Date().toISOString(),
  };
  await writeFile('public/version.json', JSON.stringify(versionData, null, 2), 'utf8');
} catch (err) {
  console.warn('⚠️ Could not update SW cache version:', err.message);
}