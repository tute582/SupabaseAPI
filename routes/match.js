// ============================================
// ⭐ Gemini HTTP API + 長者-志工配對 API
// ============================================

import express from "express";
import supabase from "../supabaseClient.js";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const router = express.Router();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ======================
// 🔢 輔助函式
// ======================

// 🧭 計算距離 (Haversine) - 輸出單位：公里 (km)
function getDistanceFromLatLng(lat1, lng1, lat2, lng2) {
  const R = 6371; // 地球半徑 (公里)
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 字串陣列 → 性格文字 (用於 Embedding)
function arrayToPersonalityText(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "無內容";
  return arr.join("；");
}

// 🔢 cosine similarity (支援向量長度不一致)
function cosineSimilarity(a, b) {
  if (!a || !b) return 0;
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ✨ Gemini 取得 embedding
async function getPersonalityEmbedding(text) {
  try {
    if (!text || text === "無內容") return null;
    const url = `https://generativelanguage.googleapis.com/v1/models/text-embedding-3-large:embedText?key=${GEMINI_API_KEY}`;
    // 修正: axios.post 的呼叫語法
    const response = await axios.post(
      url,
      { text: text }, // request body
      { headers: { "Content-Type": "application/json" } } // config
    );

    console.log(`Gemini API 回覆 (Text: ${text.substring(0, 10)}...):`, JSON.stringify(response.data, null, 2));

    if (response.data?.embedding?.values && Array.isArray(response.data.embedding.values)) {
        return response.data.embedding.values;
    } else {
        console.error("Gemini 回覆結構錯誤或缺少 Embedding。");
        return null;
    }
    
  } catch (err) {
    console.error("Embedding API 錯誤:", err.response?.data || err.message);
    return null;
  }
}

// ⏳ 時間重疊檢查
function isTimeOverlap(volTimes, elderDateTime) {
  if (!Array.isArray(volTimes)) return false;
  const elderTimestamp = elderDateTime.getTime();
  return volTimes.some((t) => {
    // 預期格式: "YYYY-MM-DD HH:MM-HH:MM"
    const [datePart, hours] = t.split(" ");
    const [startHour, endHour] = hours.split("-");

    // 注意: 這假設 startHour 和 endHour 格式是 HH:MM
    const start = new Date(`${datePart}T${startHour}:00`).getTime();
    const end = new Date(`${datePart}T${endHour}:00`).getTime();
    
    // 檢查長者指定時間是否在志工的可用區間內 (包含邊界)
    return start <= elderTimestamp && elderTimestamp <= end;
  });
}

// ======================
// 🚀 API：志工配對
// ======================
router.post("/", async (req, res) => {
  try {
    const { elder_user_id, date, time, location } = req.body;
    
    // 檢查輸入
    if (!elder_user_id) return res.status(400).json({ success: false, message: "缺少 elder_user_id" });
    if (!location?.lat || !location?.lng) return res.status(400).json({ success: false, message: "長者未設定經緯度" });

    // 轉換時間為 Date 物件
    const elderDateTime = new Date(`${date}T${time}:00`);
    if (isNaN(elderDateTime.getTime())) return res.status(400).json({ success: false, message: "日期或時間格式錯誤" });

    const elderLat = location.lat;
    const elderLng = location.lng;

    // 1. 取得長者資料
    const { data: elder, error: elderError } = await supabase
      .from("長者資訊")
      .select("gender, preference_tags")
      .eq("elder_user_id", elder_user_id)
      .maybeSingle();

    if (elderError) throw elderError;
    if (!elder) return res.status(404).json({ success: false, message: "找不到該長者" });

    const elderGender = elder.gender;
    const elderText = arrayToPersonalityText(elder.preference_tags);
    const elderEmbedding = await getPersonalityEmbedding(elderText);

    if (!elderEmbedding) {
      // 建議: 即使無法取得 embedding，也應繼續配對，只是性格分數為 0
      console.warn("無法取得長者性格 embedding，性格分數將為 0。");
    }

    // 2. 取得志工資料
    const { data: volunteers, error: volunteerError } = await supabase
      .from("志工資訊")
      .select("volunteer_user_id, volunteer_name, gender, available_times, location, personality");
    
    if (volunteerError) throw volunteerError;

    // ⚠️ 增加除錯行 ⚠️
console.log("第一個志工的 Personality 原始資料:", volunteers[0]?.personality); 
// ⚠️ 增加除錯行 ⚠️

    // 3. 匹配志工並計算分數
    const matchedVols = await Promise.all(volunteers.map(async (v) => {
      // 條件篩選 1: 性別 (若業務強制同性別)
      if (v.gender !== elderGender) return null; 

      // 條件篩選 2: 時間重疊
      if (!isTimeOverlap(v.available_times, elderDateTime)) return null;

      // 計算距離
      const vLat = v.location?.lat;
      const vLng = v.location?.lng;
      const distance = (vLat && vLng) ? 
        getDistanceFromLatLng(elderLat, elderLng, vLat, vLng) : 
        null; // 無法計算距離

      // 計算性格分數
      const vText = arrayToPersonalityText(v.personality);
      const vEmbedding = await getPersonalityEmbedding(vText);

      // 如果長者或志工的 Embedding 失敗，分數為 0
      const personalityScore = 
        (elderEmbedding && vEmbedding) ? 
        cosineSimilarity(elderEmbedding, vEmbedding) : 
        0;

      return {
        volunteer_user_id: v.volunteer_user_id,
        volunteer_name: v.volunteer_name,
        distance: distance ? Number(distance.toFixed(2)) : null, // 距離取小數兩位
        personality_score: Number(personalityScore.toFixed(4)) // 性格分數取小數四位
      };
    }));

    // 4. 篩選與排序
    const filtered = matchedVols.filter(v => v !== null);
    // 排序：預設只按 性格分數 (高到低)
    filtered.sort((a, b) => b.personality_score - a.personality_score);

    // ⚠️ 優化建議: 可以在這裡加入距離的權重計算，以得到綜合評分。

    return res.status(200).json({
      success: true,
      count: filtered.length,
      volunteers: filtered
    });

  } catch (err) {
    console.error("AI 配對錯誤：", err);
    return res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

export default router;
