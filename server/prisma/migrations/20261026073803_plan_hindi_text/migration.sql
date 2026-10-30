-- AlterTable
ALTER TABLE "DietPlan" ADD COLUMN     "notesHi" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "titleHi" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "DietTemplate" ADD COLUMN     "notesHi" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "titleHi" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ExercisePlan" ADD COLUMN     "notesHi" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "titleHi" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ProgramTemplate" ADD COLUMN     "notesHi" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "titleHi" TEXT NOT NULL DEFAULT '';
