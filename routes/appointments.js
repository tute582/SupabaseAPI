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
  
    if (error) return res.status(404).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 5. 取得志工的某位長者所有預約資料（根據 volunteer_user_id/elder_user_id）
router.get("/volunteer/:volunteer_user_id/:elder_user_id", async (req, res) => {
  try{
    const { volunteer_user_id,elder_user_id} = req.params;

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("volunteer_user_id",volunteer_user_id)
      .eq("elder_user_id", elder_user_id)
  
    if (error) return res.status(404).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 6. 取得志工的某位長者單筆預約資料（根據 volunteer_user_id/elder_user_id、event_id）
router.get("/volunteer/:volunteer_user_id/:elder_user_id/:event_id", async (req, res) => {
  try{
    const { volunteer_user_id,elder_user_id ,event_id} = req.params;

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("volunteer_user_id",volunteer_user_id)
      .eq("elder_user_id", elder_user_id)
      .eq("event_id",event_id)
  
    if (error) return res.status(404).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 7. 取得志工對應的長者姓名（根據 volunteer_user_id)
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

// 8. 建立新預約
router.post("/", async (req, res) => {
  try {
    const newConsultation = req.body;
    //存取建立血壓時間
    const now = new Date();
    const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    newConsultation.created_at = taiwanTime
      .toISOString()
      .replace("T", " ")
      .substring(0, 19)+ "+08"

    if (!newConsultation.elder_user_id) {
        return res.status(400).json({ success: false, message: "缺少長者ID" });
    }

    // 查詢該長者最後一筆
    const { data: lastRecord, error: fetchError } = await supabase
        .from(table)
        .select("event_id")
        .eq("elder_user_id", newConsultation.elder_user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (fetchError) {
        return res.status(500).json({ success: false, message: "查詢失敗" });
    }

    // 自動產生新的 event_id
    let newEventId = "Event1";
    if (lastRecord?.event_id) {
        const lastNum = parseInt(lastRecord.event_id.replace("Event", ""), 10);
        newEventId = `Event${lastNum + 1}`;
    }

    // 新增資料（直接使用 req.body）
    const { data, error: insertError } = await supabase
      .from(table)
      .insert([{ ...newConsultation, event_id: newEventId, updated_at: null }]) // 🔹 用展開運算子加上 event_id
      .select()
      .maybeSingle();

    if (insertError) {
      console.error("Supabase Insert Error:", insertError);
      return res.status(500).json({ 
          success: false, 
          message: "新增資料時發生錯誤", 
          error: insertError 
      });
    }
      
    res.status(201).json({
        success: true,
        data,
    });
  } 
  catch {
  res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 9. 更新預約
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


// 10. 刪除預約
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