import express from "express";
import supabase from "../supabaseClient.js";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const router = express.Router();
const table = "血壓紀錄";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log("GEMINI_API_KEY:", GEMINI_API_KEY);

// Helper: 呼叫 Gemini HTTP API
export async function getGeminiVisionResponse(prompt, imageBase64, mimeType) {
  try {
    // 檢查是否有圖片資料
    const parts = [{ text: prompt }];

    if (imageBase64 && mimeType) {
      parts.push({
        inlineData: {
          mimeType: mimeType, // 例如 "image/jpeg"
          data: imageBase64, // 前端傳來的 Base64 字串 (不含前綴)
        },
      });
    }

    const payload = {
      contents: [{ parts: parts }],
      // 建議加入這個設定，強迫回傳 JSON
      generationConfig: {
        responseMimeType: "application/json",
      },
    };

    // 使用 gemini-1.5-flash 或 gemini-1.5-pro
    // 注意：模型名稱修正為 1.5 系列
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
    });

    const replyText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!replyText) throw new Error("AI 回傳內容為空");

    // 因為我們要求回傳 JSON，這裡可以嘗試 parse 看看是否成功
    try {
      const jsonResult = JSON.parse(replyText);
      return { success: true, data: jsonResult };
    } catch (e) {
      // 萬一 AI 還是回傳了文字雜訊，就回傳純文字
      return { success: true, text: replyText };
    }
  } catch (err) {
    const errorMessage = err.response?.data?.error?.message || err.message;
    console.error("Gemini API error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

router.post("/", async (req, res) => {
  try {
    const { elder_user_id } = req.body;
    if (!elder_user_id) {
      return res.status(400).json({
        success: false,
        message: "缺少 elder_user_id",
        advice: "請點擊右上角[未登入]按鈕進行登入",
      });
    }

    // 📌 取得最近的7筆資料
    const { data, error } = await supabase
      .from(table)
      .select("elder_user_id, elder_name, systolic, diastolic, recorded_time")
      .eq("elder_user_id", elder_user_id)
      .order("recorded_time", { ascending: false }) // 時間由新 → 舊
      .limit(7); // 只取最新 7 筆

    if (error)
      return res.status(400).json({ success: false, message: error.message });
    if (!data || data.length === 0) {
      return res.json({ success: true, data: [], advice: "近 7 天無血壓紀錄" });
    }

    // 組成 prompt
    let summaryText = `你是一位親切的健康輔助 AI，請針對以下使用者的血壓紀錄提供 50 字左右的健康建議：\n`;
    data.forEach((record, idx) => {
      summaryText += `${idx + 1}. 收縮壓: ${record.systolic}, 舒張壓: ${
        record.diastolic
      }, 測量時間: ${record.recorded_time}\n`;
    });

    // 呼叫 Gemini HTTP API
    const adviceResult = await getGeminiResponse(summaryText);

    res.json({
      success: true,
      data,
      advice: adviceResult.text,
      error: adviceResult.error,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "伺服器錯誤",
      errorDetail: err.message,
    });
  }
});

export default router;
