//Gemini HTTP API 產生性格 embedding
import express from "express";
import supabase from "../supabaseClient.js";
import axios from "axios";
const router = express.Router();

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
    const apiKey = 'AIzaSyC8l6uLIGsBZ4TgvGT70NjiTMwAbxIGPJc';
    if (!apiKey) {
      console.error("❗ 缺少 GOOGLE_API_KEY");
      return null;
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedText?key=${apiKey}`;

    const response = await axios.post(
      url,
      { "input": text },   // 🔥 正確欄位
      { headers: { "Content-Type": "application/json" } }
    );

    // 🔥 正確的路徑
    return response.data.embeddings?.[0]?.values ?? null;

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

        if (!elder_user_id) {
            return res.status(400).json({ success: false, message: "缺少 elder_user_id" });
        }

        const elderDateTime = new Date(`${date}T${time}:00`).getTime();

        const elderLat = location?.lat;
        const elderLng = location?.lng;

        if (!elderLat || !elderLng) {
            return res.status(400).json({ success: false, message: "長者未設定經緯度" });
        }

        // 取得長者資料
        const { data: elder, error: elderError } = await supabase
            .from("長者資訊")
            .select("*")
            .eq("elder_user_id", elder_user_id)
            .maybeSingle();

        if (elderError) throw elderError;
        if (!elder) return res.status(404).json({ success: false, message: "找不到該長者" });

        const elderGender = elder.gender;
        // const elderLat = elder.location?.lat;
        // const elderLng = elder.location?.lng;

        // if (!elderLat || !elderLng) {
        //     return res.status(400).json({ success: false, message: "長者未設定經緯度" });
        // }

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
        // ⭐ 產生長者性格向量（透過 Gemini）
        // personality 欄位請自行在 DB 內建立
        // ======================
        const elderPersonalityText = arrayToPersonalityText(elder.preference_tags);
        const elderEmbedding = await getPersonalityEmbedding(elderPersonalityText);

        // ======================
        // ✨ 篩選志工（性別 + 時間）
        // ======================
        const matchedVolunteers = [];

        for (const v of volunteers) {

            if (v.gender !== elderGender) continue;
            if (!isTimeOverlap(v.available_times, elderDateTime)) continue;

            // 🔍 計算距離
            const vLat = v.location?.lat;
            const vLng = v.location?.lng;

            const distance =
                (elderLat && elderLng && vLat && vLng)
                    ? getDistanceFromLatLng(elderLat, elderLng, vLat, vLng)
                    : null;

            // ⭐ 志工性格 embedding
            const volunteerText = arrayToPersonalityText(v.personality);
            const volunteerEmbedding = await getPersonalityEmbedding(volunteerText);
            // 🔥 Debug
            console.log("ELDER TEXT:", elderPersonalityText);
            console.log("ELDER EMBEDDING:", elderEmbedding?.length);

            console.log("VOL TEXT:", volunteerText);
            console.log("VOL EMBEDDING:", volunteerEmbedding?.length);


            // ⭐ 性格相似度
            const personalityScore = elderEmbedding && volunteerEmbedding
                ? cosineSimilarity(elderEmbedding, volunteerEmbedding)
                : 0;

            matchedVolunteers.push({
                volunteer_user_id: v.volunteer_user_id,
                volunteer_name: v.volunteer_name,
                distance,
                personality_score: Number(personalityScore.toFixed(4))
            });
        }

        return res.status(200).json({
            success: true,
            count: matchedVolunteers.length,
            volunteers: matchedVolunteers,
        });

    } catch (err) {
        console.error("AI 配對錯誤：", err);
        return res.status(500).json({ success: false, message: "伺服器錯誤" });
    }
});

export default router;
