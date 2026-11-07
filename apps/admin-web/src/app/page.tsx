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
  ShieldAlert,
  Navigation,
  Database,
  Activity,
  PlusCircle,
  Truck,
  CheckCircle2,
  LogOut,
  User,
  Search,
} from "lucide-react";
import {
  apiFetch,
  getSession,
  saveSession,
  clearSession,
  type StoredSession,
} from "../lib/api";

export default function AdminControlCentrePage() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "catalog" | "providers" | "shipments"
  >("overview");

  // Auth State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authStep, setAuthStep] = useState<"phone" | "otp">("phone");
  const [phoneInput, setPhoneInput] = useState("9999999999");
  const [otpInput, setOtpInput] = useState("123456");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Catalog State
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [prodName, setProdName] = useState("");
  const [prodPartNumber, setProdPartNumber] = useState("");
  const [prodOemNumber, setProdOemNumber] = useState("");
  const [prodBrandName, setProdBrandName] = useState("BOSCH");
  const [prodCategorySlug, setProdCategorySlug] = useState("brake-pads");
  const [prodCondition, setProdCondition] = useState("AFTERMARKET");
  const [prodDescription, setProdDescription] = useState("");
  const [prodSubmitting, setProdSubmitting] = useState(false);
  const [prodError, setProdError] = useState("");

  // Logistics Providers State
  const [providers, setProviders] = useState<any[]>([]);
  const [_providersLoading, setProvidersLoading] = useState(false);
  const [showAddProviderModal, setShowAddProviderModal] = useState(false);
  const [provName, setProvName] = useState("");
  const [provCode, setProvCode] = useState("");
  const [provType, setProvType] = useState("THIRD_PARTY_3PL");
  const [provPhone, setProvPhone] = useState("9876543210");
  const [provEmail, setProvEmail] = useState(
    "operations@delhivery.example.com",
  );
  const [provTemplate, setProvTemplate] = useState(
    "https://www.delhivery.com/track/package/{{trackingNumber}}",
  );
  const [provSubmitting, setProvSubmitting] = useState(false);

  // Global Shipments State
  const [allShipments, setAllShipments] = useState<any[]>([]);
  const [_shipmentsLoading, setShipmentsLoading] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (s) setSession(s);
  }, []);

  // Fetch Catalog
  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    let url = "/catalog/products?limit=25";
    if (catalogSearch) url += `&q=${encodeURIComponent(catalogSearch)}`;
    const res = await apiFetch<any>(url);
    if (res.success && res.data) {
      setCatalogProducts(res.data.items || res.data || []);
    }
    setCatalogLoading(false);
  }, [catalogSearch]);

  // Fetch Logistics Providers
  const loadProviders = useCallback(async () => {
    setProvidersLoading(true);
    const res = await apiFetch<any>("/logistics/providers");
    if (res.success && res.data) {
      setProviders(res.data.items || res.data || []);
    }
    setProvidersLoading(false);
  }, []);

  // Fetch All Shipments
  const loadShipments = useCallback(async () => {
    setShipmentsLoading(true);
    const res = await apiFetch<any>("/logistics/shipments");
    if (res.success && res.data) {
      setAllShipments(res.data.items || res.data || []);
    }
    setShipmentsLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "catalog") loadCatalog();
    if (activeTab === "providers") loadProviders();
    if (activeTab === "shipments" || activeTab === "overview") {
      loadShipments();
      loadProviders();
      loadCatalog();
    }
  }, [activeTab, loadCatalog, loadProviders, loadShipments]);

  // Quick Dev Login as Super Admin
  const handleQuickAdminLogin = async (phone = "9999999999") => {
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
      const newSession: StoredSession = {
        accessToken,
        refreshToken,
        user,
      };
      saveSession(newSession);
      setSession(newSession);
      setShowAuthModal(false);
    } else {
      setAuthError(verifyRes.error?.message || "Admin login failed.");
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
      const newSession: StoredSession = {
        accessToken,
        refreshToken,
        user,
      };
      saveSession(newSession);
      setSession(newSession);
      setShowAuthModal(false);
    } else {
      setAuthError(res.error?.message || "Invalid OTP code");
    }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  // Create Master Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdSubmitting(true);
    setProdError("");

    const payload = {
      name: prodName,
      partNumber: prodPartNumber,
      oemNumber: prodOemNumber || undefined,
      brandName: prodBrandName,
      categorySlug: prodCategorySlug,
      conditionType: prodCondition,
      description: prodDescription,
      isSafetyCritical: false,
    };

    const res = await apiFetch<any>("/catalog/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setShowAddProductModal(false);
      setProdName("");
      setProdPartNumber("");
      setProdOemNumber("");
      setProdDescription("");
      loadCatalog();
    } else {
      setProdError(res.error?.message || "Product creation failed");
    }
    setProdSubmitting(false);
  };

  // Register Logistics Provider
  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvSubmitting(true);
    const payload = {
      name: provName,
      code: provCode.toUpperCase(),
      type: provType,
      contactPhone: provPhone,
      contactEmail: provEmail,
      trackingUrlTemplate: provTemplate,
    };

    const res = await apiFetch<any>("/logistics/providers", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setShowAddProviderModal(false);
      setProvName("");
      setProvCode("");
      loadProviders();
    } else {
      alert(`Provider registration failed: ${res.error?.message}`);
    }
    setProvSubmitting(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight flex items-center gap-1.5">
              <span className="bg-rose-600 text-white px-2 py-0.5 rounded text-sm font-extrabold tracking-normal">
                ASN
              </span>
              <span>AdminCentre</span>
            </span>
            <Badge
              variant="destructive"
              className="hidden sm:inline-flex text-xs"
            >
              Platform Governance & SLA Control
            </Badge>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "overview"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Surveillance</span>
            </button>
            <button
              onClick={() => setActiveTab("catalog")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "catalog"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Catalog Part Master</span>
            </button>
            <button
              onClick={() => setActiveTab("providers")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "providers"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Logistics Partners</span>
            </button>
            <button
              onClick={() => setActiveTab("shipments")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "shipments"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>All Shipments</span>
            </button>
          </nav>

          {/* User Auth Section */}
          <div className="flex items-center gap-2">
            {session ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-100 leading-tight">
                    {session.user.firstName || "Super Admin"}
                  </div>
                  <div className="text-[10px] text-rose-400 font-medium">
                    PLATFORM_SUPER_ADMIN
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="gap-1.5 text-xs border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
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
                  onClick={() => handleQuickAdminLogin("9999999999")}
                  disabled={authLoading}
                  className="hidden md:inline-flex text-xs border-rose-500/40 text-rose-400 hover:bg-rose-950/30"
                >
                  ⚡ Quick Admin Login
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setAuthStep("phone");
                    setAuthError("");
                    setShowAuthModal(true);
                  }}
                  className="gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Admin Login</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full space-y-6">
        {!session && (
          <Alert variant="warning" title="Platform Governance Resticted">
            Authenticate using Super Administrator account{" "}
            <strong>9999999999</strong> and OTP <strong>123456</strong> for
            platform governance, catalog creation, carrier provisioning, and
            global surveillance.
          </Alert>
        )}

        {/* ================================================================= */}
        {/* TAB 1: PLATFORM SURVEILLANCE & OVERVIEW                           */}
        {/* ================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <span>Automotive Supply Network — Operations Overview</span>
              </h2>
              <p className="text-xs text-slate-500">
                Real-time operational monitoring across buyers, wholesale
                suppliers, and logistics partners.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-slate-200 bg-white">
                <CardHeader className="pb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Catalog Parts
                  </span>
                  <CardTitle className="text-2xl pt-1 flex items-center gap-2 text-slate-900">
                    <Database className="w-5 h-5 text-sky-600" />{" "}
                    {catalogProducts.length} Active
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-slate-600">
                    Standardized OEM & aftermarket parts
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white">
                <CardHeader className="pb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Logistics Providers
                  </span>
                  <CardTitle className="text-2xl pt-1 flex items-center gap-2 text-slate-900">
                    <Truck className="w-5 h-5 text-emerald-600" />{" "}
                    {providers.length} Integrated
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-emerald-600 font-semibold">
                    3PL, Freight & Hyperlocal carriers
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white">
                <CardHeader className="pb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Active Shipments
                  </span>
                  <CardTitle className="text-2xl pt-1 flex items-center gap-2 text-slate-900">
                    <Navigation className="w-5 h-5 text-amber-600" />{" "}
                    {allShipments.length} Tracked
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-slate-600">
                    Multi-leg transit surveillance
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white">
                <CardHeader className="pb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Cluster Status
                  </span>
                  <CardTitle className="text-2xl pt-1 flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" /> 100% SLA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-slate-600">
                    Delhi NCR & Mumbai Hubs Online
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: MASTER CATALOG GOVERNANCE                                  */}
        {/* ================================================================= */}
        {activeTab === "catalog" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-rose-600" />
                  <span>Master Automotive Catalog Governance</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Manage canonical part master definitions, normalized part
                  numbers, and vehicle fitment mappings.
                </p>
              </div>
              <Button
                size="md"
                onClick={() => setShowAddProductModal(true)}
                className="gap-2 bg-rose-600 hover:bg-rose-700 text-white shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Master Product</span>
              </Button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search master catalog by Part No, OEM, Brand..."
                className="w-full text-xs outline-none"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={loadCatalog}
                disabled={catalogLoading}
              >
                Search
              </Button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part Number</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>OEM Reference</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalogProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono font-bold text-slate-900">
                        {p.partNumber}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {p.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-bold"
                        >
                          {p.brand?.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        {p.oemNumber || "N/A"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {p.category?.name || "General"}
                      </TableCell>
                      <TableCell className="text-xs font-semibold">
                        {p.conditionType}
                      </TableCell>
                      <TableCell>
                        <Badge variant="success" className="text-[10px]">
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: LOGISTICS CARRIER PROVIDERS                                */}
        {/* ================================================================= */}
        {activeTab === "providers" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-rose-600" />
                  <span>Logistics Carrier Registry</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Manage third-party 3PLs, intercity line-hauls, and ASN-managed
                  hyperlocal delivery fleets.
                </p>
              </div>
              <Button
                size="md"
                onClick={() => setShowAddProviderModal(true)}
                className="gap-2 bg-rose-600 hover:bg-rose-700 text-white shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Register Carrier</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {providers.map((p) => (
                <Card
                  key={p.id}
                  className="border-slate-200 bg-white shadow-sm"
                >
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900">
                          {p.name}
                        </CardTitle>
                        <span className="font-mono text-xs text-sky-600 font-bold block mt-0.5">
                          Code: {p.providerCode}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {p.providerType}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-2 text-xs text-slate-600">
                    {p.contactPhone && (
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Phone
                        </span>
                        <span className="font-medium text-slate-700">
                          {p.contactPhone}
                        </span>
                      </div>
                    )}
                    {p.contactEmail && (
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Email
                        </span>
                        <span className="font-medium text-slate-700">
                          {p.contactEmail}
                        </span>
                      </div>
                    )}
                    {p.trackingUrlTemplate && (
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Tracking URL Template
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 truncate block">
                          {p.trackingUrlTemplate}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: PLATFORM SHIPMENT SURVEILLANCE & POD                       */}
        {/* ================================================================= */}
        {activeTab === "shipments" && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-rose-600" />
                <span>Global Shipment Surveillance Ledger</span>
              </h2>
              <p className="text-xs text-slate-500">
                Cross-tenant freight visibility spanning supplier dispatch,
                multi-leg hubs, and workshop Proof of Delivery.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment Number</TableHead>
                    <TableHead>Sender Supplier</TableHead>
                    <TableHead>Receiver Workshop</TableHead>
                    <TableHead>Pickup City</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Proof of Delivery</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allShipments.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono font-bold text-sky-700">
                        {s.shipmentNumber}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {s.senderBusiness?.tradeName || "Supplier"}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {s.receiverBusiness?.tradeName || "Workshop"}
                      </TableCell>
                      <TableCell>{s.pickupCity}</TableCell>
                      <TableCell>{s.deliveryCity}</TableCell>
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
                      <TableCell>
                        {s.proofOfDelivery ? (
                          <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              Signed: {s.proofOfDelivery.recipientName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Pending Delivery
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* MODAL 1: AUTH MODAL                                                 */}
      {/* =================================================================== */}
      <Modal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Super Admin Verification"
        description="Verify platform administrator mobile number via OTP."
        maxWidth="md"
      >
        <div className="space-y-4">
          {authError && <Alert variant="error">{authError}</Alert>}

          {authStep === "phone" && (
            <div className="space-y-4">
              <Input
                label="Admin Mobile Phone"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="9999999999"
                helperText="Preconfigured Super Administrator test account: 9999999999"
              />
              <Button
                onClick={handleRequestOtp}
                disabled={authLoading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white"
              >
                {authLoading ? "Sending OTP..." : "Request OTP Code"}
              </Button>
            </div>
          )}

          {authStep === "otp" && (
            <div className="space-y-4">
              <Alert variant="info" title="Dev Test OTP Ready">
                In local development mode, enter <strong>123456</strong> or the
                OTP printed in your server logs.
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
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {authLoading ? "Verifying..." : "Verify & Sign In"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 2: CREATE MASTER PRODUCT MODAL                                */}
      {/* =================================================================== */}
      <Modal
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        title="Create Canonical Master Product"
        description="Add a universal automotive part definition to the platform catalog."
        maxWidth="md"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          {prodError && <Alert variant="error">{prodError}</Alert>}

          <Input
            label="Product Name"
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            placeholder="e.g. Bosch Rear Brake Shoe Set"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Manufacturer Part Number"
              value={prodPartNumber}
              onChange={(e) => setProdPartNumber(e.target.value)}
              placeholder="e.g. 0986AB9999"
              required
            />
            <Input
              label="OEM Cross Reference Number"
              value={prodOemNumber}
              onChange={(e) => setProdOemNumber(e.target.value)}
              placeholder="e.g. 58305-1RA00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Brand"
              value={prodBrandName}
              onChange={(e) => setProdBrandName(e.target.value)}
            >
              <option value="BOSCH">Bosch</option>
              <option value="MAHLE">Mahle</option>
              <option value="VALEO">Valeo</option>
              <option value="DENSO">Denso</option>
            </Select>

            <Select
              label="Category"
              value={prodCategorySlug}
              onChange={(e) => setProdCategorySlug(e.target.value)}
            >
              <option value="brake-pads">Brake Pads</option>
              <option value="oil-filters">Oil Filters</option>
              <option value="spark-plugs">Spark Plugs</option>
            </Select>
          </div>

          <Select
            label="Condition Type"
            value={prodCondition}
            onChange={(e) => setProdCondition(e.target.value)}
          >
            <option value="AFTERMARKET">Aftermarket</option>
            <option value="OES">Original Equipment Supplier (OES)</option>
            <option value="OEM">Original Equipment Manufacturer (OEM)</option>
          </Select>

          <Textarea
            label="Technical Description"
            value={prodDescription}
            onChange={(e) => setProdDescription(e.target.value)}
            placeholder="Key product attributes and specifications..."
          />

          <div className="pt-3 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddProductModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={prodSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {prodSubmitting ? "Creating..." : "Save Master Product"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 3: REGISTER LOGISTICS CARRIER MODAL                           */}
      {/* =================================================================== */}
      <Modal
        isOpen={showAddProviderModal}
        onClose={() => setShowAddProviderModal(false)}
        title="Register Logistics Carrier Partner"
        description="Add a 3PL partner, freight line-haul, or internal fleet provider."
        maxWidth="md"
      >
        <form onSubmit={handleCreateProvider} className="space-y-4 text-xs">
          <Input
            label="Carrier Name"
            value={provName}
            onChange={(e) => setProvName(e.target.value)}
            placeholder="e.g. Blue Dart Surface Express"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Provider Code (Unique)"
              value={provCode}
              onChange={(e) => setProvCode(e.target.value)}
              placeholder="e.g. BLUEDART_EXP"
              required
            />
            <Select
              label="Provider Type"
              value={provType}
              onChange={(e) => setProvType(e.target.value)}
            >
              <option value="THIRD_PARTY_3PL">Third-Party 3PL</option>
              <option value="INTERNAL_FLEET">Internal Fleet</option>
              <option value="HYPERLOCAL">Hyperlocal Fleet</option>
              <option value="INTERCITY_FREIGHT">Intercity Line-Haul</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Phone"
              value={provPhone}
              onChange={(e) => setProvPhone(e.target.value)}
            />
            <Input
              label="Contact Email"
              value={provEmail}
              onChange={(e) => setProvEmail(e.target.value)}
            />
          </div>

          <Input
            label="Carrier Tracking URL Template"
            value={provTemplate}
            onChange={(e) => setProvTemplate(e.target.value)}
            placeholder="https://example.com/track/{{trackingNumber}}"
          />

          <div className="pt-3 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddProviderModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={provSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {provSubmitting ? "Registering..." : "Save Carrier"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
