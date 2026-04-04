import { createClient } from '@supabase/supabase-js';
// Note: Run with node --env-file=.env check_error.js


const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('student_parents')
    .select('parent_id, profiles(full_name)')
    .limit(1);
    
  if (error) {
    console.error('ERROR1:', JSON.stringify(error, null, 2));
  } else {
    console.log('DATA1:', data);
  }

  const { data: data2, error: error2 } = await supabase
    .from('student_parents')
    .select('parent_id, profiles!student_parents_parent_id_fkey(full_name)')
    .limit(1);

  if (error2) {
    console.error('ERROR2:', JSON.stringify(error2, null, 2));
  } else {
    console.log('DATA2:', data2);
  }
}
run();
