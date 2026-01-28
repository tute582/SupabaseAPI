import express from "express";
import supabase from "../supabaseClient.js";
const router = express.Router();
const table = "famil_information";

// 1. 取得所有家屬資訊
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });

    if (error)
      return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 2. 取得單一家屬資訊（依 family_user_id)
router.get("/:family_user_id", async (req, res) => {
  try {
    const { family_user_id } = req.params;

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("family_user_id", family_user_id)
      .maybeSingle();

    if (error || !data)
      return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 3. 新增家屬資訊
router.post("/", async (req, res) => {
  try {
    const newFamily = req.body;
    const now = new Date();
    const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    newFamily.created_at =
      taiwanTime.toISOString().replace("T", " ").substring(0, 19) + "+08";

    const { data, error } = await supabase
      .from(table)
      .insert([{ ...newFamily, updated_at: null }])
      .select()
      .maybeSingle();

    if (error)
      return res.status(400).json({ success: false, message: error.message });
    res.status(201).json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 4. 更新家屬資訊
router.patch("/:family_user_id", async (req, res) => {
  try {
    const { family_user_id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from(table)
      .update({ ...updates, updated_at: new Date() })
      .eq("family_user_id", family_user_id)
      .select()
      .maybeSingle();

    if (error)
      return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 5. 刪除家屬資訊
router.delete("/:family_user_id", async (req, res) => {
  try {
    const { family_user_id } = req.params;

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("family_user_id", family_user_id);

    if (error)
      return res.status(400).json({ success: false, message: error.message });
    res.json({ message: "家屬資料已刪除", data });
  } catch {
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

export default router;
