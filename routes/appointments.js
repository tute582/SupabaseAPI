import express from "express";
import supabase from '../supabaseClient.js';
const router = express.Router();

// ✅ 取得所有預約資料
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("預約志工")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});


// ✅ 取得單筆預約（根據 uuid）
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("預約志工")
    .select("*")
    .eq("uuid", id)
    .single();

  if (error) return res.status(404).json({ error: "找不到該預約" });
  res.json(data);
});

// ✅ 取得志工對應的長者（根據 v_user_id）
router.get("/by-volunteer/:v_user_id", async (req, res) => {
  const { v_user_id } = req.params;

  const { data, error } = await supabase
    .from("預約志工")
    .select("elder_name") // 只取 elder_user_id 欄位
    .eq("volunteer_user_id", v_user_id)

  if (error || !data) {
    return res.status(404).json({ error: "找不到該志工的長者姓名" });
  }

  // 去除重複長者名稱
  const uniqueNames = [...new Set(data.map(d => d.elder_name))];

  res.json({
    elder_name: uniqueNames ,
  });
});

// ✅ 建立新預約
router.post("/", async (req, res) => {
  const newAppointment = req.body;

  const { data, error } = await supabase
    .from("預約志工")
    .insert([newAppointment])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});


// ✅ 更新預約（根據 uuid）
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const { data, error } = await supabase
    .from("預約志工")
    .update({ ...updates, updated_at: new Date() })
    .eq("uuid", id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});


// ✅ 刪除預約（根據 uuid）
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("預約志工")
    .delete()
    .eq("uuid", id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "預約已刪除" });
});


export default router;