import { isInSingapore } from '../src/lib/geofence.js';
import prisma from '../src/db/index.js';

async function main() {
  const rows = await prisma.carpark.findMany({ select: { id: true, lat: true, lng: true } });
  const outside = rows.filter(r => !isInSingapore(r.lat, r.lng));
  console.log(`Total: ${rows.length} | Outside: ${outside.length}`);

  if (outside.length) {
    const ids = outside.map(r => r.id);
    await prisma.rate.deleteMany({ where: { carparkId: { in: ids } } });
    await prisma.availability.deleteMany({ where: { carparkId: { in: ids } } });
    await prisma.carpark.deleteMany({ where: { id: { in: ids } } });
    console.log(`Deleted ${outside.length} carparks`);
  }

  console.log(`Remaining: ${await prisma.carpark.count()}`);
  await prisma.$disconnect();
}

main();
