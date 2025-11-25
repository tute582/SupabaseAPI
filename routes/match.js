// ============================================
// ⭐ Gemini HTTP API + 長者-志工配對 API (安全版)
// ============================================

import express from "express";
import supabase from "../supabaseClient.js";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const router = express.Router();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ======================
// 🧭 計算距離 (Haversine)
// ======================
function getDistanceFromLatLng(lat1, lng1, lat2, lng2) {
  const R = 6371;
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

// ======================
// ✨ Gemini 取得 embedding
// ======================
async function getPersonalityEmbedding(text) {
  try {
    if (!text) return null;
    const url = `https://generativelanguage.googleapis.com/v1/models/text-embedding-3-large:embedText?key=${GEMINI_API_KEY}`;
    const response = await axios.post
      url,
      { text },
      { headers: { "Content-Type": "application/json" } }
    );
    return response.data?.embedding?.values || null;
  } catch (err) {
    console.error("Embedding API 錯誤:", err.response?.data || err);
    return null;
  }
}

// ======================
// 字串陣列 → 性格文字
// ======================
function arrayToPersonalityText(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "無內容";
  return arr.join("；");
}

// ======================
// 🔢 cosine similarity (安全版)
// 支援向量長度不一致
// ======================
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

// ======================
// 🚀 API：志工配對
// ======================
router.post("/", async (req, res) => {
  try {
    const { elder_user_id, date, time, location } = req.body;
    if (!elder_user_id) return res.status(400).json({ success: false, message: "缺少 elder_user_id" });
    if (!location?.lat || !location?.lng) return res.status(400).json({ success: false, message: "長者未設定經緯度" });

    const elderDateTime = new Date(`${date}T${time}:00`).getTime();
    const elderLat = location.lat;
    const elderLng = location.lng;

    // 取得長者資料
    const { data: elder, error: elderError } = await supabase
      .from("長者資訊")
      .select("*")
      .eq("elder_user_id", elder_user_id)
      .maybeSingle();
    if (elderError) throw elderError;
    if (!elder) return res.status(404).json({ success: false, message: "找不到該長者" });

    const elderGender = elder.gender;

    // 取得志工資料
    const { data: volunteers, error: volunteerError } = await supabase
      .from("志工資訊")
      .select("volunteer_user_id, volunteer_name, gender, available_times, location, personality");
    if (volunteerError) throw volunteerError;

    // 時間重疊檢查
    function isTimeOverlap(volTimes, elderDateTime) {
      if (!Array.isArray(volTimes)) return false;
      return volTimes.some((t) => {
        const [datePart, hours] = t.split(" ");
        const [startHour, endHour] = hours.split("-");
        const start = new Date(`${datePart}T${startHour}:00`).getTime();
        const end = new Date(`${datePart}T${endHour}:00`).getTime();
        return start <= elderDateTime && elderDateTime <= end;
      });
    }

    // 長者 embedding
    const elderText = arrayToPersonalityText(elder.preference_tags);
    const elderEmbedding = await getPersonalityEmbedding(elderText);
    if (!elderEmbedding) return res.status(500).json({ success: false, message: "無法取得長者性格 embedding" });

    // 匹配志工
    const matchedVols = await Promise.all(volunteers.map(async (v) => {
      if (v.gender !== elderGender) return null;
      if (!isTimeOverlap(v.available_times, elderDateTime)) return null;

      const vLat = v.location?.lat;
      const vLng = v.location?.lng;
      const distance = vLat && vLng ? getDistanceFromLatLng(elderLat, elderLng, vLat, vLng) : null;

      const vText = arrayToPersonalityText(v.personality);
      const vEmbedding = await getPersonalityEmbedding(vText);

      const personalityScore = vEmbedding ? cosineSimilarity(elderEmbedding, vEmbedding) : 0;

      return {
        volunteer_user_id: v.volunteer_user_id,
        volunteer_name: v.volunteer_name,
        distance,
        personality_score: Number(personalityScore.toFixed(4))
      };
    }));

    const filtered = matchedVols.filter(v => v !== null);
    filtered.sort((a, b) => b.personality_score - a.personality_score);

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
