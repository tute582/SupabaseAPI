import express from "express";
import supabase from '../supabaseClient.js';
import dotenv from 'dotenv';
import axios from "axios";

dotenv.config();
const router = express.Router();
const table = "血壓紀錄";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log(process.env.GEMINI_API_KEY)
// Helper: 呼叫 Gemini HTTP API
async function getGeminiResponse(prompt) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
      // Gemini API 的格式
      contents: [{ parts: [{ text: prompt }] }]
    };

    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" }
    });

    const reply = response.data?.candidates?.[0]?.content?.[0]?.text;
    return reply || "AI 無法提供建議";
  } catch (err) {
    console.error("Gemini API error:", err.response?.data || err.message);
    return "AI 回覆失敗";
  }
}

router.post("/", async (req, res) => {
  try {
    const { elder_user_id } = req.body;
    if (!elder_user_id) {
      return res.status(400).json({ success: false, message: "缺少 elder_user_id" });
    }

    // 取得 7 天前日期
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    // 取得 Supabase 血壓資料
    const { data, error } = await supabase
      .from(table)
      .select("elder_user_id, elder_name, systolic, diastolic, recorded_time")
      .eq("elder_user_id", elder_user_id)
      .gte("recorded_time", sevenDaysAgoISO)
      .order("recorded_time", { ascending: true });

    if (error) return res.status(400).json({ success: false, message: error.message });
    if (!data || data.length === 0) {
      return res.json({ success: true, data: [], message: "近 7 天無血壓紀錄" });
    }

    // 組成 prompt
    let summaryText = `你是一位親切的健康輔助 AI，請針對以下使用者的血壓紀錄提供 50 字左右的健康建議：\n`;
    summaryText += `使用者: ${data[0].elder_name}\n`;
    data.forEach((record, idx) => {
      summaryText += `${idx + 1}. 收縮壓: ${record.systolic}, 舒張壓: ${record.diastolic}, 測量時間: ${record.recorded_time}\n`;
    });

    // 呼叫 Gemini HTTP API
    const advice = await getGeminiResponse(summaryText);

    res.json({
      success: true,
      data,
      advice
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

export default router;
