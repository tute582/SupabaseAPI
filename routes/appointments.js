import express from "express";
import supabase from '../supabaseClient.js';
const router = express.Router();
const table = "預約志工";

// 1. 取得所有預約資料
router.get("/", async (req, res) => {
  try{
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});


// 2. 取得長者的所有預約（根據 elder_user_id）
router.get("/elder/:elder_user_id", async (req, res) => {
  try{
    const { elder_user_id } = req.params;

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("elder_user_id", elder_user_id)
      .single();
  
    if (error) return res.status(404).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 3. 取得長者的單筆預約（根據 elder_user_id、event_id）
router.get("/elder/:elder_user_id/:event_id", async (req, res) => {
  try{
    const { elder_user_id ,event_id} = req.params;

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("elder_user_id", elder_user_id)
      .eq("event_id",event_id)
      .single();
  
    if (error) return res.status(404).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 4. 取得志工的所有長者預約資料（根據 volunteer_user_id)
router.get("/volunteer/:volunteer_user_id", async (req, res) => {
  try{
    const { volunteer_user_id } = req.params;

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("volunteer_user_id", volunteer_user_id)
      .single();
  
    if (error) return res.status(404).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 5. 取得志工的某位長者單筆預約資料（根據 volunteer_user_id/elder_user_id、event_id）
router.get("/volunteer/:volunteer_user_id/:elder_user_id/:event_id", async (req, res) => {
  try{
    const { volunteer_user_id,elder_user_id ,event_id} = req.params;

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("volunteer_user_id",volunteer_user_id)
      .eq("elder_user_id", elder_user_id)
      .eq("event_id",event_id)
      .single();
  
    if (error) return res.status(404).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 6. 取得志工對應的長者姓名（根據 volunteer_user_id)
router.get("/by-volunteer/:volunteer_user_id", async (req, res) => {
  try{
    const { volunteer_user_id } = req.params;

    const { data, error } = await supabase
      .from(table)
      .select("elder_name") // 只取 elder_user_id 欄位
      .eq("volunteer_user_id", volunteer_user_id)
  
    if (error || !data) {
      return res.status(404).json({ success: false, message: error.message });
    }
  
    // 去除重複長者名稱
    const uniqueNames = [...new Set(data.map(d => d.elder_name))];
  
    res.json({
      success: true,
      elder_name: uniqueNames ,
    });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 7. 建立新預約
router.post("/", async (req, res) => {
  try{
    const newAppointment = req.body;

    const { data, error } = await supabase
      .from(table)
      .insert([newAppointment])
      .select()
      .single();
  
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.status(201).json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 8. 更新預約
router.patch("/elder/:elder_user_id/:event_id", async (req, res) => {
  try{
    const { elder_user_id,event_id } = req.params;
    const updates = req.body;
  
    const { data, error } = await supabase
      .from(table)
      .update({ ...updates, updated_at: new Date() })
      .eq("elder_user_id", elder_user_id)
      .eq("event_id",event_id)
      .select()
      .single();
  
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});


// 9. 刪除預約
router.delete("/elder/:elder_user_id/:event_id", async (req, res) => {
  try{
    const { elder_user_id,event_id } = req.params;

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("elder_user_id", elder_user_id)
      .eq("event_id",event_id)
  
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true,message: "預約已刪除" });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});


export default router;