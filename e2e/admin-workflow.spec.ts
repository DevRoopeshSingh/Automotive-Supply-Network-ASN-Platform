import { test, expect } from "@playwright/test";

test.describe("ASN Admin Control Centre — End-to-End Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Catalog API
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
                status: "ACTIVE",
                brand: { name: "BOSCH" },
                category: { name: "Brake Pads" },
              },
            ],
          },
        }),
      });
    });

    // Intercept Providers API
    await page.route("**/api/v1/logistics/providers*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: "prov-1",
                name: "Delhivery Automotive Surface",
                providerCode: "DELHIVERY_AUTO",
                providerType: "THIRD_PARTY_3PL",
                contactPhone: "9876543213",
                contactEmail: "logistics@delhivery.example.com",
              },
            ],
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
                pickupCity: "New Delhi",
                deliveryCity: "New Delhi",
                senderBusiness: { tradeName: "SuperSpares Distribution" },
                receiverBusiness: { tradeName: "Apex Multi-Brand Workshop" },
                proofOfDelivery: null,
              },
            ],
          },
        }),
      });
    });
  });

  test("should render admin centre, login as super admin, and inspect governance tabs", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/otp/request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { message: "Dispatched" },
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
            accessToken: "mock-admin-token",
            refreshToken: "mock-admin-refresh",
            user: {
              id: "usr-admin-1",
              phone: "9999999999",
              firstName: "System",
              lastName: "Administrator",
              isSuperAdmin: true,
            },
          },
        }),
      });
    });

    await page.goto("http://localhost:3002");

    // Branding
    await expect(page.locator("text=ASNAdminCentre")).toBeVisible();
    await expect(
      page.locator("text=Platform Governance & SLA Control"),
    ).toBeVisible();

    // Login as Super Admin
    await page.click("button:has-text('Quick Admin Login')");
    await expect(page.locator("text=PLATFORM_SUPER_ADMIN")).toBeVisible();

    // Check Surveillance statistics
    await expect(page.locator("text=Catalog Parts")).toBeVisible();
    await expect(page.locator("text=Logistics Providers")).toBeVisible();
    await expect(page.locator("text=Active Shipments")).toBeVisible();

    // Switch to Catalog Part Master tab
    await page.click("button:has-text('Catalog Part Master')");
    await expect(
      page.locator("text=Bosch Front Ceramic Brake Pad Set"),
    ).toBeVisible();
    await expect(page.locator("text=0986AB1234")).toBeVisible();

    // Switch to Logistics Partners tab
    await page.click("button:has-text('Logistics Partners')");
    await expect(
      page.locator("text=Delhivery Automotive Surface"),
    ).toBeVisible();
    await expect(page.locator("text=Code: DELHIVERY_AUTO")).toBeVisible();

    // Switch to All Shipments tab
    await page.click("button:has-text('All Shipments')");
    await expect(page.locator("text=SHP-2026-00001")).toBeVisible();
    await expect(page.locator("text=SuperSpares Distribution")).toBeVisible();
  });
});
