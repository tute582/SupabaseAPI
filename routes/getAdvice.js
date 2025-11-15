import express from "express";
import supabase from '../supabaseClient.js';
import dotenv from 'dotenv';
import Gemini from '@gemini-ai/sdk';

dotenv.config();
const router = express.Router();
const table = "血壓紀錄";

// 初始化 Gemini 客戶端
const gemini = new Gemini({ apiKey: process.env.GEMINI_API_KEY });

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

    // 1️⃣ 取得 Supabase 血壓資料（近 7 天）
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

    // 2️⃣ 組成 AI prompt（可以一次生成整體分析，也可以逐筆生成）
    let summaryText = `使用者: ${data[0].elder_name}\n近7天血壓紀錄:\n`;
    data.forEach((record, idx) => {
      summaryText += `${idx + 1}. 收縮壓: ${record.systolic}, 舒張壓: ${record.diastolic}, 測量時間: ${record.recorded_time}\n`;
    });
    summaryText += "請提供一段50字左右的健康建議與分析。";

    // 3️⃣ 呼叫 Gemini AI
    const response = await gemini.generate({
      model: "gemini-1.5",
      prompt: summaryText,
      max_output_tokens: 100
    });

    const advice = response.output_text || "AI 無法提供建議";

    // 4️⃣ 回傳資料
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
