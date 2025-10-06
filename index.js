// index.js
import express from "express";
import cors from "cors";
import volunteersRouter from "./routes/volunteers.js";
import consultationsRouter from "./routes/consultations.js";

app.use(cors());                // ✅ 允許跨域請求
const app = express();
app.use(express.json());

// 掛載「志工資訊」路由
app.use("/volunteers", volunteersRouter);
// 掛載「看診資訊」路由
app.use("/consultations", consultationsRouter);

app.listen(3001, () => {
  console.log("Server running at http://localhost:3001");
});
