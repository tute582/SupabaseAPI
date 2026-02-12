// ============================================
// ⭐ Gemini HTTP API + 長者-志工配對 API
// ============================================

import express from "express";
import supabase from "../supabaseClient.js";
import dotenv from "dotenv";
import axios from "axios";
import { getGeminiResponse } from "./getAdvice.js";

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
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
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

  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ✨ Gemini 取得 embedding
// ======================
// ✨ Gemini 取得 embedding (修正版)
// ======================
async function getPersonalityEmbedding(text) {
  try {
    if (!text || text === "無內容") return null;
    const url = `https://generativelanguage.googleapis.com/v1/models/text-embedding-3-large:embedText?key=${GEMINI_API_KEY}`;
    const response = await axios.post(
      url,
      { text: text }, // request body
      { headers: { "Content-Type": "application/json" } } // config
    );

    // 📢 保持除錯行，有助於確認結構 (部署前可移除)
    console.log(
      `Gemini API 回覆 (Text: ${text.substring(0, 10)}...):`,
      JSON.stringify(response.data, null, 2)
    );

    // 🚀 關鍵修正：使用 'embeddings' 並取得陣列中的第一個元素
    const embeddingValues = response.data?.embeddings?.[0]?.values;

    if (embeddingValues && Array.isArray(embeddingValues)) {
      return embeddingValues;
    } else {
      console.error("Gemini 回覆結構錯誤或缺少 embeddings 向量。");
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
    return start <= elderTimestamp && elderTimestamp < end;
  });
}

// ======================
// 🚀 API：志工配對
// ======================
router.post("/", async (req, res) => {
  try {
    const { elder_user_id, date, time, location } = req.body;

    // 檢查輸入
    if (!elder_user_id)
      return res
        .status(400)
        .json({ success: false, message: "缺少 elder_user_id" });
    if (!location?.lat || !location?.lng)
      return res
        .status(400)
        .json({ success: false, message: "長者未設定經緯度" });

    // 轉換時間為 Date 物件
    const elderDateTime = new Date(`${date}T${time}:00`);
    if (isNaN(elderDateTime.getTime()))
      return res
        .status(400)
        .json({ success: false, message: "日期或時間格式錯誤" });

    const elderLat = location.lat;
    const elderLng = location.lng;

    // 1. 取得長者資料
    const { data: elder, error: elderError } = await supabase
      .from("長者資訊")
      .select("gender, preference_tags")
      .eq("elder_user_id", elder_user_id)
      .maybeSingle();

    if (elderError) throw elderError;
    if (!elder)
      return res.status(404).json({ success: false, message: "找不到該長者" });

    const elderGender = elder.gender;

    // 2. 取得志工資料
    const { data: volunteers, error: volunteerError } = await supabase
      .from("志工資訊")
      .select(
        "volunteer_user_id, volunteer_name, gender, available_times, location, personality"
      );

    if (volunteerError) throw volunteerError;

    // 3. 匹配志工並計算分數
    const matchedVols = await Promise.all(
      volunteers.map(async (v) => {
        // 條件篩選 1: 性別 (若業務強制同性別)
        if (v.gender !== elderGender) return null;

        // 條件篩選 2: 時間重疊
        if (!isTimeOverlap(v.available_times, elderDateTime)) return null;

        // 計算距離
        const vLat = v.location?.lat;
        const vLng = v.location?.lng;
        const distance =
          vLat && vLng
            ? getDistanceFromLatLng(elderLat, elderLng, vLat, vLng)
            : null; // 無法計算距離

        return {
          volunteer_user_id: v.volunteer_user_id,
          volunteer_personality: v.personality,
        };
      })
    );

    const filteredVols = matchedVols.filter((v) => v != null);

    // 組成 prompt
    let summaryText = `幫我針對這位長者偏好特質，安排最適合他的志工以最適合到最不適合，回傳不要有多餘的文字，只要給我志工ID陣列，存放在陣列裡面就行，不要有任何格式化語法標註，比如 Markdown code block，也不需要任何換行符號等，只需要回傳陣列。\n`;

    // 長輩
    summaryText += "長輩偏好特質如下:\n";
    summaryText += elder.preference_tags;

    // 志工
    summaryText += "\n所有志工性格如下:\n";
    filteredVols.forEach((vol) => {
      summaryText += `志工ID: ${vol.volunteer_user_id} 特質: ${vol.volunteer_personality} \n`;
    });

    // 呼叫 Gemini HTTP API
    let matchResult = await getGeminiResponse(summaryText);
    matchResult = JSON.parse(matchResult.text);

    return res.status(200).json({
      success: true,
      count: matchResult.length,
      volunteer_user_ids: matchResult,
    });
  } catch (err) {
    console.error("AI 配對錯誤：", err);
    return res.status(500).json({ success: false, message: "伺服器錯誤" });  //查看log (SJY)
  }
});
export default router;
