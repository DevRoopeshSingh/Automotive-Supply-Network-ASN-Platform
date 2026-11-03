import { prisma } from "./index";

function normalizePartNumber(partNumber: string): string {
  return partNumber
    .trim()
    .toUpperCase()
    .replace(/[\s\-_.]/g, "");
}

async function main() {
  console.log("🌱 Seeding ASN Master Automotive Catalog & Fitment Database...");

  // 1. Vehicle Makes, Models & Variants
  const makesData = [
    {
      name: "Hyundai",
      segment: "CAR" as const,
      models: [
        {
          name: "Creta",
          variants: [
            {
              variantName: "1.5L CRDi Diesel SX",
              startYear: 2020,
              endYear: null,
              fuelType: "DIESEL",
              engine: "1.5L U2 CRDi",
              engineCapacity: 1493,
              transmission: "MANUAL",
            },
            {
              variantName: "1.5L MPi Petrol SX(O)",
              startYear: 2020,
              endYear: null,
              fuelType: "PETROL",
              engine: "1.5L Smartstream MPi",
              engineCapacity: 1497,
              transmission: "AUTOMATIC",
            },
          ],
        },
        {
          name: "i20",
          variants: [
            {
              variantName: "1.2L Kappa Petrol Asta",
              startYear: 2018,
              endYear: 2023,
              fuelType: "PETROL",
              engine: "1.2L Kappa Dual VTVT",
              engineCapacity: 1197,
              transmission: "MANUAL",
            },
          ],
        },
      ],
    },
    {
      name: "Maruti Suzuki",
      segment: "CAR" as const,
      models: [
        {
          name: "Swift",
          variants: [
            {
              variantName: "1.2L K12N DualJet Petrol ZXi",
              startYear: 2018,
              endYear: 2024,
              fuelType: "PETROL",
              engine: "1.2L K-Series DualJet",
              engineCapacity: 1197,
              transmission: "MANUAL",
            },
          ],
        },
        {
          name: "Brezza",
          variants: [
            {
              variantName: "1.5L K15B Smart Hybrid ZXi",
              startYear: 2020,
              endYear: null,
              fuelType: "PETROL",
              engine: "1.5L K15B",
              engineCapacity: 1462,
              transmission: "MANUAL",
            },
          ],
        },
      ],
    },
    {
      name: "Tata",
      segment: "CAR" as const,
      models: [
        {
          name: "Nexon",
          variants: [
            {
              variantName: "1.5L Revotorq Diesel XZ+",
              startYear: 2019,
              endYear: null,
              fuelType: "DIESEL",
              engine: "1.5L Turbocharged Revotorq",
              engineCapacity: 1497,
              transmission: "MANUAL",
            },
          ],
        },
      ],
    },
  ];

  const seededMakes: Record<string, string> = {};
  const seededVariants: Record<string, string> = {};

  for (const mData of makesData) {
    const make = await prisma.vehicleMake.upsert({
      where: { name: mData.name },
      update: { segment: mData.segment },
      create: { name: mData.name, segment: mData.segment },
    });
    seededMakes[mData.name] = make.id;

    for (const modelData of mData.models) {
      const model = await prisma.vehicleModel.upsert({
        where: {
          makeId_name: {
            makeId: make.id,
            name: modelData.name,
          },
        },
        update: {},
        create: {
          makeId: make.id,
          name: modelData.name,
        },
      });

      for (const vData of modelData.variants) {
        let variant = await prisma.vehicleVariant.findFirst({
          where: {
            modelId: model.id,
            variantName: vData.variantName,
            startYear: vData.startYear,
          },
        });

        if (!variant) {
          variant = await prisma.vehicleVariant.create({
            data: {
              modelId: model.id,
              variantName: vData.variantName,
              startYear: vData.startYear,
              endYear: vData.endYear,
              fuelType: vData.fuelType,
              engine: vData.engine,
              engineCapacity: vData.engineCapacity,
              transmission: vData.transmission,
            },
          });
        }
        seededVariants[`${mData.name}_${modelData.name}_${vData.variantName}`] =
          variant.id;
      }
    }
  }
  console.log(
    `✓ Seeded Vehicle Hierarchy: ${Object.keys(seededMakes).length} makes, ${Object.keys(seededVariants).length} variants.`,
  );

  // 2. Hierarchical Product Categories
  const categoryTree = [
    {
      name: "Brake System",
      slug: "brake-system",
      description: "Hydraulic and mechanical braking components",
      children: [
        {
          name: "Brake Pads",
          slug: "brake-pads",
          description: "Front & rear disc brake friction pads",
        },
        {
          name: "Brake Discs & Rotors",
          slug: "brake-discs-rotors",
          description: "Vented and solid brake discs",
        },
      ],
    },
    {
      name: "Filtration",
      slug: "filtration",
      description: "Engine intake, cabin air, fuel, and lubrication filters",
      children: [
        {
          name: "Oil Filters",
          slug: "oil-filters",
          description: "Spin-on and cartridge oil filters",
        },
        {
          name: "Air Filters",
          slug: "air-filters",
          description: "Engine air intake filter elements",
        },
      ],
    },
    {
      name: "Engine Parts",
      slug: "engine-parts",
      description: "Internal combustion engine components and accessories",
      children: [
        {
          name: "Spark Plugs",
          slug: "spark-plugs",
          description: "Iridium, platinum, and nickel spark plugs",
        },
      ],
    },
    {
      name: "Suspension & Steering",
      slug: "suspension-steering",
      description: "Shock absorbers, struts, steering tie rods, and bushings",
      children: [
        {
          name: "Shock Absorbers",
          slug: "shock-absorbers",
          description: "Gas-pressurized dampers and struts",
        },
      ],
    },
  ];

  const seededCategories: Record<string, string> = {};

  for (const rootCat of categoryTree) {
    const parent = await prisma.productCategory.upsert({
      where: { slug: rootCat.slug },
      update: { description: rootCat.description },
      create: {
        name: rootCat.name,
        slug: rootCat.slug,
        description: rootCat.description,
      },
    });
    seededCategories[rootCat.slug] = parent.id;

    if (rootCat.children) {
      for (const childCat of rootCat.children) {
        const child = await prisma.productCategory.upsert({
          where: { slug: childCat.slug },
          update: { description: childCat.description, parentId: parent.id },
          create: {
            name: childCat.name,
            slug: childCat.slug,
            description: childCat.description,
            parentId: parent.id,
          },
        });
        seededCategories[childCat.slug] = child.id;
      }
    }
  }
  console.log(
    `✓ Seeded ${Object.keys(seededCategories).length} Categories (with 2-tier parent-child hierarchy).`,
  );

  // 3. Automotive Brands
  const brands = [
    { name: "Bosch", code: "BOSCH", countryOfOrigin: "DE", isOem: false },
    { name: "Brembo", code: "BREMBO", countryOfOrigin: "IT", isOem: false },
    { name: "Mahle", code: "MAHLE", countryOfOrigin: "DE", isOem: true },
    { name: "Monroe", code: "MONROE", countryOfOrigin: "US", isOem: false },
    { name: "Valeo", code: "VALEO", countryOfOrigin: "FR", isOem: true },
    { name: "Denso", code: "DENSO", countryOfOrigin: "JP", isOem: true },
  ];

  const seededBrands: Record<string, string> = {};
  for (const b of brands) {
    const brand = await prisma.brand.upsert({
      where: { name: b.name },
      update: {
        code: b.code,
        countryOfOrigin: b.countryOfOrigin,
        isOem: b.isOem,
      },
      create: {
        name: b.name,
        code: b.code,
        countryOfOrigin: b.countryOfOrigin,
        isOem: b.isOem,
      },
    });
    seededBrands[b.code] = brand.id;
  }
  console.log(
    `✓ Seeded ${Object.keys(seededBrands).length} Automotive Brands.`,
  );

  // 4. Master Products with OEM References & Fitments
  const cretaDieselVariantId =
    seededVariants["Hyundai_Creta_1.5L CRDi Diesel SX"];
  const cretaPetrolVariantId =
    seededVariants["Hyundai_Creta_1.5L MPi Petrol SX(O)"];
  const swiftVariantId =
    seededVariants["Maruti Suzuki_Swift_1.2L K12N DualJet Petrol ZXi"];
  const brezzaVariantId =
    seededVariants["Maruti Suzuki_Brezza_1.5L K15B Smart Hybrid ZXi"];
  const hyundaiMakeId = seededMakes["Hyundai"];
  const marutiMakeId = seededMakes["Maruti Suzuki"];

  // Product 1: Bosch Front Brake Pad Set
  const boschBrakePads = await prisma.masterProduct.upsert({
    where: {
      partNumber_brandId: {
        partNumber: "0 986 AB1 234",
        brandId: seededBrands["BOSCH"]!,
      },
    },
    update: {},
    create: {
      partNumber: "0 986 AB1 234",
      normalizedPartNumber: normalizePartNumber("0 986 AB1 234"),
      oemNumber: "58101-1RA00",
      normalizedOemNumber: normalizePartNumber("58101-1RA00"),
      brandId: seededBrands["BOSCH"]!,
      categoryId: seededCategories["brake-pads"]!,
      name: "Bosch Premium Front Ceramic Brake Pad Set",
      description:
        "Low-dust, noise-free ceramic friction brake pad set designed for high durability.",
      conditionType: "AFTERMARKET",
      status: "ACTIVE",
      isSafetyCritical: true,
      unitOfMeasure: "SET",
      specifications: {
        frictionMaterial: "Ceramic",
        axlePosition: "Front",
        thicknessMm: 17.5,
        widthMm: 132.8,
        heightMm: 58.2,
      },
      oemReferences: {
        create: [
          {
            oemNumber: "58101-1RA00",
            normalizedOemNumber: normalizePartNumber("58101-1RA00"),
            vehicleMakeId: hyundaiMakeId,
            notes: "Factory fitment for Creta & Verna front disc",
          },
        ],
      },
      media: {
        create: [
          {
            url: "https://assets.asn-platform.internal/products/bosch-0986ab1234-front.jpg",
            mediaType: "IMAGE",
            altText: "Bosch 0 986 AB1 234 Front Ceramic Brake Pads",
            isPrimary: true,
            displayOrder: 0,
          },
        ],
      },
    },
  });

  if (cretaDieselVariantId) {
    await prisma.productFitment.upsert({
      where: {
        masterProductId_vehicleVariantId: {
          masterProductId: boschBrakePads.id,
          vehicleVariantId: cretaDieselVariantId,
        },
      },
      update: {},
      create: {
        masterProductId: boschBrakePads.id,
        vehicleVariantId: cretaDieselVariantId,
        position: "Front Axle",
        fitmentStartYear: 2020,
        isVerified: true,
        notes: "Direct OEM replacement for 1.5L Diesel SX",
      },
    });
  }

  if (cretaPetrolVariantId) {
    await prisma.productFitment.upsert({
      where: {
        masterProductId_vehicleVariantId: {
          masterProductId: boschBrakePads.id,
          vehicleVariantId: cretaPetrolVariantId,
        },
      },
      update: {},
      create: {
        masterProductId: boschBrakePads.id,
        vehicleVariantId: cretaPetrolVariantId,
        position: "Front Axle",
        fitmentStartYear: 2020,
        isVerified: true,
      },
    });
  }

  // Product 2: Mahle Spin-On Oil Filter
  const mahleFilter = await prisma.masterProduct.upsert({
    where: {
      partNumber_brandId: {
        partNumber: "OC 501",
        brandId: seededBrands["MAHLE"]!,
      },
    },
    update: {},
    create: {
      partNumber: "OC 501",
      normalizedPartNumber: normalizePartNumber("OC 501"),
      oemNumber: "26300-35505",
      normalizedOemNumber: normalizePartNumber("26300-35505"),
      brandId: seededBrands["MAHLE"]!,
      categoryId: seededCategories["oil-filters"]!,
      name: "Mahle Original Spin-On Oil Filter OC 501",
      description:
        "High-capacity cellulose filter element with silicone anti-drainback valve.",
      conditionType: "OES",
      status: "ACTIVE",
      isSafetyCritical: false,
      specifications: {
        threadSize: "M20x1.5",
        outerDiameterMm: 80,
        heightMm: 75,
      },
      oemReferences: {
        create: [
          {
            oemNumber: "26300-35505",
            normalizedOemNumber: normalizePartNumber("26300-35505"),
            vehicleMakeId: hyundaiMakeId,
            notes: "OEM Hyundai/Kia filter spec",
          },
        ],
      },
      media: {
        create: [
          {
            url: "https://assets.asn-platform.internal/products/mahle-oc501.jpg",
            mediaType: "IMAGE",
            altText: "Mahle Spin-On Oil Filter OC 501",
            isPrimary: true,
            displayOrder: 0,
          },
        ],
      },
    },
  });

  if (cretaDieselVariantId) {
    await prisma.productFitment.upsert({
      where: {
        masterProductId_vehicleVariantId: {
          masterProductId: mahleFilter.id,
          vehicleVariantId: cretaDieselVariantId,
        },
      },
      update: {},
      create: {
        masterProductId: mahleFilter.id,
        vehicleVariantId: cretaDieselVariantId,
        position: "Engine Compartment",
        fitmentStartYear: 2020,
        isVerified: true,
      },
    });
  }

  // Product 3: Bosch Nickel Spark Plug
  const boschSparkPlug = await prisma.masterProduct.upsert({
    where: {
      partNumber_brandId: {
        partNumber: "FR 7 DC+",
        brandId: seededBrands["BOSCH"]!,
      },
    },
    update: {},
    create: {
      partNumber: "FR 7 DC+",
      normalizedPartNumber: normalizePartNumber("FR 7 DC+"),
      oemNumber: "09482-00550",
      normalizedOemNumber: normalizePartNumber("09482-00550"),
      brandId: seededBrands["BOSCH"]!,
      categoryId: seededCategories["spark-plugs"]!,
      name: "Bosch Super Plus Nickel Spark Plug FR 7 DC+",
      description:
        "Yttrium-enhanced copper core nickel ground electrode spark plug.",
      conditionType: "AFTERMARKET",
      status: "ACTIVE",
      specifications: {
        threadSize: "M14x1.25",
        hexSizeMm: 16,
        gapMm: 0.9,
      },
      oemReferences: {
        create: [
          {
            oemNumber: "09482-00550",
            normalizedOemNumber: normalizePartNumber("09482-00550"),
            vehicleMakeId: marutiMakeId,
            notes: "Maruti Suzuki K-Series OEM spark plug standard",
          },
        ],
      },
    },
  });

  if (swiftVariantId) {
    await prisma.productFitment.upsert({
      where: {
        masterProductId_vehicleVariantId: {
          masterProductId: boschSparkPlug.id,
          vehicleVariantId: swiftVariantId,
        },
      },
      update: {},
      create: {
        masterProductId: boschSparkPlug.id,
        vehicleVariantId: swiftVariantId,
        position: "Cylinder Head",
        fitmentStartYear: 2018,
        fitmentEndYear: 2024,
        isVerified: true,
      },
    });
  }

  if (brezzaVariantId) {
    await prisma.productFitment.upsert({
      where: {
        masterProductId_vehicleVariantId: {
          masterProductId: boschSparkPlug.id,
          vehicleVariantId: brezzaVariantId,
        },
      },
      update: {},
      create: {
        masterProductId: boschSparkPlug.id,
        vehicleVariantId: brezzaVariantId,
        position: "Cylinder Head",
        fitmentStartYear: 2020,
        isVerified: true,
      },
    });
  }

  console.log(
    "✓ Seeded Master Products with OEM Cross-References, Media, and Vehicle Fitments.",
  );
  console.log("✅ Catalog Seeding Completed Successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
