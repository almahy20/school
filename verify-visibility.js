import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('d:/البرمجه/react/edara-arabiya-main/.env');
const env = fs.readFileSync(envPath, 'utf8');
const url = env.match(/VITE_SUPABASE_URL="?(.*?)"?$/m)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="?(.*?)"?$/m)?.[1]?.trim();

const supabase = createClient(url, key);

async function verify() {
  console.log("Checking for 'teacher' roles in user_roles table...");
  const { data: roles, error: rErr } = await supabase.from('user_roles').select('*').eq('role', 'teacher');
  if (rErr) console.error("Error fetching roles:", rErr);
  else console.table(roles);

  console.log("\nChecking for profiles with those IDs...");
  if (roles && roles.length > 0) {
    const ids = roles.map(r => r.user_id);
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, full_name, school_id').in('id', ids);
    if (pErr) console.error("Error fetching profiles:", pErr);
    else console.table(profiles);
  }
}

verify();
