import express from "express";
import supabase from '../supabaseClient.js';
const router = express.Router();

// 取得全部志工資訊
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('志工資訊')
    .select('*');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 依 V_LineID 取得單一志工資訊
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('志工資訊')
    .select('*')
    .eq('V_LineID', id)
    .single();

  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

// 新增志工資訊
router.post('/', async (req, res) => {
  const newVolunteer = req.body;
  const { data, error } = await supabase
    .from('志工資訊')
    .insert([newVolunteer]);

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// 更新志工資訊
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  updates.updated_at = new Date(); // 更新時間

  const { data, error } = await supabase
    .from('志工資訊')
    .update(updates)
    .eq('V_LineID', id);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 刪除志工資訊
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('志工資訊')
    .delete()
    .eq('V_LineID', id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: '志工資訊已刪除', data });
});


export default router;
