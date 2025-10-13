import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from "@supabase/supabase-js";

// 只有在本地開發才載入 dotenv
if (process.env.VERCEL_ENV === undefined) {
  // 本地開發環境，載入 .env
  import('dotenv/config');

  const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const envPath = path.resolve(__dirname, '.env');

    dotenv.config({ path: envPath });
    dotenv.config({ path: path.resolve(__dirname, '.env') });
}

console.log("✅ SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("✅ SUPABASE_API_KEY:", process.env.SUPABASE_API_KEY ? "已讀取" : "未讀取");

// 連接 Supabase
const supabase = createClient(
  //去 Vercel → Project → Settings → Environment Variables 新增：
  process.env.SUPABASE_URL,      // 你的 Supabase Project URL
  process.env.SUPABASE_API_KEY   // 你的 Supabase API Key
);

export default supabase; // 這裡是 default export