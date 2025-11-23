import express from "express";
import supabase from "../supabaseClient.js";

const router = express.Router();

// AI配對
router.post('/', async (req, res) => {
    try {
        // 1️⃣ 前端傳遞的資料
        const { elder_user_id, date, time, department, city } = req.body;

        if (!elder_user_id) {
        return res.status(400).json({ success: false, message: "缺少 elder_user_id" });
        }

        // 2️⃣ 查詢長者資訊
        const { data: elder, error: elderError } = await supabase
        .from("長者資訊")
        .select("*")
        .eq("elder_user_id", elder_user_id)
        .maybeSingle();

        if (elderError) throw elderError;
        if (!elder) {
        return res.status(404).json({ success: false, message: "找不到該長者" });
        }

        const elderGender = elder.gender;

        // 3️⃣ 查詢志工資料
        const { data: volunteers, error: volunteerError } = await supabase
         .from("志工資訊")
         .select("volunteer_user_id, volunteer_name, gender, available_times");
 
         if (volunteerError) {
           console.error("志工資料查詢錯誤:", volunteerError);
           return;
          }



        // function isTimeOverlap(VTime, ETime) {
        //  const VStart = new Date(VTime.start).getTime();
        //  const VEnd = new Date(VTime.end).getTime();
        //  const ETime = new Date(ETime).getTime();
         

        //  return VStart <=ETime  && ETime <= VEnd; // 判斷兩個時間段是否有重疊
        // }
        // 時間重疊函式(長者單一時間，志工為多個時間-字串陣列)
        function isTimeOverlap(volunteerTimes, elderTime) {
          const ETime = new Date(elderTime).getTime();

          return volunteerTimes.some((timeRange) => {
            // timeRange: "2025-11-14 08:00-12:00"
            const [datePart, hoursPart] = timeRange.split(" "); // ["2025-11-14", "08:00-12:00"]
            const [startHour, endHour] = hoursPart.split("-");  // ["08:00", "12:00"]

            const start = new Date(`${datePart}T${startHour}:00`).getTime();
            const end = new Date(`${datePart}T${endHour}:00`).getTime();

            return start <= ETime && ETime <= end;
            });
        }


        // 4️⃣ AI配對 回傳符合資格的名單
        const matchedVolunteers = volunteers.filter(v => {
            return (
                v.gender === elderGender    // ⭐ 重點：依長者性別比對
                &&
                 isTimeOverlap(v.available_times, time) // 任一時間段重疊即可     
            );
        });

        // 5️⃣ 只取出 volunteer_user_id
        const volunteer_user_ids = matchedVolunteers.map(v => v.volunteer_user_id);

        // 6️⃣ 回傳結果
        return res.status(200).json({
            success: true,
            volunteer_user_ids
        });

    } catch (err) {
        console.error("AI 配對錯誤：", err);
        return res.status(500).json({
        success: false,
        message: "伺服器錯誤"
        });
    }
});

export default router;


