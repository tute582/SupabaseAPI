import express from "express";
import supabase from "../supabaseClient.js";

const router = express.Router();

// 🔹 判斷使用者身份 API
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 1️⃣ 先查志工資訊
    const { data: volunteer, error: volunteerError } = await supabase
      .from("志工資訊")
      .select("*")
      .eq("V_UserID", id)
      .maybeSingle(); // 改用 maybeSingle 避免空結果報錯

    if (volunteerError) throw volunteerError;

    if (volunteer) {
      return res.json({ role: "志工", data: volunteer });
    }

    // 2️⃣ 若不是志工，查長者資訊
    const { data: elder, error: elderError } = await supabase
      .from("長者資訊")
      .select("*")
      .eq("O_UserID", id)
      .maybeSingle();

    if (elderError) throw elderError;

    if (elder) {
      return res.json({ role: "長者", data: elder });
    }

    // 3️⃣ 若兩個資料表都沒找到
    return res.json({ role: false });
  } catch (error) {
    console.error("❌ 錯誤：", error.message);
    res.status(500).json({ error: "伺服器錯誤，請稍後再試。" });
  }
});

export default router;
