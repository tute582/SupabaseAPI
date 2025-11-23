// index.js
import express from "express";
import cors from "cors";
import volunteersRouter from "./routes/volunteers.js";
import consultationsRouter from "./routes/consultations.js";
import identifyRouter from "./routes/identify.js";
import appointmentsRouter from "./routes/appointments.js";
import eldersRouter from "./routes/elders.js";
import schedulesRouter from "./routes/schedules.js";
import checkRemindersRouter from "./routes/check-reminders.js";
import bloodPressreRouter from "./routes/blood-pressre.js";
import getAdviceRouter from "./routes/getAdvice.js";
import matchRouter from "./routes/match.js";
import testRouter from "./routes/test.js";

const app = express();
app.use(cors());                // ✅ 允許跨域請求
app.use(express.json());

// 掛載「預約志工」路由
app.use("/appointments", appointmentsRouter);
// 掛載「看診資訊」路由
app.use("/consultations", consultationsRouter);
// 掛載「長者資訊」路由
app.use("/elders", eldersRouter);
// 掛載「身分辨別」路由
app.use("/identify", identifyRouter);
// 掛載「行事曆」路由
app.use("/schedules", schedulesRouter);
// 掛載「血壓紀錄」路由
app.use("/bloodPressre", bloodPressreRouter);
// 掛載「志工資訊」路由
app.use("/volunteers", volunteersRouter);
// 掛載「自動提醒」路由
app.use("/check-reminders", checkRemindersRouter);
// 掛載「AI建議」路由
app.use("/getAdvice", getAdviceRouter);
// 掛載「AI配對」路由
app.use("/match", matchRouter);
// 掛載「AI配對test」路由
app.use("/test", testRouter);

app.listen(3001, () => {
  console.log("Server running at http://localhost:3001");
});
