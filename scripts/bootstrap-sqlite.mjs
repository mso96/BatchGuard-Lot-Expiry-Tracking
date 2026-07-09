import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

const migrations = [
  "20260709140000_init_batchguard/migration.sql",
  "20260709173000_add_untracked_stock_sales/migration.sql",
];

function splitSql(sql) {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function isAlreadyAppliedError(error) {
  const message = `${error?.message ?? ""}`.toLowerCase();
  return (
    message.includes("already exists") ||
    message.includes("duplicate column name") ||
    message.includes("index") && message.includes("already exists")
  );
}

try {
  for (const migration of migrations) {
    const filePath = path.join(process.cwd(), "prisma", "migrations", migration);
    const sql = await readFile(filePath, "utf8");

    for (const statement of splitSql(sql)) {
      try {
        await prisma.$executeRawUnsafe(statement);
      } catch (error) {
        if (!isAlreadyAppliedError(error)) {
          throw error;
        }
      }
    }
  }
} finally {
  await prisma.$disconnect();
}
