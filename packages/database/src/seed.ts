import { prisma } from "./index";

async function main() {
  console.log("🌱 Seeding ASN foundational data...");

  // 1. Core Vehicle Makes
  const hyundai = await prisma.vehicleMake.upsert({
    where: { name: "Hyundai" },
    update: {},
    create: {
      name: "Hyundai",
      segment: "CAR",
      models: {
        create: [
          {
            name: "Creta",
            variants: {
              create: [
                {
                  variantName: "1.5L CRDi Diesel SX",
                  startYear: 2020,
                  fuelType: "DIESEL",
                  transmission: "MANUAL",
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log(`✓ Vehicle Make Seeded: ${hyundai.name}`);

  // 2. Core Categories
  const categories = [
    "Braking",
    "Filtration",
    "Lubricants & Fluids",
    "Ignition",
    "Belts & Chains",
    "Suspension",
  ];
  for (const cat of categories) {
    await prisma.productCategory.upsert({
      where: { name: cat },
      update: {},
      create: {
        name: cat,
        slug: cat.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      },
    });
  }

  console.log(`✓ Seeded ${categories.length} product categories.`);
  console.log("✅ Seeding completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
