import express from "express";
import supabase from "../supabaseClient.js";
const router = express.Router();
const table = "行事曆";

// 1. 取得所有行事曆
router.get("/", async (req, res) => {
  try{
    const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("schedule_time", { ascending: true });

    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 2. 取得特定長者的所有行事曆
router.get("/elder/:elder_user_id", async (req, res) => {
  try{
    const { elder_user_id } = req.params;

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("elder_user_id", elder_user_id)
      .order("schedule_time", { ascending: true });
  
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 3. 取得特定長者的某案件行事曆
router.get("/elder/:elder_user_id/:event_id", async (req, res) => {
  try{
    const { elder_user_id, event_id } = req.params;

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("elder_user_id", elder_user_id)
      .eq("event_id", event_id)
      .maybeSingle();
  
    if (error || !data)
      return res.status(404).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 4. 新增行事曆
router.post("/", async (req, res) => {
    try {
        const newConsultation = req.body;
        //預設是否提醒 為"False"
        newConsultation.is_reminded = "false"
        //存取建立行程時間
        newConsultation.created_at = new Date().toLocaleString("zh-TW", { hour12: false }).replace(/\//g, "-");
        //更新時間為null
        newConsultation.updated_at = null;

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
            .insert([{ ...newConsultation, event_id: newEventId }]) // 🔹 用展開運算子加上 event_id
            .select()
            .maybeSingle();

        if (insertError) {
            return res.status(500).json({ success: false, message: "新增資料時發生錯誤" });
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

// 5. 更新行事曆
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
      .maybeSingle();
  
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 6. 刪除行事曆
router.delete("/elder/:elder_user_id/:event_id", async (req, res) => {
  try{
    const { elder_user_id,event_id } = req.params;

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("elder_user_id", elder_user_id)
      .eq("event_id",event_id);
  
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ message: "行事曆項目已刪除" });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

export default router;
