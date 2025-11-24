import express from "express";
import supabase from "../supabaseClient.js";

const router = express.Router();

// 計算距離 (Haversine)
function getDistanceFromLatLng(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = x => (x * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

router.post('/', async (req, res) => {
    try {
        const { elder_user_id, date, time } = req.body;  

        if (!elder_user_id) {
            return res.status(400).json({ success: false, message: "缺少 elder_user_id" });
        }

        const elderDateTime = new Date(`${date}T${time}:00`).getTime();

        // 查詢長者資料
        const { data: elder, error: elderError } = await supabase
            .from("長者資訊")
            .select("*")
            .eq("elder_user_id", elder_user_id)
            .maybeSingle();

        if (elderError) throw elderError;
        if (!elder) return res.status(404).json({ success: false, message: "找不到該長者" });

        const elderGender = elder.gender;
        const elderLat = elder.location?.lat;
        const elderLng = elder.location?.lng;

        if (!elderLat || !elderLng) {
            return res.status(400).json({ success: false, message: "長者未設定經緯度" });
        }

        // 查詢志工
        const { data: volunteers, error: volunteerError } = await supabase
            .from("志工資訊")
            .select("volunteer_user_id, volunteer_name, gender, available_times, location");

        if (volunteerError) throw volunteerError;

        // 時間判斷（加強版：避免 times = null）
        function isTimeOverlap(volunteerTimes, elderDateTime) {
            if (!Array.isArray(volunteerTimes)) return false;

            return volunteerTimes.some((timeRange) => {
                const [datePart, hoursPart] = timeRange.split(" ");
                const [startHour, endHour] = hoursPart.split("-");

                const start = new Date(`${datePart}T${startHour}:00`).getTime();
                const end = new Date(`${datePart}T${endHour}:00`).getTime();

                return start <= elderDateTime && elderDateTime <= end;
            });
        }

        // 性別 + 時間重疊，計算距離   (return Vid+距離)
        const matchedVolunteers = volunteers
            .map(v => {
                const vLat = v.location?.lat;
                const vLng = v.location?.lng;

                const distance =
                    (elderLat && elderLng && vLat && vLng)
                        ? getDistanceFromLatLng(elderLat, elderLng, vLat, vLng)
                        : null;

                return { ...v, distance };
            })
            .filter(v =>
                v.gender === elderGender &&
                isTimeOverlap(v.available_times, elderDateTime)
            );

        const result = matchedVolunteers.map(v => ({
            volunteer_user_id: v.volunteer_user_id,
            distance: v.distance
        }));

        return res.status(200).json({
            success: true,
            volunteers: result
        });

    } catch (err) {
        console.error("AI 配對錯誤：", err);
        return res.status(500).json({ success: false, message: "伺服器錯誤" });
    }
});

export default router;
