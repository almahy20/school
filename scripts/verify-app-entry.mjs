import { readFile, stat } from 'node:fs/promises';

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

console.log('Entry-point integrity check passed.');