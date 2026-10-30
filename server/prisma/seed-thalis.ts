/** Loads the app's bundled one-tap thalis into the catalog (skipped once any exist). `npx tsx prisma/seed-thalis.ts` */
import { PrismaClient } from '@prisma/client';

import { strictestDiet } from '@shared/thali';
import { THALIS } from '@/data/thalis';

export async function seedThalis(db: PrismaClient) {
  if ((await db.thali.count()) > 0) return;
  const foods = new Map((await db.food.findMany({ select: { id: true, diet: true } })).map((f) => [f.id, f.diet]));
  await db.thali.createMany({
    data: THALIS.map((t, i) => {
      const items = Object.entries(t.items).filter(([id]) => foods.has(id)).map(([foodId, qty]) => ({ foodId, qty }));
      return { id: t.id, emoji: t.e, nameEn: t.n.en, nameHi: t.n.hi, slots: t.slots, items, diet: strictestDiet(items.map((x) => foods.get(x.foodId)!)), sort: i };
    }),
  });
  console.log(`Thalis: ${THALIS.length}`);
}

if (require.main === module) {
  const db = new PrismaClient();
  seedThalis(db)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
