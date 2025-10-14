import express from "express";
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const response = await fetch("https://supabase-api-six.vercel.app/schedules");
    const json = await response.json();

    if (!json.success) {
      return res.status(500).json({ error: "Failed to fetch schedule data" });
    }

    const schedules = json.data;
    const now = new Date();

    const toRemind = schedules.filter(item =>
      !item.is_reminded && new Date(item.schedule_time) <= now
    );

    if (toRemind.length === 0) {
      return res.status(200).json({ message: "No reminders to send." });
    }

    for (const item of toRemind) {
      // 發送 LINE 通知
      await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: item.elder_user_id,
          messages: [
            {
              type: "text",
              text: `🔔 行程提醒：\n${item.schedule_note}\n🕒 時間：${item.schedule_time}`,
            },
          ],
        }),
      });

      // 更新 is_reminded 狀態
      await fetch(`https://supabase-api-six.vercel.app/schedules/${item.uuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_reminded: true }),
      });
    }

    res.status(200).json({ success: true, remindedCount: toRemind.length });
  } catch (error) {
    console.error("❌ Error checking reminders:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
