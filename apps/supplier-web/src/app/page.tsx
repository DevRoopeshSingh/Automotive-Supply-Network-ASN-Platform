"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Textarea,
  Select,
  Modal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Alert,
} from "@asn/ui";
import {
  Package,
  UploadCloud,
  Truck,
  PlusCircle,
  FileText,
  Warehouse,
  CheckCircle2,
  LogOut,
  User,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import {
  apiFetch,
  getSession,
  saveSession,
  clearSession,
  type StoredSession,
} from "../lib/api";

export default function SupplierOSPage() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [activeTab, setActiveTab] = useState<
    "warehouses" | "inventory" | "bulk-import" | "rfqs" | "shipments"
  >("inventory");

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authStep, setAuthStep] = useState<"phone" | "otp" | "business">(
    "phone",
  );
  const [phoneInput, setPhoneInput] = useState("9876543211");
  const [otpInput, setOtpInput] = useState("123456");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [tempUser, setTempUser] = useState<any>(null);
  const [userBusinesses, setUserBusinesses] = useState<any[]>([]);

  // Warehouses State
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [whName, setWhName] = useState("");
  const [whCode, setWhCode] = useState("");
  const [whAddress, setWhAddress] = useState("");
  const [whCity, setWhCity] = useState("New Delhi");
  const [whState, setWhState] = useState("Delhi");
  const [whPostalCode, setWhPostalCode] = useState("110064");
  const [whPhone, setWhPhone] = useState("9876543211");
  const [whSubmitting, setWhSubmitting] = useState(false);

  // Inventory State
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<any | null>(null);
  const [adjustChangeQty, setAdjustChangeQty] = useState("25");
  const [adjustReason, setAdjustReason] = useState("PURCHASE_RECEIPT");
  const [adjustNotes, setAdjustNotes] = useState(
    "Restocking bulk shipment received",
  );
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState("");

  // Bulk CSV Import State
  const defaultCsvSample = `sku,partNumber,brandName,warehouseCode,quantity,sellingPrice,minOrderQuantity
SS-BOSCH-BP01,0986AB1234,BOSCH,WH-DEL-01,50,1050.00,5
SS-MAHLE-OF01,OC 501,MAHLE,WH-DEL-01,100,320.00,10
SS-BOSCH-SP01,FR 7 DC+,BOSCH,WH-DEL-01,150,140.00,20`;

  const [csvContent, setCsvContent] = useState(defaultCsvSample);
  const [importLoading, setImportLoading] = useState(false);
  const [previewJob, setPreviewJob] = useState<any | null>(null);
  const [importError, setImportError] = useState("");
  const [executeResult, setExecuteResult] = useState<any | null>(null);

  // RFQ Bidding State
  const [networkRfqs, setNetworkRfqs] = useState<any[]>([]);
  const [rfqsLoading, setRfqsLoading] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<any | null>(null);
  const [quoteUnitPrice, setQuoteUnitPrice] = useState("1050");
  const [quoteAvailableQty, setQuoteAvailableQty] = useState("100");
  const [quoteMoq, setQuoteMoq] = useState("5");
  const [quoteLeadTime, setQuoteLeadTime] = useState("1");
  const [quoteNotes, setQuoteNotes] = useState(
    "In stock at Mayapuri hub; 1-day express delivery.",
  );
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quoteSuccess, setQuoteSuccess] = useState("");

  // Shipments State
  const [shipments, setShipments] = useState<any[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);

  // Load session on mount
  useEffect(() => {
    const s = getSession();
    if (s) {
      setSession(s);
    }
  }, []);

  // Fetch Warehouses
  const loadWarehouses = useCallback(async () => {
    if (!session?.business?.id) return;
    setWarehousesLoading(true);
    const res = await apiFetch<any>("/supplier/warehouses");
    if (res.success && res.data) {
      setWarehouses(res.data.items || res.data || []);
    }
    setWarehousesLoading(false);
  }, [session]);

  // Fetch Live Inventory
  const loadInventory = useCallback(async () => {
    if (!session?.business?.id) return;
    setInventoryLoading(true);
    const res = await apiFetch<any>("/supplier/inventory");
    if (res.success && res.data) {
      setInventoryList(res.data.items || res.data || []);
    }
    setInventoryLoading(false);
  }, [session]);

  // Fetch Network RFQs
  const loadNetworkRfqs = useCallback(async () => {
    if (!session?.business?.id) return;
    setRfqsLoading(true);
    const res = await apiFetch<any>("/supplier/ssn/rfqs");
    if (res.success && res.data) {
      setNetworkRfqs(res.data.items || res.data || []);
    }
    setRfqsLoading(false);
  }, [session]);

  // Fetch Outgoing Shipments
  const loadShipments = useCallback(async () => {
    if (!session?.business?.id) return;
    setShipmentsLoading(true);
    const res = await apiFetch<any>("/logistics/shipments");
    if (res.success && res.data) {
      setShipments(res.data.items || res.data || []);
    }
    setShipmentsLoading(false);
  }, [session]);

  useEffect(() => {
    if (session?.business?.id) {
      if (activeTab === "warehouses") loadWarehouses();
      if (activeTab === "inventory") loadInventory();
      if (activeTab === "rfqs") loadNetworkRfqs();
      if (activeTab === "shipments") loadShipments();
    }
  }, [
    session,
    activeTab,
    loadWarehouses,
    loadInventory,
    loadNetworkRfqs,
    loadShipments,
  ]);

  // Quick Dev Login
  const handleQuickDevLogin = async (phone = "9876543211") => {
    setAuthLoading(true);
    setAuthError("");
    await apiFetch("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });

    const verifyRes = await apiFetch<any>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, otp: "123456" }),
    });

    if (verifyRes.success && verifyRes.data) {
      const { accessToken, refreshToken, user } = verifyRes.data;
      const bizRes = await fetch("http://localhost:4000/api/v1/businesses/my", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const bizData = await bizRes.json();
      const myBusinesses = bizData.data || [];

      if (myBusinesses.length > 0) {
        const primaryBiz = myBusinesses[0];
        const newSession: StoredSession = {
          accessToken,
          refreshToken,
          user,
          business: {
            id: primaryBiz.id,
            tradeName: primaryBiz.tradeName,
            legalName: primaryBiz.legalName,
            role: primaryBiz.role || "BUSINESS_OWNER",
          },
        };
        saveSession(newSession);
        setSession(newSession);
        setShowAuthModal(false);
      } else {
        setAuthError("No supplier business found for this account.");
      }
    } else {
      setAuthError(
        verifyRes.error?.message || "Login failed. Ensure API server is live.",
      );
    }
    setAuthLoading(false);
  };

  // Step 1: Request OTP
  const handleRequestOtp = async () => {
    setAuthLoading(true);
    setAuthError("");
    const res = await apiFetch("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone: phoneInput }),
    });
    if (res.success) {
      setAuthStep("otp");
    } else {
      setAuthError(res.error?.message || "Failed to dispatch OTP");
    }
    setAuthLoading(false);
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    setAuthLoading(true);
    setAuthError("");
    const res = await apiFetch<any>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone: phoneInput, otp: otpInput }),
    });

    if (res.success && res.data) {
      const { accessToken, refreshToken, user } = res.data;
      setTempToken(accessToken);
      setTempUser(user);

      const bizRes = await fetch("http://localhost:4000/api/v1/businesses/my", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const bizData = await bizRes.json();
      const myBusinesses = bizData.data || [];

      if (myBusinesses.length === 1) {
        const b = myBusinesses[0];
        const newSession: StoredSession = {
          accessToken,
          refreshToken,
          user,
          business: {
            id: b.id,
            tradeName: b.tradeName,
            legalName: b.legalName,
            role: b.role,
          },
        };
        saveSession(newSession);
        setSession(newSession);
        setShowAuthModal(false);
      } else if (myBusinesses.length > 1) {
        setUserBusinesses(myBusinesses);
        setAuthStep("business");
      } else {
        setAuthError("Account verified, but no business profile is linked.");
      }
    } else {
      setAuthError(res.error?.message || "Invalid OTP entered");
    }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  // Add Warehouse
  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setWhSubmitting(true);
    const res = await apiFetch<any>("/supplier/warehouses", {
      method: "POST",
      body: JSON.stringify({
        name: whName,
        code: whCode.toUpperCase(),
        addressLine1: whAddress,
        city: whCity,
        state: whState,
        postalCode: whPostalCode,
        contactPhone: whPhone,
      }),
    });
    if (res.success) {
      setShowWarehouseModal(false);
      setWhName("");
      setWhCode("");
      setWhAddress("");
      loadWarehouses();
    } else {
      alert(`Warehouse creation failed: ${res.error?.message}`);
    }
    setWhSubmitting(false);
  };

  // Adjust Stock
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventory) return;
    setAdjustSubmitting(true);
    setAdjustError("");

    const delta = parseInt(adjustChangeQty, 10);
    const res = await apiFetch<any>("/supplier/inventory/adjust", {
      method: "POST",
      body: JSON.stringify({
        warehouseInventoryId: selectedInventory.id,
        changeQuantity: delta,
        reason: adjustReason,
        notes: adjustNotes,
      }),
    });

    if (res.success) {
      setShowAdjustModal(false);
      setSelectedInventory(null);
      loadInventory();
    } else {
      setAdjustError(res.error?.message || "Stock adjustment failed");
    }
    setAdjustSubmitting(false);
  };

  // Bulk CSV Upload & Preview
  const handleUploadCsv = async () => {
    if (warehouses.length === 0) {
      alert(
        "Please ensure at least one warehouse is registered before importing stock.",
      );
      return;
    }
    setImportLoading(true);
    setImportError("");
    setExecuteResult(null);

    const res = await apiFetch<any>("/supplier/inventory/bulk-csv/upload", {
      method: "POST",
      body: JSON.stringify({
        warehouseId: warehouses[0].id,
        csvContent,
      }),
    });

    if (res.success && res.data) {
      setPreviewJob(res.data);
    } else {
      setImportError(res.error?.message || "Failed to parse CSV preview");
    }
    setImportLoading(false);
  };

  // Commit & Execute Bulk CSV
  const handleExecuteCsv = async () => {
    if (!previewJob?.id) return;
    setImportLoading(true);
    const res = await apiFetch<any>(
      `/supplier/inventory/bulk-csv/${previewJob.id}/execute`,
      {
        method: "POST",
      },
    );

    if (res.success) {
      setExecuteResult(res.data);
      loadInventory();
    } else {
      alert(`Import execution failed: ${res.error?.message}`);
    }
    setImportLoading(false);
  };

  // Submit Quotation
  const handleSubmitQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRfq) return;
    setQuoteSubmitting(true);
    setQuoteError("");
    setQuoteSuccess("");

    const payload = {
      rfqId: selectedRfq.id,
      unitPrice: parseFloat(quoteUnitPrice),
      availableQuantity: parseInt(quoteAvailableQty, 10),
      minimumOrderQuantity: parseInt(quoteMoq, 10),
      leadTimeDays: parseInt(quoteLeadTime, 10),
      validityUntil: new Date(Date.now() + 5 * 86400000).toISOString(),
      notes: quoteNotes,
    };

    const res = await apiFetch<any>("/supplier/ssn/quotations", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setQuoteSuccess(
        `Quotation submitted successfully: ${res.data?.quoteNumber || "Submitted"}`,
      );
      setTimeout(() => {
        setShowQuoteModal(false);
        setQuoteSuccess("");
        loadNetworkRfqs();
      }, 1500);
    } else {
      setQuoteError(res.error?.message || "Failed to submit quotation");
    }
    setQuoteSubmitting(false);
  };

  // Progress Shipment Status
  const handleProgressStatus = async (
    shipmentId: string,
    currentStatus: string,
  ) => {
    let nextStatus = "IN_TRANSIT";
    if (currentStatus === "CREATED") nextStatus = "PICKUP_SCHEDULED";
    else if (currentStatus === "PICKUP_SCHEDULED") nextStatus = "PICKED_UP";
    else if (currentStatus === "PICKED_UP") nextStatus = "IN_TRANSIT";
    else if (currentStatus === "IN_TRANSIT") nextStatus = "OUT_FOR_DELIVERY";

    const res = await apiFetch<any>(
      `/logistics/shipments/${shipmentId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
          notes: `Operational state progression to ${nextStatus}`,
        }),
      },
    );

    if (res.success) {
      loadShipments();
    } else {
      alert(`Status transition failed: ${res.error?.message}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
              <span className="bg-sky-700 text-white px-2 py-0.5 rounded text-sm font-extrabold tracking-normal">
                ASN
              </span>
              <span>SupplierOS</span>
            </span>
            <Badge variant="success" className="hidden sm:inline-flex text-xs">
              Live Supplier Portal
            </Badge>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("inventory")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "inventory"
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Inventory</span>
              {inventoryList.length > 0 && (
                <span className="bg-sky-100 text-sky-800 text-[10px] px-1.5 rounded-full font-bold">
                  {inventoryList.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("warehouses")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "warehouses"
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Warehouse className="w-3.5 h-3.5" />
              <span>Warehouses</span>
            </button>
            <button
              onClick={() => setActiveTab("bulk-import")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "bulk-import"
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Bulk CSV</span>
            </button>
            <button
              onClick={() => setActiveTab("rfqs")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "rfqs"
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>RFQ Bids</span>
              {networkRfqs.length > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 rounded-full font-bold">
                  {networkRfqs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("shipments")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "shipments"
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Dispatches</span>
            </button>
          </nav>

          {/* User Auth Section */}
          <div className="flex items-center gap-2">
            {session ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 leading-tight">
                    {session.business?.tradeName || session.user.phone}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {session.business?.role || "SUPPLIER"} •{" "}
                    {session.user.firstName || "User"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="gap-1.5 text-xs text-rose-600 hover:text-rose-700"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickDevLogin("9876543211")}
                  disabled={authLoading}
                  className="hidden md:inline-flex text-xs border-sky-300 text-sky-700 hover:bg-sky-50"
                >
                  ⚡ Quick Login (SuperSpares)
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setAuthStep("phone");
                    setAuthError("");
                    setShowAuthModal(true);
                  }}
                  className="gap-1.5 text-xs bg-sky-600 hover:bg-sky-700 text-white"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Sign In / OTP</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full space-y-6">
        {!session && (
          <Alert variant="info" title="Supplier Testing Mode Active">
            Sign in as verified distributor{" "}
            <strong>SuperSpares Distribution (9876543211)</strong> using OTP{" "}
            <strong>123456</strong> to manage multi-warehouse stock, upload CSV
            catalogs, and bid on wholesale RFQs.
          </Alert>
        )}

        {/* ================================================================= */}
        {/* TAB 1: LIVE INVENTORY & STOCK ADJUSTMENTS                         */}
        {/* ================================================================= */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-sky-600" />
                  <span>Multi-Warehouse Inventory & Real-Time Stock</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Granular warehouse-level stock partitions, available balances,
                  and atomic movement ledgers.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={loadInventory}
                disabled={inventoryLoading}
                className="gap-2 shrink-0"
              >
                <span>Refresh Balances</span>
              </Button>
            </div>

            {inventoryLoading ? (
              <div className="p-12 text-center text-slate-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sky-600 border-t-transparent" />
                <p className="mt-2 text-xs font-semibold">
                  Loading stock balances...
                </p>
              </div>
            ) : inventoryList.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
                <Package className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-700">
                  No inventory listed yet
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Import stock using the <strong>Bulk CSV</strong> tab or assign
                  stock to your warehouses.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU & Part Details</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Physical Stock</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Reserved</TableHead>
                      <TableHead>Damaged</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Stock Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryList.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <div className="font-bold text-slate-900">
                            {inv.supplierProduct?.masterProduct?.name ||
                              "Automotive Part"}
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            SKU: {inv.supplierProduct?.supplierSku} • Part:{" "}
                            {inv.supplierProduct?.masterProduct?.partNumber}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-700">
                          {inv.warehouse?.name} ({inv.warehouse?.code})
                        </TableCell>
                        <TableCell className="font-bold text-slate-900">
                          {inv.quantity} units
                        </TableCell>
                        <TableCell className="font-bold text-emerald-600">
                          {inv.availableQuantity} units
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {inv.reservedQuantity} units
                        </TableCell>
                        <TableCell className="text-rose-600 font-medium">
                          {inv.damagedQuantity} units
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              inv.availableQuantity > 10
                                ? "success"
                                : inv.availableQuantity > 0
                                  ? "warning"
                                  : "destructive"
                            }
                            className="text-[10px]"
                          >
                            {inv.availableQuantity > 10
                              ? "IN STOCK"
                              : inv.availableQuantity > 0
                                ? "LOW STOCK"
                                : "OUT OF STOCK"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedInventory(inv);
                              setAdjustChangeQty("25");
                              setAdjustError("");
                              setShowAdjustModal(true);
                            }}
                            className="text-xs font-semibold gap-1"
                          >
                            <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
                            <span>Adjust Stock</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: WAREHOUSES & HUBS                                          */}
        {/* ================================================================= */}
        {activeTab === "warehouses" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Warehouse className="w-5 h-5 text-sky-600" />
                  <span>Physical Warehouses & Fulfillment Facilities</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Manage stock fulfillment nodes across urban clusters and
                  regional transit hubs.
                </p>
              </div>
              <Button
                size="md"
                onClick={() => setShowWarehouseModal(true)}
                className="gap-2 bg-sky-600 hover:bg-sky-700 text-white shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Register Warehouse</span>
              </Button>
            </div>

            {warehousesLoading ? (
              <div className="p-12 text-center text-slate-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sky-600 border-t-transparent" />
                <p className="mt-2 text-xs font-semibold">
                  Loading facilities...
                </p>
              </div>
            ) : warehouses.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
                <Warehouse className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-700">
                  No warehouses registered yet
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click <strong>Register Warehouse</strong> to create your first
                  stock dispatch location.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {warehouses.map((wh) => (
                  <Card
                    key={wh.id}
                    className="border-slate-200 bg-white shadow-sm"
                  >
                    <CardHeader className="pb-3 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base font-bold text-slate-900">
                            {wh.name}
                          </CardTitle>
                          <span className="font-mono text-xs text-sky-600 font-bold block mt-0.5">
                            Code: {wh.code}
                          </span>
                        </div>
                        {wh.isPrimary && (
                          <Badge variant="success" className="text-[10px]">
                            Primary Hub
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3 space-y-2 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Address
                        </span>
                        <span className="font-medium text-slate-800">
                          {wh.addressLine1}
                        </span>
                        <span className="block text-slate-500">
                          {wh.city}, {wh.state} - {wh.postalCode}
                        </span>
                      </div>
                      {wh.contactPhone && (
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                            Dispatch Phone
                          </span>
                          <span className="font-medium text-slate-700">
                            {wh.contactPhone}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: STAGED BULK CSV / EXCEL CATALOG IMPORT                     */}
        {/* ================================================================= */}
        {activeTab === "bulk-import" && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-sky-600" />
                <span>Bulk CSV / Excel Catalog Ingestion Engine</span>
              </h2>
              <p className="text-xs text-slate-500">
                Four-stage ingestion: Format validation ➔ Intra-file duplicate
                detection ➔ Master catalog part resolution ➔ Atomic commit.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  CSV Spreadsheet Content (Comma, Tab, or Semicolon Separated)
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCsvContent(defaultCsvSample)}
                  className="text-xs"
                >
                  Load Sample Template
                </Button>
              </div>

              <Textarea
                rows={6}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                className="font-mono text-xs"
              />

              {importError && <Alert variant="error">{importError}</Alert>}
              {executeResult && (
                <Alert variant="success" title="Bulk Import Completed!">
                  Status: <strong>{executeResult.status}</strong> • Processed
                  rows: <strong>{executeResult.totalProcessed}</strong>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  size="md"
                  onClick={handleUploadCsv}
                  disabled={importLoading}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {importLoading
                    ? "Parsing & Staging..."
                    : "1. Stage & Preview Import"}
                </Button>
                {previewJob && (
                  <Button
                    size="md"
                    onClick={handleExecuteCsv}
                    disabled={importLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    2. Commit {previewJob.totalRows} Rows to Inventory
                  </Button>
                )}
              </div>
            </div>

            {/* Preview Staging Report */}
            {previewJob && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Staged Preview: Job {previewJob.id}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Status:{" "}
                      <Badge variant="outline">{previewJob.status}</Badge> •
                      Total Rows: <strong>{previewJob.totalRows}</strong> •
                      Valid:{" "}
                      <strong className="text-emerald-600">
                        {previewJob.validRowsCount}
                      </strong>{" "}
                      • Errors:{" "}
                      <strong className="text-rose-600">
                        {previewJob.errorRowsCount}
                      </strong>
                    </p>
                  </div>
                </div>

                {previewJob.stagedRows && previewJob.stagedRows.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Part Number</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Price (₹)</TableHead>
                        <TableHead>Catalog Match</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewJob.stagedRows.map((r: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-slate-500">
                            #{r.rowNumber}
                          </TableCell>
                          <TableCell className="font-mono font-bold text-slate-800">
                            {r.sku}
                          </TableCell>
                          <TableCell className="font-mono">
                            {r.partNumber}
                          </TableCell>
                          <TableCell>{r.brandName}</TableCell>
                          <TableCell className="font-bold">
                            {r.quantity}
                          </TableCell>
                          <TableCell>
                            ₹{parseFloat(r.sellingPrice).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {r.masterProductId ? (
                              <Badge variant="success" className="text-[10px]">
                                Matched
                              </Badge>
                            ) : (
                              <Badge
                                variant="destructive"
                                className="text-[10px]"
                              >
                                Not in Master
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: B2B WHOLESALE RFQS & BIDDING                               */}
        {/* ================================================================= */}
        {activeTab === "rfqs" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sky-600" />
                  <span>Wholesale Sourcing RFQ Opportunities</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Discover buyer procurement requests across the network and
                  submit wholesale quotations.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={loadNetworkRfqs}
                disabled={rfqsLoading}
                className="gap-2 shrink-0"
              >
                <span>Refresh Opportunities</span>
              </Button>
            </div>

            {rfqsLoading ? (
              <div className="p-12 text-center text-slate-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sky-600 border-t-transparent" />
                <p className="mt-2 text-xs font-semibold">
                  Discovering network RFQs...
                </p>
              </div>
            ) : networkRfqs.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-700">
                  No open wholesale RFQs found
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When verified workshops and garages publish procurement
                  requests, they appear here for bidding.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RFQ Reference</TableHead>
                      <TableHead>Buyer Workshop</TableHead>
                      <TableHead>Requested Part</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Target Price</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {networkRfqs.map((rfq) => (
                      <TableRow key={rfq.id}>
                        <TableCell className="font-mono font-bold text-sky-700">
                          {rfq.rfqNumber}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900">
                          {rfq.buyerBusiness?.tradeName || "Buyer"}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900">
                            {rfq.masterProduct?.name}
                          </div>
                          <span className="text-xs font-mono text-slate-500">
                            {rfq.masterProduct?.partNumber}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {rfq.quantity} units
                        </TableCell>
                        <TableCell className="font-semibold text-slate-700">
                          {rfq.targetPrice
                            ? `₹${parseFloat(rfq.targetPrice).toLocaleString("en-IN")}`
                            : "Open"}
                        </TableCell>
                        <TableCell>
                          {rfq.deliveryCity}, {rfq.deliveryState}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              rfq.status === "AWARDED"
                                ? "success"
                                : rfq.status === "RESPONSES_RECEIVED"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[11px] font-bold"
                          >
                            {rfq.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {rfq.status !== "AWARDED" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedRfq(rfq);
                                setQuoteUnitPrice(
                                  rfq.targetPrice
                                    ? String(rfq.targetPrice)
                                    : "1050",
                                );
                                setQuoteAvailableQty(String(rfq.quantity));
                                setShowQuoteModal(true);
                              }}
                              className="text-xs bg-sky-600 hover:bg-sky-700 text-white gap-1"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>Submit Bid</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: SHIPMENTS & DISPATCH LOGISTICS                             */}
        {/* ================================================================= */}
        {activeTab === "shipments" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-sky-600" />
                  <span>Outgoing Dispatches & Freight Movements</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Manage warehouse departures, carrier handovers, and delivery
                  fulfillment.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={loadShipments}
                disabled={shipmentsLoading}
                className="gap-2 shrink-0"
              >
                <span>Refresh Dispatches</span>
              </Button>
            </div>

            {shipmentsLoading ? (
              <div className="p-12 text-center text-slate-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sky-600 border-t-transparent" />
                <p className="mt-2 text-xs font-semibold">
                  Loading dispatches...
                </p>
              </div>
            ) : shipments.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
                <Truck className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-700">
                  No outgoing shipments
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When you fulfill an awarded RFQ or order, the dispatched
                  shipment will be tracked here.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shipment Number</TableHead>
                      <TableHead>Receiver Workshop</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Current Status</TableHead>
                      <TableHead className="text-right">
                        Carrier Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipments.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono font-bold text-sky-700">
                          {s.shipmentNumber}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900">
                          {s.receiverBusiness?.tradeName || "Buyer Workshop"}
                        </TableCell>
                        <TableCell>
                          {s.deliveryCity}, {s.deliveryState}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              s.status === "DELIVERED"
                                ? "success"
                                : s.status === "IN_TRANSIT"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[11px] font-bold"
                          >
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {s.status !== "DELIVERED" &&
                            s.status !== "CANCELLED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleProgressStatus(s.id, s.status)
                                }
                                className="text-xs font-semibold"
                              >
                                Advance State ➔
                              </Button>
                            )}
                          {s.status === "DELIVERED" && (
                            <span className="text-xs font-bold text-emerald-600 flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> POD
                              Verified
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* MODAL 1: AUTHENTICATION / OTP LOGIN MODAL                           */}
      {/* =================================================================== */}
      <Modal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Supplier OS Verification"
        description="Verify your Indian supplier mobile number via OTP."
        maxWidth="md"
      >
        <div className="space-y-4">
          {authError && <Alert variant="error">{authError}</Alert>}

          {authStep === "phone" && (
            <div className="space-y-4">
              <Input
                label="Mobile Phone Number"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="10-digit mobile (e.g. 9876543211)"
                helperText="Standard development test account: 9876543211 (SuperSpares)"
              />
              <Button
                onClick={handleRequestOtp}
                disabled={authLoading}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white"
              >
                {authLoading ? "Sending OTP..." : "Request OTP Code"}
              </Button>
            </div>
          )}

          {authStep === "otp" && (
            <div className="space-y-4">
              <Alert variant="info" title="Dev Test OTP Ready">
                In local development, enter <strong>123456</strong> or the OTP
                printed in your server logs.
              </Alert>
              <Input
                label="6-Digit Verification Code"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="123456"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAuthStep("phone")}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleVerifyOtp}
                  disabled={authLoading}
                  className="flex-1 bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {authLoading ? "Verifying..." : "Verify & Sign In"}
                </Button>
              </div>
            </div>
          )}

          {authStep === "business" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 font-semibold">
                Select your active supplier workspace:
              </p>
              {userBusinesses.map((b) => (
                <div
                  key={b.id}
                  onClick={() => {
                    const newSession: StoredSession = {
                      accessToken: tempToken,
                      refreshToken: "",
                      user: tempUser,
                      business: {
                        id: b.id,
                        tradeName: b.tradeName,
                        legalName: b.legalName,
                        role: b.role,
                      },
                    };
                    saveSession(newSession);
                    setSession(newSession);
                    setShowAuthModal(false);
                  }}
                  className="p-3 border rounded-lg hover:border-sky-500 cursor-pointer bg-slate-50 transition-colors"
                >
                  <div className="text-sm font-bold text-slate-900">
                    {b.tradeName}
                  </div>
                  <div className="text-xs text-slate-500">
                    GSTIN: {b.gstNumber || "N/A"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 2: REGISTER WAREHOUSE MODAL                                   */}
      {/* =================================================================== */}
      <Modal
        isOpen={showWarehouseModal}
        onClose={() => setShowWarehouseModal(false)}
        title="Register Supplier Warehouse"
        description="Create a new physical storage and dispatch hub for your business."
        maxWidth="md"
      >
        <form onSubmit={handleCreateWarehouse} className="space-y-4 text-xs">
          <Input
            label="Warehouse Facility Name"
            value={whName}
            onChange={(e) => setWhName(e.target.value)}
            placeholder="e.g. Mayapuri Central Depot"
            required
          />
          <Input
            label="Warehouse Code (Unique per tenant)"
            value={whCode}
            onChange={(e) => setWhCode(e.target.value)}
            placeholder="e.g. WH-DEL-02"
            required
          />
          <Input
            label="Street Address"
            value={whAddress}
            onChange={(e) => setWhAddress(e.target.value)}
            placeholder="Plot / Industrial Area"
            required
          />
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="City"
              value={whCity}
              onChange={(e) => setWhCity(e.target.value)}
              required
            />
            <Input
              label="State"
              value={whState}
              onChange={(e) => setWhState(e.target.value)}
              required
            />
            <Input
              label="PIN Code"
              value={whPostalCode}
              onChange={(e) => setWhPostalCode(e.target.value)}
              required
            />
          </div>
          <Input
            label="Contact Phone"
            value={whPhone}
            onChange={(e) => setWhPhone(e.target.value)}
          />

          <div className="pt-3 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowWarehouseModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={whSubmitting}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {whSubmitting ? "Creating..." : "Save Warehouse"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 3: ADJUST INVENTORY MODAL                                     */}
      {/* =================================================================== */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="Adjust Warehouse Inventory"
        description={`Item: ${selectedInventory?.supplierProduct?.masterProduct?.name || ""} (${selectedInventory?.warehouse?.name || ""})`}
        maxWidth="md"
      >
        <form onSubmit={handleAdjustStock} className="space-y-4 text-xs">
          {adjustError && <Alert variant="error">{adjustError}</Alert>}

          <div className="bg-slate-50 p-3 rounded-lg border text-xs grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-500 block">
                Current Physical Quantity
              </span>
              <span className="font-bold text-slate-900">
                {selectedInventory?.quantity} units
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">
                Current Available Stock
              </span>
              <span className="font-bold text-emerald-600">
                {selectedInventory?.availableQuantity} units
              </span>
            </div>
          </div>

          <Input
            label="Quantity Change (+ for receipt, - for deduction)"
            type="number"
            value={adjustChangeQty}
            onChange={(e) => setAdjustChangeQty(e.target.value)}
            helperText="e.g. +25 for shipment arrival, -5 for damaged parts"
            required
          />

          <Select
            label="Movement Reason"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
          >
            <option value="PURCHASE_RECEIPT">Purchase Receipt (Restock)</option>
            <option value="CORRECTION">Inventory Audit Correction</option>
            <option value="DAMAGED_IN_WAREHOUSE">Damaged in Warehouse</option>
            <option value="RETURN_RESTOCK">Customer Return Restock</option>
          </Select>

          <Input
            label="Audit Notes / Reference"
            value={adjustNotes}
            onChange={(e) => setAdjustNotes(e.target.value)}
            placeholder="e.g. PO-2026-99 or physical count adjustment"
          />

          <div className="pt-3 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAdjustModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={adjustSubmitting}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {adjustSubmitting ? "Adjusting..." : "Commit Stock Adjustment"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 4: SUBMIT QUOTATION MODAL                                     */}
      {/* =================================================================== */}
      <Modal
        isOpen={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        title="Submit Wholesale Quotation"
        description={`RFQ: ${selectedRfq?.rfqNumber || ""} • Part: ${selectedRfq?.masterProduct?.name || ""}`}
        maxWidth="md"
      >
        <form onSubmit={handleSubmitQuotation} className="space-y-4 text-xs">
          {quoteError && <Alert variant="error">{quoteError}</Alert>}
          {quoteSuccess && <Alert variant="success">{quoteSuccess}</Alert>}

          <div className="bg-slate-50 p-3 rounded-lg border grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-500 block">Requested Quantity</span>
              <span className="font-bold text-slate-900">
                {selectedRfq?.quantity} units
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Buyer Target Price</span>
              <span className="font-bold text-slate-900">
                {selectedRfq?.targetPrice
                  ? `₹${parseFloat(selectedRfq.targetPrice).toLocaleString("en-IN")}`
                  : "Open"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quoted Unit Price (₹)"
              type="number"
              min="1"
              value={quoteUnitPrice}
              onChange={(e) => setQuoteUnitPrice(e.target.value)}
              required
            />
            <Input
              label="Available Quantity"
              type="number"
              min="1"
              value={quoteAvailableQty}
              onChange={(e) => setQuoteAvailableQty(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Minimum Order Quantity (MOQ)"
              type="number"
              min="1"
              value={quoteMoq}
              onChange={(e) => setQuoteMoq(e.target.value)}
              required
            />
            <Input
              label="Lead Time (Days to dispatch)"
              type="number"
              min="1"
              value={quoteLeadTime}
              onChange={(e) => setQuoteLeadTime(e.target.value)}
              required
            />
          </div>

          <Input
            label="Commercial Terms / Notes"
            value={quoteNotes}
            onChange={(e) => setQuoteNotes(e.target.value)}
          />

          <div className="pt-3 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowQuoteModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={quoteSubmitting}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {quoteSubmitting ? "Submitting..." : "Submit Quotation"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
