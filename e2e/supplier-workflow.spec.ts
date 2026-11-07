import { test, expect } from "@playwright/test";

test.describe("ASN Supplier OS — End-to-End Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Warehouses API
    await page.route("**/api/v1/supplier/warehouses*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: "wh-del-1",
                name: "SuperSpares North Hub",
                code: "WH-DEL-01",
                addressLine1: "Plot 42, Mayapuri Phase 1",
                city: "New Delhi",
                state: "Delhi",
                postalCode: "110064",
                isPrimary: true,
              },
            ],
          },
        }),
      });
    });

    // Intercept Inventory API
    await page.route("**/api/v1/supplier/inventory*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: "inv-bosch-1",
                quantity: 150,
                availableQuantity: 150,
                reservedQuantity: 0,
                damagedQuantity: 0,
                warehouse: {
                  name: "SuperSpares North Hub",
                  code: "WH-DEL-01",
                },
                supplierProduct: {
                  supplierSku: "SS-BOSCH-BP01",
                  masterProduct: {
                    name: "Bosch Front Ceramic Brake Pad Set",
                    partNumber: "0986AB1234",
                  },
                },
              },
            ],
          },
        }),
      });
    });

    // Intercept Network RFQs API
    await page.route("**/api/v1/supplier/ssn/rfqs*", async (route) => {
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
                buyerBusiness: { tradeName: "Apex Multi-Brand Workshop" },
                masterProduct: {
                  name: "Bosch Front Ceramic Brake Pad Set",
                  partNumber: "0986AB1234",
                },
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
                deliveryCity: "New Delhi",
                deliveryState: "Delhi",
                receiverBusiness: { tradeName: "Apex Multi-Brand Workshop" },
              },
            ],
          },
        }),
      });
    });
  });

  test("should render supplier OS dashboard, display inventory and warehouses", async ({
    page,
  }) => {
    // Intercept auth to mock logged-in state
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
            accessToken: "mock-supplier-token",
            refreshToken: "mock-supplier-refresh",
            user: {
              id: "usr-supp-1",
              phone: "9876543211",
              firstName: "Ramesh",
              lastName: "Patel",
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
              id: "biz-supp-1",
              tradeName: "SuperSpares Distribution",
              legalName: "SuperSpares Logistics LLP",
              role: "BUSINESS_OWNER",
            },
          ],
        }),
      });
    });

    await page.goto("http://localhost:3001");

    // Branding
    await expect(page.locator("text=ASNSupplierOS")).toBeVisible();

    // Login as SuperSpares
    await page.click("button:has-text('Quick Login (SuperSpares)')");
    await expect(page.locator("text=SuperSpares Distribution")).toBeVisible();

    // Inventory list should be displayed
    await expect(
      page.locator("text=Bosch Front Ceramic Brake Pad Set"),
    ).toBeVisible();
    await expect(page.locator("text=SS-BOSCH-BP01")).toBeVisible();
    await expect(page.locator("text=150 units").first()).toBeVisible();

    // Open Stock Adjustment Modal
    await page.click("button:has-text('Adjust Stock')");
    await expect(
      page.locator("h3:has-text('Adjust Warehouse Inventory')"),
    ).toBeVisible();
    await page.click("button:has-text('Cancel')");

    // Switch to Warehouses tab
    await page.click("button:has-text('Warehouses')");
    await expect(page.locator("text=SuperSpares North Hub")).toBeVisible();
    await expect(page.locator("text=Code: WH-DEL-01")).toBeVisible();

    // Switch to RFQ Bids tab
    await page.click("button:has-text('RFQ Bids')");
    await expect(page.locator("text=RFQ-2026-0001")).toBeVisible();
    await expect(page.locator("text=Apex Multi-Brand Workshop")).toBeVisible();

    // Switch to Dispatches tab
    await page.click("button:has-text('Dispatches')");
    await expect(page.locator("text=SHP-2026-00001")).toBeVisible();
  });
});
