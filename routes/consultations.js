import express from "express";
import supabase from '../supabaseClient.js';
const router = express.Router();
const table = "看診資訊";

// 1️⃣ 取得全部看診資訊
router.get("/", async (req, res) => {
  const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 2️⃣ 新增看診資訊
router.post("/", async (req, res) => {
  const newConsulatation = req.body;

  const { data, error } = await supabase
    .from(table)
    .insert([newConsulatation]);

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// 3️⃣ 更新看診資訊
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body, updated_at: new Date() };

  const { data, error } = await supabase.from(table).update(updates).eq("elder_user_id", id).select();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// 4️⃣ 刪除看診資訊
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from(table).delete().eq("elder_user_id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: `已刪除 elder_user_id=${id} 的看診資訊` });
  //isOK
});

export default router;
