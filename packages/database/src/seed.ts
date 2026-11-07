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

  // ===========================================================================
  // 4. Sample Test Users & Business Accounts (For QA & E2E Testing)
  // ===========================================================================
  console.log("🌱 Seeding Development & QA Test Users & Businesses...");

  // 4.1 System Administrator
  await prisma.user.upsert({
    where: { phone: "9999999999" },
    update: { isSuperAdmin: true, isActive: true },
    create: {
      phone: "9999999999",
      email: "admin@asn-platform.internal",
      firstName: "System",
      lastName: "Administrator",
      isSuperAdmin: true,
      isActive: true,
    },
  });

  // 4.2 Sample Buyer User & Workshop Business
  const buyerUser = await prisma.user.upsert({
    where: { phone: "9876543210" },
    update: { isActive: true },
    create: {
      phone: "9876543210",
      email: "buyer@apexautocare.in",
      firstName: "Vikram",
      lastName: "Sharma",
      isSuperAdmin: false,
      isActive: true,
    },
  });

  const buyerBusiness = await prisma.business.upsert({
    where: { gstNumber: "27AAPCA1234F1Z5" },
    update: { verificationStatus: "VERIFIED", isActive: true },
    create: {
      legalName: "Apex Auto Care & Garages Pvt Ltd",
      tradeName: "Apex Multi-Brand Workshop",
      businessType: "WORKSHOP",
      gstNumber: "27AAPCA1234F1Z5",
      panNumber: "AAPCA1234F",
      verificationStatus: "VERIFIED",
      isActive: true,
    },
  });

  await prisma.businessMember.upsert({
    where: {
      userId_businessId: {
        userId: buyerUser.id,
        businessId: buyerBusiness.id,
      },
    },
    update: { role: "BUSINESS_OWNER", isPrimary: true },
    create: {
      userId: buyerUser.id,
      businessId: buyerBusiness.id,
      role: "BUSINESS_OWNER",
      isPrimary: true,
    },
  });

  // 4.3 Sample Supplier 1 (Distributor)
  const supplier1User = await prisma.user.upsert({
    where: { phone: "9876543211" },
    update: { isActive: true },
    create: {
      phone: "9876543211",
      email: "supplier1@superspares.in",
      firstName: "Ramesh",
      lastName: "Patel",
      isSuperAdmin: false,
      isActive: true,
    },
  });

  const supplier1Business = await prisma.business.upsert({
    where: { gstNumber: "07AABCS5678D1Z2" },
    update: { verificationStatus: "VERIFIED", isActive: true },
    create: {
      legalName: "SuperSpares Logistics & Distribution LLP",
      tradeName: "SuperSpares Distribution",
      businessType: "DISTRIBUTOR",
      gstNumber: "07AABCS5678D1Z2",
      panNumber: "AABCS5678D",
      verificationStatus: "VERIFIED",
      isActive: true,
    },
  });

  await prisma.businessMember.upsert({
    where: {
      userId_businessId: {
        userId: supplier1User.id,
        businessId: supplier1Business.id,
      },
    },
    update: { role: "BUSINESS_OWNER", isPrimary: true },
    create: {
      userId: supplier1User.id,
      businessId: supplier1Business.id,
      role: "BUSINESS_OWNER",
      isPrimary: true,
    },
  });

  // 4.4 Sample Supplier 2 (Wholesaler / Competitor)
  const supplier2User = await prisma.user.upsert({
    where: { phone: "9876543212" },
    update: { isActive: true },
    create: {
      phone: "9876543212",
      email: "supplier2@nationalparts.in",
      firstName: "Amit",
      lastName: "Mehta",
      isSuperAdmin: false,
      isActive: true,
    },
  });

  const supplier2Business = await prisma.business.upsert({
    where: { gstNumber: "27AABCN9988M1Z9" },
    update: { verificationStatus: "VERIFIED", isActive: true },
    create: {
      legalName: "National Auto Components Pvt Ltd",
      tradeName: "National Parts Wholesalers",
      businessType: "WHOLESALER",
      gstNumber: "27AABCN9988M1Z9",
      panNumber: "AABCN9988M",
      verificationStatus: "VERIFIED",
      isActive: true,
    },
  });

  await prisma.businessMember.upsert({
    where: {
      userId_businessId: {
        userId: supplier2User.id,
        businessId: supplier2Business.id,
      },
    },
    update: { role: "BUSINESS_OWNER", isPrimary: true },
    create: {
      userId: supplier2User.id,
      businessId: supplier2Business.id,
      role: "BUSINESS_OWNER",
      isPrimary: true,
    },
  });

  // 4.5 Sample Logistics Partner
  const logisticsUser = await prisma.user.upsert({
    where: { phone: "9876543213" },
    update: { isActive: true },
    create: {
      phone: "9876543213",
      email: "logistics@delhivery.example.com",
      firstName: "Rajesh",
      lastName: "Sharma",
      isSuperAdmin: false,
      isActive: true,
    },
  });

  const logisticsBusiness = await prisma.business.upsert({
    where: { gstNumber: "27AABCD4321L1Z0" },
    update: { verificationStatus: "VERIFIED", isActive: true },
    create: {
      legalName: "Delhivery Express Freight Ltd",
      tradeName: "Delhivery Surface Operations",
      businessType: "LOGISTICS_PARTNER",
      gstNumber: "27AABCD4321L1Z0",
      panNumber: "AABCD4321L",
      verificationStatus: "VERIFIED",
      isActive: true,
    },
  });

  await prisma.businessMember.upsert({
    where: {
      userId_businessId: {
        userId: logisticsUser.id,
        businessId: logisticsBusiness.id,
      },
    },
    update: { role: "BUSINESS_OWNER", isPrimary: true },
    create: {
      userId: logisticsUser.id,
      businessId: logisticsBusiness.id,
      role: "BUSINESS_OWNER",
      isPrimary: true,
    },
  });

  // 4.6 Logistics Provider Entity
  const logisticsProvider = await prisma.logisticsProvider.upsert({
    where: { providerCode: "DELHIVERY_AUTO" },
    update: { isActive: true },
    create: {
      name: "Delhivery Automotive Surface",
      providerCode: "DELHIVERY_AUTO",
      providerType: "THIRD_PARTY_3PL",
      contactPhone: "9876543213",
      contactEmail: "logistics@delhivery.example.com",
      trackingUrlTemplate:
        "https://www.delhivery.com/track/package/{{trackingNumber}}",
      businessId: logisticsBusiness.id,
      isActive: true,
    },
  });

  // ===========================================================================
  // 5. Multi-Warehouse Setup & Physical Inventory Stock
  // ===========================================================================
  console.log("🌱 Seeding Supplier Warehouses & Real-Time Inventory...");

  const warehouseDel1 = await prisma.supplierWarehouse.upsert({
    where: {
      businessId_code: {
        businessId: supplier1Business.id,
        code: "WH-DEL-01",
      },
    },
    update: { isActive: true },
    create: {
      businessId: supplier1Business.id,
      name: "SuperSpares North Hub",
      code: "WH-DEL-01",
      addressLine1: "Plot 42, Mayapuri Industrial Area Phase 1",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "110064",
      contactPhone: "9876543211",
      contactEmail: "delhi.hub@superspares.in",
      isPrimary: true,
      latitude: 28.6315,
      longitude: 77.1085,
      isActive: true,
    },
  });

  const warehouseMum1 = await prisma.supplierWarehouse.upsert({
    where: {
      businessId_code: {
        businessId: supplier2Business.id,
        code: "WH-MUM-01",
      },
    },
    update: { isActive: true },
    create: {
      businessId: supplier2Business.id,
      name: "National Bhiwandi Hub",
      code: "WH-MUM-01",
      addressLine1: "Bldg 4, Bhiwandi Logistics Park",
      city: "Bhiwandi",
      state: "Maharashtra",
      postalCode: "421302",
      contactPhone: "9876543212",
      contactEmail: "bhiwandi.hub@nationalparts.in",
      isPrimary: true,
      latitude: 19.2967,
      longitude: 73.0631,
      isActive: true,
    },
  });

  // Supplier 1 Inventory: Bosch Brake Pads
  const s1ProdBrake = await prisma.supplierProduct.upsert({
    where: {
      businessId_masterProductId: {
        businessId: supplier1Business.id,
        masterProductId: boschBrakePads.id,
      },
    },
    update: { availableQuantity: 150, stockStatus: "IN_STOCK" },
    create: {
      businessId: supplier1Business.id,
      masterProductId: boschBrakePads.id,
      supplierSku: "SS-BOSCH-BP01",
      sellingPrice: 1050.0,
      mrp: 1450.0,
      costPrice: 850.0,
      availableQuantity: 150,
      reservedQuantity: 0,
      minimumOrderQuantity: 5,
      leadTimeDays: 1,
      stockStatus: "IN_STOCK",
      visibility: "PUBLIC",
    },
  });

  await prisma.warehouseInventory.upsert({
    where: {
      warehouseId_supplierProductId: {
        warehouseId: warehouseDel1.id,
        supplierProductId: s1ProdBrake.id,
      },
    },
    update: { quantity: 150, availableQuantity: 150 },
    create: {
      warehouseId: warehouseDel1.id,
      supplierProductId: s1ProdBrake.id,
      quantity: 150,
      availableQuantity: 150,
      reservedQuantity: 0,
      damagedQuantity: 0,
      minStockThreshold: 10,
      reorderLevel: 25,
      binLocation: "BAY-A1-04",
    },
  });

  // Supplier 1 Inventory: Mahle Oil Filter
  const s1ProdOilFilter = await prisma.supplierProduct.upsert({
    where: {
      businessId_masterProductId: {
        businessId: supplier1Business.id,
        masterProductId: mahleFilter.id,
      },
    },
    update: { availableQuantity: 200, stockStatus: "IN_STOCK" },
    create: {
      businessId: supplier1Business.id,
      masterProductId: mahleFilter.id,
      supplierSku: "SS-MAHLE-OF01",
      sellingPrice: 320.0,
      mrp: 450.0,
      costPrice: 240.0,
      availableQuantity: 200,
      reservedQuantity: 0,
      minimumOrderQuantity: 10,
      leadTimeDays: 1,
      stockStatus: "IN_STOCK",
      visibility: "PUBLIC",
    },
  });

  await prisma.warehouseInventory.upsert({
    where: {
      warehouseId_supplierProductId: {
        warehouseId: warehouseDel1.id,
        supplierProductId: s1ProdOilFilter.id,
      },
    },
    update: { quantity: 200, availableQuantity: 200 },
    create: {
      warehouseId: warehouseDel1.id,
      supplierProductId: s1ProdOilFilter.id,
      quantity: 200,
      availableQuantity: 200,
      reservedQuantity: 0,
      damagedQuantity: 0,
      minStockThreshold: 15,
      reorderLevel: 30,
      binLocation: "BAY-C2-11",
    },
  });

  // Supplier 1 Inventory: Bosch Spark Plug
  const s1ProdSpark = await prisma.supplierProduct.upsert({
    where: {
      businessId_masterProductId: {
        businessId: supplier1Business.id,
        masterProductId: boschSparkPlug.id,
      },
    },
    update: { availableQuantity: 300, stockStatus: "IN_STOCK" },
    create: {
      businessId: supplier1Business.id,
      masterProductId: boschSparkPlug.id,
      supplierSku: "SS-BOSCH-SP01",
      sellingPrice: 140.0,
      mrp: 210.0,
      costPrice: 105.0,
      availableQuantity: 300,
      reservedQuantity: 0,
      minimumOrderQuantity: 20,
      leadTimeDays: 1,
      stockStatus: "IN_STOCK",
      visibility: "PUBLIC",
    },
  });

  await prisma.warehouseInventory.upsert({
    where: {
      warehouseId_supplierProductId: {
        warehouseId: warehouseDel1.id,
        supplierProductId: s1ProdSpark.id,
      },
    },
    update: { quantity: 300, availableQuantity: 300 },
    create: {
      warehouseId: warehouseDel1.id,
      supplierProductId: s1ProdSpark.id,
      quantity: 300,
      availableQuantity: 300,
      reservedQuantity: 0,
      damagedQuantity: 0,
      minStockThreshold: 25,
      reorderLevel: 50,
      binLocation: "BAY-D1-02",
    },
  });

  // Supplier 2 Inventory: Bosch Brake Pads & Mahle Filter
  const s2ProdBrake = await prisma.supplierProduct.upsert({
    where: {
      businessId_masterProductId: {
        businessId: supplier2Business.id,
        masterProductId: boschBrakePads.id,
      },
    },
    update: { availableQuantity: 80, stockStatus: "IN_STOCK" },
    create: {
      businessId: supplier2Business.id,
      masterProductId: boschBrakePads.id,
      supplierSku: "NP-BOSCH-BP01",
      sellingPrice: 1080.0,
      mrp: 1450.0,
      costPrice: 870.0,
      availableQuantity: 80,
      reservedQuantity: 0,
      minimumOrderQuantity: 10,
      leadTimeDays: 2,
      stockStatus: "IN_STOCK",
      visibility: "PUBLIC",
    },
  });

  await prisma.warehouseInventory.upsert({
    where: {
      warehouseId_supplierProductId: {
        warehouseId: warehouseMum1.id,
        supplierProductId: s2ProdBrake.id,
      },
    },
    update: { quantity: 80, availableQuantity: 80 },
    create: {
      warehouseId: warehouseMum1.id,
      supplierProductId: s2ProdBrake.id,
      quantity: 80,
      availableQuantity: 80,
      reservedQuantity: 0,
      damagedQuantity: 0,
      minStockThreshold: 10,
      reorderLevel: 20,
      binLocation: "MUM-R1-05",
    },
  });

  // ===========================================================================
  // 6. Active RFQs & Quotations
  // ===========================================================================
  console.log("🌱 Seeding Wholesale B2B RFQs & Competing Quotations...");

  // RFQ 1: Open RFQ with competing quotes
  const rfq1 = await prisma.sourcingRfq.upsert({
    where: { rfqNumber: "RFQ-2026-0001" },
    update: { status: "RESPONSES_RECEIVED" },
    create: {
      rfqNumber: "RFQ-2026-0001",
      buyerBusinessId: buyerBusiness.id,
      createdById: buyerUser.id,
      masterProductId: boschBrakePads.id,
      quantity: 50,
      targetPrice: 1100.0,
      status: "RESPONSES_RECEIVED",
      deliveryAddress: "Shop 4-6, Phase 2, Okhla Industrial Area",
      deliveryCity: "New Delhi",
      deliveryState: "Delhi",
      deliveryPostalCode: "110020",
      deliveryDeadline: new Date(Date.now() + 7 * 86400000),
      expiresAt: new Date(Date.now() + 5 * 86400000),
      notes: "Urgent restocking for fleet service brake replacement",
    },
  });

  // Quotation 1 from SuperSpares (Best Price)
  await prisma.sourcingQuotation.upsert({
    where: {
      rfqId_supplierBusinessId: {
        rfqId: rfq1.id,
        supplierBusinessId: supplier1Business.id,
      },
    },
    update: { unitPrice: 1050.0, status: "SUBMITTED" },
    create: {
      quoteNumber: "QT-2026-0001",
      rfqId: rfq1.id,
      supplierBusinessId: supplier1Business.id,
      submittedById: supplier1User.id,
      unitPrice: 1050.0,
      totalAmount: 52500.0,
      availableQuantity: 150,
      minimumOrderQuantity: 5,
      leadTimeDays: 1,
      validityUntil: new Date(Date.now() + 5 * 86400000),
      status: "SUBMITTED",
      notes:
        "Genuine Bosch brake pads in stock at Mayapuri hub; next-day delivery guaranteed.",
    },
  });

  // Quotation 2 from National Parts
  await prisma.sourcingQuotation.upsert({
    where: {
      rfqId_supplierBusinessId: {
        rfqId: rfq1.id,
        supplierBusinessId: supplier2Business.id,
      },
    },
    update: { unitPrice: 1080.0, status: "SUBMITTED" },
    create: {
      quoteNumber: "QT-2026-0002",
      rfqId: rfq1.id,
      supplierBusinessId: supplier2Business.id,
      submittedById: supplier2User.id,
      unitPrice: 1080.0,
      totalAmount: 54000.0,
      availableQuantity: 80,
      minimumOrderQuantity: 10,
      leadTimeDays: 2,
      validityUntil: new Date(Date.now() + 4 * 86400000),
      status: "SUBMITTED",
      notes: "Original Bosch stock dispatch from Bhiwandi warehouse.",
    },
  });

  // RFQ 2: Awarded RFQ
  const rfq2 = await prisma.sourcingRfq.upsert({
    where: { rfqNumber: "RFQ-2026-0002" },
    update: { status: "AWARDED" },
    create: {
      rfqNumber: "RFQ-2026-0002",
      buyerBusinessId: buyerBusiness.id,
      createdById: buyerUser.id,
      masterProductId: mahleFilter.id,
      quantity: 20,
      targetPrice: 350.0,
      status: "AWARDED",
      deliveryAddress: "Shop 4-6, Phase 2, Okhla Industrial Area",
      deliveryCity: "New Delhi",
      deliveryState: "Delhi",
      deliveryPostalCode: "110020",
      deliveryDeadline: new Date(Date.now() + 3 * 86400000),
      expiresAt: new Date(Date.now() + 1 * 86400000),
      notes: "Fast replenishment for Creta scheduled oil services",
    },
  });

  const quote2 = await prisma.sourcingQuotation.upsert({
    where: {
      rfqId_supplierBusinessId: {
        rfqId: rfq2.id,
        supplierBusinessId: supplier1Business.id,
      },
    },
    update: { status: "ACCEPTED" },
    create: {
      quoteNumber: "QT-2026-0003",
      rfqId: rfq2.id,
      supplierBusinessId: supplier1Business.id,
      submittedById: supplier1User.id,
      unitPrice: 320.0,
      totalAmount: 6400.0,
      availableQuantity: 200,
      minimumOrderQuantity: 10,
      leadTimeDays: 1,
      validityUntil: new Date(Date.now() + 3 * 86400000),
      status: "ACCEPTED",
      notes: "Accepted quotation under active delivery.",
    },
  });

  await prisma.sourcingRfq.update({
    where: { id: rfq2.id },
    data: { awardedQuotationId: quote2.id },
  });

  // ===========================================================================
  // 7. Active & Delivered Multi-Leg Shipments
  // ===========================================================================
  console.log("🌱 Seeding Multi-Leg Shipments, Tracking Ledger & POD...");

  // Shipment 1: In-Transit Multi-Leg Shipment
  const shipment1 = await prisma.shipment.upsert({
    where: { shipmentNumber: "SHP-2026-00001" },
    update: { status: "IN_TRANSIT" },
    create: {
      shipmentNumber: "SHP-2026-00001",
      senderBusinessId: supplier1Business.id,
      receiverBusinessId: buyerBusiness.id,
      sourcingRfqId: rfq2.id,
      sourcingQuotationId: quote2.id,
      pickupWarehouseId: warehouseDel1.id,
      status: "IN_TRANSIT",
      pickupAddress: "Plot 42, Mayapuri Industrial Area Phase 1",
      pickupCity: "New Delhi",
      pickupState: "Delhi",
      pickupPostalCode: "110064",
      deliveryAddress: "Shop 4-6, Phase 2, Okhla Industrial Area",
      deliveryCity: "New Delhi",
      deliveryState: "Delhi",
      deliveryPostalCode: "110020",
      deliveryContactName: "Vikram Sharma",
      deliveryContactPhone: "9876543210",
      totalWeightKg: 8.5,
      actualPickupAt: new Date(Date.now() - 3600000),
      estimatedDeliveryAt: new Date(Date.now() + 7200000),
      notes: "Priority dispatch for workshop stock replenishment",
      items: {
        create: [
          {
            masterProductId: mahleFilter.id,
            quantity: 20,
            unitPrice: 320.0,
            totalPrice: 6400.0,
            sku: "SS-MAHLE-OF01",
          },
        ],
      },
    },
  });

  // Leg 1: First Mile Pickup (Completed)
  await prisma.shipmentLeg.upsert({
    where: {
      shipmentId_legSequence: {
        shipmentId: shipment1.id,
        legSequence: 1,
      },
    },
    update: { status: "COMPLETED" },
    create: {
      shipmentId: shipment1.id,
      legSequence: 1,
      legType: "FIRST_MILE_PICKUP",
      status: "COMPLETED",
      originFacilityName: "SuperSpares North Hub",
      originAddress: "Plot 42, Mayapuri Phase 1",
      originCity: "New Delhi",
      originState: "Delhi",
      originPostalCode: "110064",
      destinationFacilityName: "Delhivery Central Sortation Hub",
      destinationAddress: "Sector 20, Dwarka",
      destinationCity: "New Delhi",
      destinationState: "Delhi",
      destinationPostalCode: "110075",
      actualDepartureAt: new Date(Date.now() - 7200000),
      actualArrivalAt: new Date(Date.now() - 3600000),
    },
  });

  // Leg 2: Last Mile Delivery (Active / In Progress)
  await prisma.shipmentLeg.upsert({
    where: {
      shipmentId_legSequence: {
        shipmentId: shipment1.id,
        legSequence: 2,
      },
    },
    update: { status: "IN_PROGRESS" },
    create: {
      shipmentId: shipment1.id,
      legSequence: 2,
      legType: "LAST_MILE_DELIVERY",
      status: "IN_PROGRESS",
      assignedProviderId: logisticsProvider.id,
      trackingNumber: "DLV88776655",
      originFacilityName: "Delhivery Central Sortation Hub",
      originAddress: "Sector 20, Dwarka",
      originCity: "New Delhi",
      originState: "Delhi",
      originPostalCode: "110075",
      destinationFacilityName: "Apex Multi-Brand Workshop",
      destinationAddress: "Shop 4-6, Phase 2, Okhla",
      destinationCity: "New Delhi",
      destinationState: "Delhi",
      destinationPostalCode: "110020",
      plannedDepartureAt: new Date(Date.now() - 3600000),
      plannedArrivalAt: new Date(Date.now() + 7200000),
    },
  });

  // Tracking Events for Shipment 1
  await prisma.shipmentTrackingEvent.createMany({
    data: [
      {
        shipmentId: shipment1.id,
        eventType: "SHIPMENT_CREATED",
        location: "New Delhi",
        notes: "Shipment generated and verified at SuperSpares North Hub",
        timestamp: new Date(Date.now() - 14400000),
      },
      {
        shipmentId: shipment1.id,
        eventType: "PICKED_UP",
        location: "Mayapuri Hub",
        notes: "Consignment picked up and scanned by Delhivery driver",
        timestamp: new Date(Date.now() - 7200000),
      },
      {
        shipmentId: shipment1.id,
        eventType: "STATUS_UPDATED",
        location: "Okhla Transit Corridor",
        notes: "In transit to final destination workshop",
        timestamp: new Date(Date.now() - 1800000),
      },
    ],
    skipDuplicates: true,
  });

  // Shipment 2: Delivered Shipment with Proof of Delivery
  const shipment2 = await prisma.shipment.upsert({
    where: { shipmentNumber: "SHP-2026-00002" },
    update: { status: "DELIVERED" },
    create: {
      shipmentNumber: "SHP-2026-00002",
      senderBusinessId: supplier1Business.id,
      receiverBusinessId: buyerBusiness.id,
      pickupWarehouseId: warehouseDel1.id,
      status: "DELIVERED",
      pickupAddress: "Plot 42, Mayapuri Industrial Area Phase 1",
      pickupCity: "New Delhi",
      pickupState: "Delhi",
      pickupPostalCode: "110064",
      deliveryAddress: "Shop 4-6, Phase 2, Okhla Industrial Area",
      deliveryCity: "New Delhi",
      deliveryState: "Delhi",
      deliveryPostalCode: "110020",
      deliveryContactName: "Vikram Sharma",
      deliveryContactPhone: "9876543210",
      totalWeightKg: 15.0,
      actualPickupAt: new Date(Date.now() - 86400000),
      actualDeliveryAt: new Date(Date.now() - 7200000),
      notes: "Delivered order challan verified",
      items: {
        create: [
          {
            masterProductId: boschBrakePads.id,
            quantity: 10,
            unitPrice: 1050.0,
            totalPrice: 10500.0,
            sku: "SS-BOSCH-BP01",
          },
        ],
      },
      legs: {
        create: [
          {
            legSequence: 1,
            legType: "LAST_MILE_DELIVERY",
            status: "COMPLETED",
            assignedProviderId: logisticsProvider.id,
            trackingNumber: "DLV99112233",
            originAddress: "Plot 42, Mayapuri Phase 1",
            originCity: "New Delhi",
            originState: "Delhi",
            originPostalCode: "110064",
            destinationAddress: "Shop 4-6, Phase 2, Okhla",
            destinationCity: "New Delhi",
            destinationState: "Delhi",
            destinationPostalCode: "110020",
            actualDepartureAt: new Date(Date.now() - 86400000),
            actualArrivalAt: new Date(Date.now() - 7200000),
          },
        ],
      },
    },
  });

  await prisma.proofOfDelivery.upsert({
    where: { shipmentId: shipment2.id },
    update: {},
    create: {
      shipmentId: shipment2.id,
      recipientName: "Sanjay Verma",
      recipientPhone: "9876543210",
      deliveryTimestamp: new Date(Date.now() - 7200000),
      verificationCode: "847291",
      documentUrl:
        "https://assets.asn-platform.internal/pod/shp-2026-00002-signed.jpg",
      notes:
        "Received in good condition; verified workshop store manager signature.",
    },
  });

  console.log("✓ Seeded Admin, Buyer, Supplier & Logistics Test Accounts.");
  console.log("✓ Seeded Warehouses, Real-time Stock & Inventory Movements.");
  console.log("✓ Seeded Active/Awarded RFQs and Competing Quotations.");
  console.log("✓ Seeded In-Transit & Delivered Shipments with Tracking & POD.");
  console.log("✅ Complete ASN Platform Seeding Finished Successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
