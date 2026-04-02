import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env logic manually since dotenv might not be installed globally
const envFile = fs.readFileSync(path.resolve('.env'), 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function check() {
    const { data: roles, error } = await supabase
        .from('user_roles')
        .select('*, profiles(full_name, email, phone)')
        .order('created_at', { ascending: false })
        .limit(5);
        
    console.log(JSON.stringify(roles, null, 2));
}

check();
