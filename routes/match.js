import express from "express";
import supabase from "../supabaseClient.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

// 初始化 Gemini
const genAI = new GoogleGenerativeAI("AIzaSyC8l6uLIGsBZ4TgvGT70NjiTMwAbxIGPJc");//需修改位置 和key一起 GOOGLE_API_KEY  另存到.env
const embeddingModel = genAI.getGenerativeModel({ model: "models/text-embedding-004" });

// 計算距離 (Haversine)
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

// 計算相似度(例如:健談==>會聊天) 比較思考角度
function cosineSimilarity(a, b) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// 判斷時間是否重疊
function isTimeOverlap(volunteerTimes, elderDateTime) {
    if (!Array.isArray(volunteerTimes)) return false;
    return volunteerTimes.some(timeRange => {
        const [datePart, hoursPart] = timeRange.split(" ");
        const [startHour, endHour] = hoursPart.split("-");
        const start = new Date(`${datePart}T${startHour}:00`).getTime();
        const end = new Date(`${datePart}T${endHour}:00`).getTime();
        return start <= elderDateTime && elderDateTime <= end;
    });
}

router.post('/', async (req, res) => {
    try {
        const { elder_user_id, date, time, location } = req.body;   //前端取得:長者id、時間、地點經緯度

         // 長者時間格式驗證
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const timeRegex = /^\d{2}:\d{2}$/;

        if (!elder_user_id) {
            return res.status(400).json({ success: false, message: "缺少 elder_user_id" });
        }        

        if (!dateRegex.test(date)) {
            return res.status(400).json({ success: false, message: "日期格式錯誤，應為 YYYY-MM-DD" });
        }

        if (!timeRegex.test(time)) {
            return res.status(400).json({ success: false, message: "時間格式錯誤，應為 HH:MM" });
        }

        // const elderDateTime = new Date(`${date}T${time}:00`).getTime();
        const elderLat = location?.lat;
        const elderLng = location?.lng;

        if (!elderLat || !elderLng) {
            return res.status(400).json({ success: false, message: "長者未設定經緯度" });
        }

        // 查詢長者資料
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

        const elderText = (elder.preference_tags || []).join("、");
        // 生成長者 embedding
        const elderEmbedRes = await embeddingModel.embedContent(elderText);
        const elderVec = elderEmbedRes.embedding.values;

        // 查詢志工資料
        const { data: volunteers, error: volunteerError } = await supabase
            .from("志工資訊")
            .select("volunteer_user_id, volunteer_name, gender, available_times, location, personality");
        if (volunteerError) throw volunteerError;


        //志工時間 確保時間格式正確
         const safeVolunteers = volunteers.filter(v => {
            if (!Array.isArray(v.available_times)) return false;
            return v.available_times.every(t => {
                const parts = t.split(" ");
                if (parts.length !== 2) return false;
                if (!dateRegex.test(parts[0])) return false;
                if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(parts[1])) return false;
                return true;
            });
        });


        // 先過濾硬性條件（性別 + 時間重疊）
        const filteredVolunteers = safeVolunteers.filter(v =>
            v.gender === elderGender && isTimeOverlap(v.available_times, elderDateTime)
        );

        const matchedVolunteers = [];

        // 生成志工 embedding 並計算相似度
        for (const v of filteredVolunteers) {
            const volunteersText = (v.personality || []).join("、");
            const embedRes = await embeddingModel.embedContent(volunteersText);
            const volunteersVec = embedRes.embedding.values;

            const similarity = cosineSimilarity(elderVec, volunteersVec);

            const vLat = v.location?.lat;
            const vLng = v.location?.lng;
            const distance = (elderLat && elderLng && vLat && vLng)
                ? getDistanceFromLatLng(elderLat, elderLng, vLat, vLng)
                : null;

            matchedVolunteers.push({
                volunteer_user_id: v.volunteer_user_id,
                volunteer_name: v.volunteer_name,
                distance,
                similarity
            });
        }

        // 依照相似度排序（由高到低）
        matchedVolunteers.sort((a, b) => b.similarity - a.similarity);

        return res.status(200).json({
            success: true,
            volunteers: matchedVolunteers
        });

    } catch (err) {
        console.error("AI 配對錯誤：", err);
        return res.status(500).json({ success: false, message: "伺服器錯誤" });
    }
});

export default router;
