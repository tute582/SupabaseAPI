import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rygawaqskvijgaciinzc.supabase.co";  
const supabaseKey = "sb_secret_5q_E9M6iBVNEb2peBFtg1w_YaxXeeGR";

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase; // 這裡是 default export

// 連接 Supabase
// const supabase = createClient(
//   //去 Vercel → Project → Settings → Environment Variables 新增：
//   process.env.SUPABASE_URL,      // 你的 Supabase Project URL
//   process.env.SUPABASE_API_KEY   // 你的 Supabase API Key
// );