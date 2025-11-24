import express from "express";
import supabase from '../supabaseClient.js';
import dotenv from 'dotenv';
import axios from "axios";

dotenv.config();
const router = express.Router();
const table = "血壓紀錄";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log("GEMINI_API_KEY:", GEMINI_API_KEY);

// Helper: 呼叫 Gemini HTTP API
async function getGeminiResponse(prompt) {
  try {
    const payload = {
      contents: [
        { parts: [{ text: prompt }] }
      ]
    };

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" }
    });

    const reply =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "AI 無法提供建議";

    return { success: true, text: reply };

  } catch (err) {
    const errorMessage = err.response?.data || err.message;
    console.error("Gemini API error:", errorMessage);
    return { success: false, text: "AI 回覆失敗", error: errorMessage };
  }
}

router.post("/", async (req, res) => {
  try {
    const { elder_user_id } = req.body;
    if (!elder_user_id) {
      return res.status(400).json({ success: false, message: "缺少 elder_user_id" });
    }

    // 📌 取得最近的7筆資料
    const { data, error } = await supabase
      .from(table)
      .select("elder_user_id, elder_name, systolic, diastolic, recorded_time")
      .eq("elder_user_id", elder_user_id)
      .order("recorded_time", { ascending: false }) // 時間由新 → 舊
      .limit(7);                                     // 只取最新 7 筆


    if (error) return res.status(400).json({ success: false, message: error.message });
    if (!data || data.length === 0) {
      return res.json({ success: true, data: [], advice: "近 7 天無血壓紀錄" });
    }

    // 組成 prompt
    let summaryText = `你是一位親切的健康輔助 AI，請針對以下使用者的血壓紀錄提供 50 字左右的健康建議：\n`;
    data.forEach((record, idx) => {
      summaryText += `${idx + 1}. 收縮壓: ${record.systolic}, 舒張壓: ${record.diastolic}, 測量時間: ${record.recorded_time}\n`;
    });

    // 呼叫 Gemini HTTP API
    const adviceResult = await getGeminiResponse(summaryText);

    res.json({
      success: true,
      data,
      advice: adviceResult.text
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "伺服器錯誤", errorDetail: err.message });
  }
});

export default router;
