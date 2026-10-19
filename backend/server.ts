import "dotenv/config";
import app from "./app";
import { prisma } from "./config/prisma";

const port = Number(process.env.PORT ?? 5000);

async function startServer() {
  try {
    await prisma.$connect();

    app.listen(port, () => {
      console.log(`API: http://localhost:${port}`);
      console.log(`Health: http://localhost:${port}/api/health`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

void startServer();
