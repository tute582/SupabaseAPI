// ============================================
// ⭐ Gemini API 進行相片轉JSON文字應用
// ============================================

import express from "express";
import { getGeminiResponse } from "./getAdvice.js";

const router = express.Router();
// ======================
// API：相片擷取應用
// ======================
router.post("/", async (req, res) => {
  try {
    const { base64 } = req.body;

    if (!base64) {
      return res
        .status(400)
        .json({ success: false, message: "未接收到圖片資料" });
    }

    // 組成 prompt
    let summaryText = `你是一個專業的醫療資訊數位化助手。請辨識附圖（可能包含多張藥袋或看診單），並將內容整合為單一的 JSON 格式輸出。

    請嚴格遵守以下規則：
    1. 輸出格式必須是標準的 JSON，不要有任何格式化語法標註，比如 Markdown code block，也不需要任何換行符號等。
    2. 若圖片中沒有該項資訊，請在 JSON 值中填入 null (不要填寫 "未顯示" 字串)。
    3. 日期格式統一轉換為 YYYY-MM-DD（例如：2026-03-10），若只有民國年請自動換算。
    4. 藥物邏輯：請分析藥名與用法，在 usage_type 欄位標示 "regular" (固定服用) 或 "prn" (需要時服用/症狀治療)。
    5. 若有多張圖片，請自行整併資訊，去除重複內容。
    
    請依照此 JSON 結構輸出：
    {
      "hospital_info": {
        "name": "醫院或診所名稱",
        "address": "地址",
        "department": "科別",
        "doctor_name": "醫生姓名"
      },
      "patient_info": {
        "visit_date": "YYYY-MM-DD",
        "follow_up_date": "YYYY-MM-DD", 
        "follow_up_time": "HH:MM",
        "days_supply": "給藥天數(整數)"
      },
      "medications": [
        {
          "name": "藥品名稱",
          "indication": "推測用途/適應症",
          "dosage": "用法用量 (例如：每日3次 飯後)",
          "usage_type": "regular 或 prn"
        }
      ],
      "notes": {
        "side_effects": "醫囑或副作用",
        "warnings": "其他標語"
      }
    }`;

    // 呼叫 Gemini HTTP API
    let aiResponse = await getGeminiResponse(summaryText, base64);

    // 4. JSON 解析與防呆處理
    let parsedData;
    try {
      parsedData = JSON.parse(aiResponse.text);
    } catch (parseError) {
      //如果輸出的格式錯誤
      summaryText = `
      以下內容不是合法 JSON，請你「只修正格式」，不要新增或刪除任何資料。
      請只輸出「純 JSON 字串」，不要任何說明或標記。

      錯誤內容如下：
      ${aiResponse.text}
      `;

      // 呼叫 Gemini HTTP API
      let tryTwoAiResponse = await getGeminiResponse(summaryText);

      try {
        parsedData = JSON.parse(tryTwoAiResponse.text);
      } catch {
        console.error("JSON 解析兩次皆失敗，原始文字:", aiResponse.text);
        return res.status(502).json({
          success: false,
          message: "AI 回傳格式錯誤，無法解析",
          rawText: aiResponse.text,
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: parsedData,
    });
  } catch (err) {
    console.error("伺服器錯誤：", err.message);
    return res
      .status(500)
      .json({ success: false, message: "伺服器錯誤" + err.message });
  }
});
export default router;
