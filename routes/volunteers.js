import express from "express";
import supabase from '../supabaseClient.js';
const router = express.Router();

// 1. 取得全部志工資訊
router.get('/', async (req, res) => {
  try{
    const { data, error } = await supabase
      .from('志工資訊')
      .select('*');

    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 2. 取得單一志工資訊 (依 volunteer_user_id )
router.get('/:volunteer_user_id', async (req, res) => {
  try{
    const { volunteer_user_id } = req.params;
    const { data, error } = await supabase
      .from('志工資訊')
      .select('*')
      .eq('volunteer_user_id', volunteer_user_id)
      .single();
  
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 3. 新增志工資訊
router.post('/', async (req, res) => {
  try{
    const newVolunteer = req.body;
    const { data, error } = await supabase
      .from('志工資訊')
      .insert([newVolunteer]);
  
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.status(201).json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 4. 更新志工資訊
router.patch('/:volunteer_user_id', async (req, res) => {
  try{
    const { volunteer_user_id } = req.params;
    const updates = req.body;
    updates.updated_at = new Date(); // 更新時間
  
    const { data, error } = await supabase
      .from('志工資訊')
      .update(updates)
      .eq('volunteer_user_id', volunteer_user_id);
  
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// 5. 刪除志工資訊
router.delete('/:volunteer_user_id', async (req, res) => {
  try{
    const { volunteer_user_id } = req.params;
    const { data, error } = await supabase
      .from('志工資訊')
      .delete()
      .eq('volunteer_user_id', volunteer_user_id);
  
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ message: '志工資訊已刪除', data });
  }
  catch{
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});


export default router;
