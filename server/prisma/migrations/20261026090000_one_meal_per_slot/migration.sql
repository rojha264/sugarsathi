-- Breakfast, lunch and dinner are once a day. Older app versions could save several;
-- keep the latest saved one per patient, slot and India day, and mark the rest deleted.
WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "patientId", "slot", (("at" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date
           ORDER BY "updatedAt" DESC, "id" DESC
         ) AS rn
  FROM "Meal"
  WHERE "deletedAt" IS NULL AND "slot" IN ('breakfast', 'lunch', 'dinner')
)
UPDATE "Meal" m SET "deletedAt" = NOW()
FROM ranked r
WHERE m."id" = r."id" AND r.rn > 1;
