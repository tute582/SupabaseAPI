//Gemini HTTP API 產生性格 embedding
import express from "express";
import supabase from "../supabaseClient.js";
import dotenv from 'dotenv';
import axios from "axios";

dotenv.config();
const router = express.Router();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;



// ======================
// 🧭 計算距離 (Haversine)
// ======================
function getDistanceFromLatLng(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = x => (x * Math.PI) / 180;

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
// ✨ Gemini HTTP API 產生性格 embedding
// ======================
async function getPersonalityEmbedding(text) {
  try {
    if (!text) return null;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/textembedding-gecko-001:embedText?key=${GEMINI_API_KEY}`;

    const response = await axios.post(
      url,
      { text: text },  // ✅ 正確欄位
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("送出文字:", text);
    console.log("回傳資料:", response.data);

    // Google API 的正確回傳格式：
    // { embedding: { values: [...] } }
    const embedding = response.data?.embedding?.embedding || 
                      response.data?.embedding?.values ||
                      null;

    if (!embedding) {
      console.warn("⚠️ 無法從 Gemini 抓取 embedding");
      return null;
    }

    return embedding;

  } catch (error) {
    console.error("Embedding 錯誤:", error.response?.data || error.message);
    return null;
  }
}


//字串陣列
function arrayToPersonalityText(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return "無內容";
  }
  return arr.join("；");
}

// ======================
// 🔢 cosine similarity
// ======================
function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] ** 2;
        nb += b[i] ** 2;
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ======================
// 🚀 主要 API：志工配對 + Gemini 性格分析
// ======================
router.post('/', async (req, res) => {
    try {
        const { elder_user_id, date, time, location } = req.body;
        if (!elder_user_id) return res.status(400).json({ success: false, message: "缺少 elder_user_id" });

        const elderDateTime = new Date(`${date}T${time}:00`).getTime();
        const elderLat = location?.lat;
        const elderLng = location?.lng;
        if (!elderLat || !elderLng) return res.status(400).json({ success: false, message: "長者未設定經緯度" });

        // 取得長者資料
        const { data: elder, error: elderError } = await supabase
            .from("長者資訊")
            .select("*")
            .eq("elder_user_id", elder_user_id)
            .maybeSingle();
        if (elderError) throw elderError;
        if (!elder) return res.status(404).json({ success: false, message: "找不到該長者" });

        const elderGender = elder.gender;

        // ======================
        // 取得志工資料
        // ======================
        const { data: volunteers, error: volunteerError } = await supabase
            .from("志工資訊")
            .select("volunteer_user_id, volunteer_name, gender, available_times, location, personality");
        if (volunteerError) throw volunteerError;

        // ======================
        // 時間是否重疊
        // ======================
        function isTimeOverlap(volTimes, elderDateTime) {
            if (!Array.isArray(volTimes)) return false;
            return volTimes.some((timeRange) => {
                const [datePart, hoursPart] = timeRange.split(" ");
                const [startHour, endHour] = hoursPart.split("-");
                const start = new Date(`${datePart}T${startHour}:00`).getTime();
                const end = new Date(`${datePart}T${endHour}:00`).getTime();
                return start <= elderDateTime && elderDateTime <= end;
            });
        }

        // ======================
        // ⭐ 長者 embedding
        // ======================
        const elderPersonalityText = arrayToPersonalityText(elder.preference_tags);
        const elderEmbedding = await getPersonalityEmbedding(elderPersonalityText);

        if (!elderEmbedding) return res.status(500).json({ success: false, message: "無法取得長者性格 embedding" });

        // ======================
        // ✨ 篩選志工 & 計算 embedding + similarity
        // ======================
        const matchedVolunteers = await Promise.all(volunteers.map(async v => {
            if (v.gender !== elderGender) return null;
            if (!isTimeOverlap(v.available_times, elderDateTime)) return null;

            const vLat = v.location?.lat;
            const vLng = v.location?.lng;
            const distance = (elderLat && elderLng && vLat && vLng)
                ? getDistanceFromLatLng(elderLat, elderLng, vLat, vLng)
                : null;

            // 志工 embedding
            const volunteerText = arrayToPersonalityText(v.personality);
            const volunteerEmbedding = await getPersonalityEmbedding(volunteerText);

            const personalityScore = volunteerEmbedding
                ? cosineSimilarity(elderEmbedding, volunteerEmbedding)
                : 0;

            return {
                volunteer_user_id: v.volunteer_user_id,
                volunteer_name: v.volunteer_name,
                distance,
                personality_score: Number(personalityScore.toFixed(4))
            };
        }));

        const filteredVolunteers = matchedVolunteers.filter(v => v !== null);
        filteredVolunteers.sort((a, b) => b.personality_score - a.personality_score);

        return res.status(200).json({
            success: true,
            count: filteredVolunteers.length,
            volunteers: filteredVolunteers,
        });

    } catch (err) {
        console.error("AI 配對錯誤：", err);
        return res.status(500).json({ success: false, message: "伺服器錯誤" });
    }
});

export default router;
