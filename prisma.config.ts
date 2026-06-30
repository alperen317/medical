import * as dotenv from "dotenv"
import { defineConfig } from "prisma/config"

// Prisma CLI'ı için .env.local yükle (Next.js sadece runtime'da yükler)
dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
})
