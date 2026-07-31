/*
  Warnings:

  - Added the required column `mensagem` to the `follow_up_schedules` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "follow_up_schedules" ADD COLUMN     "mensagem" TEXT NOT NULL;
