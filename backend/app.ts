import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./modules/auth/auth.routes";
import { errorHandler } from "./middleware/error.middleware";
import profileRoutes from "./modules/profiles/profile.routes";
import jobRoutes from "./modules/jobs/job.routes";
import applicationRoutes from "./modules/applications/application.routes";
import projectRoutes from "./modules/projects/project.routes";
import adminRoutes from "./modules/admin/admin.routes";

const app = express();

app.disable("x-powered-by");
app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "KajPabo AI API is running",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/profiles", profileRoutes);
app.use("/api/v1/jobs", jobRoutes);
app.use("/api/v1/applications", applicationRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/admin", adminRoutes);

// Register profile, jobs, applications, projects and admin
// routers here as each module is implemented.

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use(errorHandler);

export default app;
