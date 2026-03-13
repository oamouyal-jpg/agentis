import express from "express";
import questionsRoutes from "./modules/questions/questions.routes";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Agentis backend running");
});

app.use("/questions", questionsRoutes);

app.listen(4000, () => {
  console.log("Server running on port 4000");
});