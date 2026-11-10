-- Finer food category for staff search and filters (fruit, smoothie, juice, dal, ...).
ALTER TABLE "Food" ADD COLUMN "category" TEXT NOT NULL DEFAULT '';
CREATE INDEX "Food_category_idx" ON "Food"("category");
