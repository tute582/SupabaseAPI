import express from "express";
import supabase from "../supabaseClient.js";
const router = express.Router();
const table = "看診資訊";

// 1. 取得全部看診資訊
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });

    if (error)
      return res.status(500).json({ success: false, message: error.message });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 2. 取得一位長者的所有看診資訊 (依elder_user_id)
router.get("/:elder_user_id", async (req, res) => {
  try {
    const { elder_user_id } = req.params;

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("elder_user_id", elder_user_id)
      .order("visit_time", { ascending: false });

    if (error)
      return res.status(500).json({ success: false, message: error.message });

    if (!data || data.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "找不到該長者的看診資料" });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 3. 取得一位長者的一筆看診資訊（依 elder_user_id,event_id）
router.get("/:elder_user_id/:event_id", async (req, res) => {
  try {
    const { elder_user_id, event_id } = req.params;

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("elder_user_id", elder_user_id)
      .eq("event_id", event_id)
      .maybeSingle();

    if (error)
      return res.status(500).json({ success: false, message: error.message });

    if (!data)
      return res
        .status(404)
        .json({ success: false, message: "找不到該看診事件資料" });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 4. 新增看診資訊
router.post("/", async (req, res) => {
  try {
    const newConsultation = req.body;
    const now = new Date();
    const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    newConsultation.created_at =
      taiwanTime.toISOString().replace("T", " ").substring(0, 19) + "+08";

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
      .insert([{ ...newConsultation, event_id: newEventId, updated_at: null }])
      .select()
      .maybeSingle();

    if (insertError) {
      return res
        .status(500)
        .json({ success: false, message: "新增資料時發生錯誤" });
    }

    res.status(201).json({
      success: true,
      data,
    });
  } catch {
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 5. 更新某位長者的某筆看診資訊
router.patch("/:elder_user_id/:event_id", async (req, res) => {
  try {
    const { elder_user_id, event_id } = req.params;
    const updates = { ...req.body, updated_at: new Date() };

    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq("elder_user_id", elder_user_id)
      .eq("event_id", event_id)
      .select();

    if (error)
      return res.status(500).json({ success: false, error: error.message });

    res.json({
      success: true,
      message: `已成功更新看診資訊`,
      data: data,
    });
  } catch {
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

// 6. 刪除某位長者的某筆看診資訊
router.delete("/:elder_user_id/:event_id", async (req, res) => {
  try {
    const { elder_user_id, event_id, elder_name, visit_time } = req.params;
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("elder_user_id", elder_user_id)
      .eq("event_id", event_id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: `已刪除長者=${elder_name}  ${visit_time}的看診資訊` });
  } catch {
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

export default router;
