import { test, expect } from "@playwright/test";

test.describe("ASN Buyer Marketplace — End-to-End Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept catalog API
    await page.route("**/api/v1/catalog/products*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: "prod-bosch-100",
                name: "Bosch Front Ceramic Brake Pad Set",
                partNumber: "0986AB1234",
                oemNumber: "58101-1RA00",
                conditionType: "OES",
                brand: { name: "BOSCH" },
                category: { name: "Brake Pads" },
                fitments: [
                  {
                    vehicleVariant: {
                      model: {
                        name: "Creta",
                        make: { name: "Hyundai" },
                      },
                      variantName: "1.5L CRDi Diesel SX",
                    },
                    position: "Front Axle",
                  },
                ],
              },
              {
                id: "prod-mahle-200",
                name: "Mahle Spin-On Oil Filter OC 501",
                partNumber: "OC 501",
                oemNumber: "26300-35505",
                conditionType: "AFTERMARKET",
                brand: { name: "MAHLE" },
                category: { name: "Oil Filters" },
                fitments: [],
              },
            ],
          },
        }),
      });
    });

    // Intercept RFQs API
    await page.route("**/api/v1/supplier/ssn/rfqs*", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "rfq-new-1",
              rfqNumber: "RFQ-2026-9999",
              status: "PUBLISHED",
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              items: [
                {
                  id: "rfq-test-1",
                  rfqNumber: "RFQ-2026-0001",
                  quantity: 50,
                  targetPrice: 1100,
                  deliveryCity: "New Delhi",
                  deliveryState: "Delhi",
                  status: "RESPONSES_RECEIVED",
                  masterProduct: {
                    name: "Bosch Front Ceramic Brake Pad Set",
                    partNumber: "0986AB1234",
                  },
                },
              ],
            },
          }),
        });
      }
    });

    // Intercept RFQ Comparison API
    await page.route("**/api/v1/supplier/ssn/rfqs/*/compare", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "rfq-test-1",
            rfqNumber: "RFQ-2026-0001",
            quantity: 50,
            targetPrice: 1100,
            status: "RESPONSES_RECEIVED",
            masterProduct: {
              name: "Bosch Front Ceramic Brake Pad Set",
              partNumber: "0986AB1234",
            },
            quotations: [
              {
                id: "quote-1",
                quoteNumber: "QT-2026-0001",
                unitPrice: 1050,
                totalAmount: 52500,
                leadTimeDays: 1,
                status: "SUBMITTED",
                isBestPrice: true,
                isFastestDelivery: true,
                supplierBusiness: { tradeName: "SuperSpares Distribution" },
              },
            ],
          },
        }),
      });
    });

    // Intercept Quotation Award API
    await page.route("**/api/v1/supplier/ssn/rfqs/*/award", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            rfqId: "rfq-test-1",
            status: "AWARDED",
            awardedQuotationId: "quote-1",
          },
        }),
      });
    });

    // Intercept Shipments API
    await page.route("**/api/v1/logistics/shipments*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: "shp-test-1",
                shipmentNumber: "SHP-2026-00001",
                status: "IN_TRANSIT",
                deliveryCity: "New Delhi",
                deliveryState: "Delhi",
                pickupAddress: "Mayapuri Industrial Area",
                deliveryAddress: "Okhla Industrial Area",
                senderBusiness: { tradeName: "SuperSpares Distribution" },
                legs: [
                  {
                    id: "leg-1",
                    legSequence: 1,
                    legType: "FIRST_MILE_PICKUP",
                    status: "COMPLETED",
                    originCity: "Mayapuri",
                    destinationCity: "Dwarka Hub",
                  },
                  {
                    id: "leg-2",
                    legSequence: 2,
                    legType: "LAST_MILE_DELIVERY",
                    status: "ACTIVE",
                    originCity: "Dwarka Hub",
                    destinationCity: "Okhla",
                    trackingNumber: "DLV88776655",
                  },
                ],
                trackingEvents: [
                  {
                    eventType: "SHIPMENT_CREATED",
                    notes: "Shipment generated at warehouse",
                    timestamp: new Date().toISOString(),
                  },
                ],
              },
            ],
          },
        }),
      });
    });
  });

  test("should render catalog search, display part details and fitment badges", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000");

    // Check title & branding
    await expect(page.locator("text=ASNMarketplace")).toBeVisible();
    await expect(page.locator("text=Delhi NCR Cluster")).toBeVisible();

    // Verify catalog items rendered from API
    await expect(
      page.locator("text=Bosch Front Ceramic Brake Pad Set"),
    ).toBeVisible();
    await expect(page.locator("text=0986AB1234")).toBeVisible();
    await expect(page.locator("text=Hyundai Creta")).toBeVisible();

    // Open specifications modal
    await page.click("button:has-text('Specs & Fitment')");
    await expect(
      page.locator("h3:has-text('Bosch Front Ceramic Brake Pad Set')"),
    ).toBeVisible();
    await expect(
      page.locator("text=Verified Compatible Vehicle Models"),
    ).toBeVisible();

    // Close modal
    await page.click("button:has-text('Close')");
  });

  test("should authenticate buyer using dev OTP flow", async ({ page }) => {
    // Intercept auth APIs
    await page.route("**/api/v1/auth/otp/request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { message: "OTP dispatched" },
        }),
      });
    });

    await page.route("**/api/v1/auth/otp/verify", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            accessToken: "mock-buyer-access-token",
            refreshToken: "mock-buyer-refresh-token",
            user: {
              id: "usr-buyer-1",
              phone: "9876543210",
              firstName: "Vikram",
              lastName: "Sharma",
            },
          },
        }),
      });
    });

    await page.route("**/api/v1/businesses/my", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "biz-buyer-1",
              tradeName: "Apex Multi-Brand Workshop",
              legalName: "Apex Auto Care Pvt Ltd",
              role: "BUSINESS_OWNER",
            },
          ],
        }),
      });
    });

    await page.goto("http://localhost:3000");

    // Click quick dev login
    await page.click("button:has-text('Quick Login (Apex Workshop)')");

    // Session badge should appear
    await expect(page.locator("text=Apex Multi-Brand Workshop")).toBeVisible();
    await expect(page.locator("button:has-text('Sign Out')")).toBeVisible();
  });

  test("should switch tabs to view wholesale RFQs, compare bids, and inspect tracking", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000");

    // Switch to Wholesale RFQs tab
    await page.click("button:has-text('Wholesale RFQs')");
    await expect(page.locator("text=RFQ-2026-0001")).toBeVisible();
    await expect(page.locator("text=50 units")).toBeVisible();

    // Open comparison modal
    await page.click("button:has-text('Compare Bids')");
    await expect(page.locator("text=SuperSpares Distribution")).toBeVisible();
    await expect(page.locator("text=Best Price")).toBeVisible();
    await expect(page.locator("text=₹1,050")).toBeVisible();

    // Switch to Deliveries tab
    await page.click("button:has-text('Deliveries')");
    await expect(page.locator("text=SHP-2026-00001")).toBeVisible();
    await expect(page.locator("text=IN_TRANSIT")).toBeVisible();

    // Open tracking timeline
    await page.click("button:has-text('View Timeline')");
    await expect(page.locator("text=Sequential Freight Legs")).toBeVisible();
    await expect(page.locator("text=Leg 1: FIRST_MILE_PICKUP")).toBeVisible();
    await expect(page.locator("text=Leg 2: LAST_MILE_DELIVERY")).toBeVisible();
  });
});
