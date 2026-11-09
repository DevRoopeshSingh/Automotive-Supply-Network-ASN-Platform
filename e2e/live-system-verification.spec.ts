import { test, expect } from "@playwright/test";

test.describe("ASN Platform — Real Live System Verification (No Mocks)", () => {
  test("1. System Health & OpenAPI Documentation", async ({
    request,
    page,
  }) => {
    // Check Health endpoint
    const healthRes = await request.get("http://localhost:4000/health");
    expect(healthRes.status()).toBe(200);
    const healthData = await healthRes.json();
    expect(healthData.status).toBe("ok");
    expect(healthData.service).toBe("asn-api-server");

    // Check Swagger Documentation in browser
    await page.goto("http://localhost:4000/docs");
    await expect(
      page.locator("text=Automotive Supply Network (ASN) Core API"),
    ).toBeVisible();
    await expect(page.getByText("/api/v1/auth/otp/request")).toBeVisible();
  });

  test("2. Real End-to-End Buyer Experience on Buyer Web (:3000)", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000");

    // Verify Buyer portal loaded
    await expect(page.locator("text=ASNMarketplace")).toBeVisible();
    await expect(page.locator("text=Delhi NCR Cluster")).toBeVisible();

    // Authenticate with Real Seeded Buyer
    await page.click("button:has-text('Quick Login (Apex Workshop)')");
    await expect(page.locator("button:has-text('Sign Out')")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.locator("text=Apex Multi-Brand Workshop").first(),
    ).toBeVisible();

    // Verify Real Catalog from PostgreSQL
    await expect(
      page.locator("text=Bosch Premium Front Ceramic Brake Pad Set"),
    ).toBeVisible();
    await expect(
      page.locator("text=Mahle Original Spin-On Oil Filter OC 501"),
    ).toBeVisible();

    // Open Specs & Fitment for real product
    await page.click("button:has-text('Specs & Fitment')");
    await expect(page.locator("text=Technical Specifications")).toBeVisible();
    await page.click("button:has-text('Close')");

    // Switch to Wholesale RFQs tab
    await page.click("button:has-text('Wholesale RFQs')");
    await expect(page.locator("text=RFQ-2026-0001")).toBeVisible();

    // Open Compare Bids modal with real PostgreSQL quotations
    await page
      .locator("tr:has-text('RFQ-2026-0001')")
      .locator("button:has-text('Compare Bids')")
      .click();
    await expect(page.locator("text=Best Price")).toBeVisible();
    await expect(page.locator("text=₹1,050")).toBeVisible();
    await page.keyboard.press("Escape");

    // Switch to Deliveries tab with real PostgreSQL shipments
    await page.click("button:has-text('Deliveries')");
    await expect(page.locator("text=SHP-2026-00001")).toBeVisible();
    await expect(page.locator("text=IN_TRANSIT")).toBeVisible();

    // View Tracking Timeline
    await page
      .locator("tr:has-text('SHP-2026-00001')")
      .locator("button:has-text('View Timeline')")
      .click();
    await expect(page.locator("text=Shipment: SHP-2026-00001")).toBeVisible();
    await expect(page.locator("text=Origin (Supplier)")).toBeVisible();
    await expect(page.locator("text=Destination (Workshop)")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("3. Real End-to-End Supplier OS Experience on Supplier Web (:3001)", async ({
    page,
  }) => {
    await page.goto("http://localhost:3001");

    // Verify Supplier portal loaded
    await expect(page.locator("text=ASNSupplierOS")).toBeVisible();

    // Authenticate with Real Seeded Supplier
    await page.click("button:has-text('Quick Login (SuperSpares)')");
    await expect(page.locator("button:has-text('Sign Out')")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.locator("text=SuperSpares Distribution").first(),
    ).toBeVisible();

    // Verify Real Inventory & Warehouses
    await expect(
      page.locator("text=SuperSpares North Hub").first(),
    ).toBeVisible();
    await expect(page.locator("text=WH-DEL-01").first()).toBeVisible();

    // Switch to Warehouses tab
    await page.click("button:has-text('Warehouses')");
    await expect(
      page.locator("text=SuperSpares North Hub").first(),
    ).toBeVisible();

    // Switch to RFQ Bids tab
    await page.click("button:has-text('RFQ Bids')");
    await expect(page.locator("text=RFQ-2026-0001")).toBeVisible();

    // Switch to Dispatches tab
    await page.click("button:has-text('Dispatches')");
    await expect(page.locator("text=SHP-2026-00001")).toBeVisible();
  });

  test("4. Real End-to-End Admin Governance Experience on Admin Web (:3002)", async ({
    page,
  }) => {
    await page.goto("http://localhost:3002");

    // Verify Admin portal loaded
    await expect(page.locator("text=ASNAdminCentre")).toBeVisible();

    // Authenticate with Real Super Admin
    await page.click("button:has-text('Quick Admin Login')");
    await expect(page.locator("text=PLATFORM_SUPER_ADMIN")).toBeVisible({
      timeout: 10000,
    });

    // Verify Governance Metrics
    await expect(page.locator("text=Catalog Parts")).toBeVisible();
    await expect(page.locator("text=Logistics Providers")).toBeVisible();

    // Switch to Logistics Partners tab
    await page.click("button:has-text('Logistics Partners')");
    await expect(
      page.locator("text=Delhivery Automotive Surface"),
    ).toBeVisible();
    await expect(page.locator("text=DELHIVERY_AUTO")).toBeVisible();

    // Switch to All Shipments tab
    await page.click("button:has-text('All Shipments')");
    await expect(page.locator("text=SHP-2026-00001")).toBeVisible();
    await expect(page.locator("text=SHP-2026-00002")).toBeVisible();
  });
});
