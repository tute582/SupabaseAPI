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
      .eq("volunteer_user_id", id)
      .maybeSingle(); // 改用 maybeSingle 避免空結果報錯

    if (volunteerError) throw volunteerError;

    if (volunteer) {
      return res.json({ success: true, role: "志工", data: volunteer });
    }

    // 2️⃣ 若不是志工，查長者資訊
    const { data: elder, error: elderError } = await supabase
      .from("長者資訊")
      .select("*")
      .eq("elder_user_id", id)
      .maybeSingle();

    if (elderError) throw elderError;

    if (elder) {
      return res.json({ success: true, role: "長者", data: elder });
    }

    // 2️⃣ 若不是志工、長者，查家屬資訊
    const { data: family, error: familyError } = await supabase
      .from("family_information")
      .select("*")
      .eq("family_user_id", id)
      .maybeSingle();

    if (familyError) throw familyError;

    if (family) {
      return res.json({ success: true, role: "家屬", data: family });
    }

    // 3️⃣ 若三個資料表都沒找到
    return res.json({ success: false });
  } catch (error) {
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

export default router;
