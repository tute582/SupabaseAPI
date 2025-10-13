import express from "express";
import supabase from "../supabaseClient.js";

const router = express.Router();

// ✅ 取得所有長者資訊
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("長者資訊")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ✅ 取得單一長者資訊（依 uuid）
router.get("/:elder_user_id", async (req, res) => {
  const { elder_user_id } = req.params;

  const { data, error } = await supabase
    .from("長者資訊")
    .select("*")
    .eq("elder_user_id", elder_user_id)
    .maybeSingle();

  if (error || !data) return res.status(404).json({ error: "找不到該長者資料" });
  res.json(data);
});

// ✅ 新增長者資訊
router.post("/", async (req, res) => {
  const newElder = req.body;

  const { data, error } = await supabase
    .from("長者資訊")
    .insert([newElder])
    .select()
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// ✅ 更新長者資訊（依 uuid）
router.patch("/:elder_user_id", async (req, res) => {
  const { elder_user_id } = req.params;
  const updates = req.body;

  const { data, error } = await supabase
    .from("長者資訊")
    .update({ ...updates, updated_at: new Date() })
    .eq("elder_user_id", elder_user_id)
    .select()
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ✅ 刪除長者資訊（依 uuid）
router.delete("/:elder_user_id", async (req, res) => {
  const { elder_user_id } = req.params;

  const { error } = await supabase
    .from("長者資訊")
    .delete()
    .eq("elder_user_id", elder_user_id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "長者資料已刪除" });
});

export default router;
