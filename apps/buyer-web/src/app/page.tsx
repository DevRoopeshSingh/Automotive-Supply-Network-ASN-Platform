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
  Search,
  Car,
  Package,
  Clock,
  Truck,
  Award,
  CheckCircle2,
  LogOut,
  User,
  PlusCircle,
  FileText,
} from "lucide-react";
import {
  apiFetch,
  getSession,
  saveSession,
  clearSession,
  type StoredSession,
} from "../lib/api";

export default function BuyerPortalPage() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [activeTab, setActiveTab] = useState<"catalog" | "rfqs" | "shipments">(
    "catalog",
  );

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authStep, setAuthStep] = useState<"phone" | "otp" | "business">(
    "phone",
  );
  const [phoneInput, setPhoneInput] = useState("9876543210");
  const [otpInput, setOtpInput] = useState("123456");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [tempUser, setTempUser] = useState<any>(null);
  const [userBusinesses, setUserBusinesses] = useState<any[]>([]);

  // Catalog State
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // RFQ Creation State
  const [showRfqModal, setShowRfqModal] = useState(false);
  const [rfqProductId, setRfqProductId] = useState("");
  const [rfqQuantity, setRfqQuantity] = useState("50");
  const [rfqTargetPrice, setRfqTargetPrice] = useState("1100");
  const [rfqAddress, setRfqAddress] = useState(
    "Shop 4-6, Phase 2, Okhla Industrial Area",
  );
  const [rfqCity, setRfqCity] = useState("New Delhi");
  const [rfqState, setRfqState] = useState("Delhi");
  const [rfqPostalCode, setRfqPostalCode] = useState("110020");
  const [rfqNotes, setRfqNotes] = useState(
    "Urgent replenishment for fleet service",
  );
  const [rfqSubmitting, setRfqSubmitting] = useState(false);
  const [rfqSuccessMsg, setRfqSuccessMsg] = useState("");
  const [rfqErrorMsg, setRfqErrorMsg] = useState("");

  // Buyer RFQs State
  const [buyerRfqs, setBuyerRfqs] = useState<any[]>([]);
  const [rfqsLoading, setRfqsLoading] = useState(false);
  const [selectedRfqComparison, setSelectedRfqComparison] = useState<
    any | null
  >(null);
  const [_comparisonLoading, setComparisonLoading] = useState(false);
  const [awardSubmitting, setAwardSubmitting] = useState(false);

  // Shipments State
  const [shipments, setShipments] = useState<any[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);

  // Load session on mount
  useEffect(() => {
    const s = getSession();
    if (s) {
      setSession(s);
    }
  }, []);

  // Fetch Catalog Products
  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    let url = "/catalog/products?limit=20";
    if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
    if (categoryFilter)
      url += `&categorySlug=${encodeURIComponent(categoryFilter)}`;

    const res = await apiFetch<any>(url);
    if (res.success && res.data) {
      setProducts(res.data.items || res.data || []);
    } else {
      setProducts([]);
    }
    setCatalogLoading(false);
  }, [searchQuery, categoryFilter]);

  // Fetch Buyer RFQs
  const loadBuyerRfqs = useCallback(async () => {
    if (!session?.business?.id) return;
    setRfqsLoading(true);
    const res = await apiFetch<any>("/supplier/ssn/rfqs");
    if (res.success && res.data) {
      setBuyerRfqs(res.data.items || res.data || []);
    }
    setRfqsLoading(false);
  }, [session]);

  // Fetch Shipments
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
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (activeTab === "rfqs") loadBuyerRfqs();
    if (activeTab === "shipments") loadShipments();
  }, [activeTab, loadBuyerRfqs, loadShipments]);

  // Quick Dev Login as Apex Workshop
  const handleQuickDevLogin = async (phone = "9876543210") => {
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
      // Fetch user's businesses
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
        setAuthError("No business found. Please register business first.");
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

  // Logout
  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  // Create RFQ
  const handleCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    setRfqSubmitting(true);
    setRfqErrorMsg("");
    setRfqSuccessMsg("");

    const payload = {
      masterProductId: rfqProductId,
      quantity: parseInt(rfqQuantity, 10),
      targetPrice: rfqTargetPrice ? parseFloat(rfqTargetPrice) : undefined,
      deliveryAddress: rfqAddress,
      deliveryCity: rfqCity,
      deliveryState: rfqState,
      deliveryPostalCode: rfqPostalCode,
      deliveryDeadline: new Date(Date.now() + 7 * 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      notes: rfqNotes,
    };

    const res = await apiFetch<any>("/supplier/ssn/rfqs", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setRfqSuccessMsg(
        `Wholesale RFQ published successfully: ${res.data?.rfqNumber || "Published"}`,
      );
      setTimeout(() => {
        setShowRfqModal(false);
        setRfqSuccessMsg("");
        setActiveTab("rfqs");
        loadBuyerRfqs();
      }, 1500);
    } else {
      setRfqErrorMsg(res.error?.message || "Failed to create RFQ");
    }
    setRfqSubmitting(false);
  };

  // View Quotation Comparison Matrix
  const handleViewComparison = async (rfqId: string) => {
    setComparisonLoading(true);
    const res = await apiFetch<any>(`/supplier/ssn/rfqs/${rfqId}/compare`);
    if (res.success && res.data) {
      setSelectedRfqComparison(res.data);
    }
    setComparisonLoading(false);
  };

  // Award Quotation
  const handleAwardQuotation = async (rfqId: string, quotationId: string) => {
    if (
      !confirm(
        "Are you sure you want to award this quotation? This will atomically reject competing bids.",
      )
    ) {
      return;
    }
    setAwardSubmitting(true);
    const res = await apiFetch<any>(`/supplier/ssn/rfqs/${rfqId}/award`, {
      method: "POST",
      body: JSON.stringify({ quotationId }),
    });
    if (res.success) {
      alert("Quotation awarded successfully! Sourcing request is now AWARDED.");
      setSelectedRfqComparison(null);
      loadBuyerRfqs();
    } else {
      alert(`Award failed: ${res.error?.message}`);
    }
    setAwardSubmitting(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
              <span className="bg-sky-600 text-white px-2 py-0.5 rounded text-sm font-extrabold tracking-normal">
                ASN
              </span>
              <span>Marketplace</span>
            </span>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex text-xs bg-slate-50"
            >
              Delhi NCR Cluster
            </Badge>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("catalog")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "catalog"
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Catalog & Parts</span>
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
              <span>Wholesale RFQs</span>
              {buyerRfqs.length > 0 && (
                <span className="bg-sky-100 text-sky-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {buyerRfqs.length}
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
              <span>Deliveries</span>
              {shipments.length > 0 && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {shipments.length}
                </span>
              )}
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
                    {session.business?.role || "BUYER"} •{" "}
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
                  onClick={() => handleQuickDevLogin("9876543210")}
                  disabled={authLoading}
                  className="hidden md:inline-flex text-xs border-sky-300 text-sky-700 hover:bg-sky-50"
                >
                  ⚡ Quick Login (Apex Workshop)
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
        {/* Banner Alert for Unauthenticated Users */}
        {!session && (
          <Alert variant="info" title="Testing & QA Access Active">
            You are browsing in guest mode. Sign in with test account{" "}
            <strong>9876543210</strong> (Apex Multi-Brand Workshop) using OTP{" "}
            <strong>123456</strong> to create RFQs, compare bids, and track
            deliveries.
          </Alert>
        )}

        {/* ================================================================= */}
        {/* TAB 1: CATALOG & VEHICLE COMPATIBILITY SEARCH                     */}
        {/* ================================================================= */}
        {activeTab === "catalog" && (
          <div className="space-y-6">
            {/* Search Header Bar */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="flex-1 relative w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Part Number (0986AB1234), OEM (26300-35505), or Brand (Bosch, Mahle)..."
                    className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="h-10 px-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">All Categories</option>
                    <option value="brake-pads">Brake Pads</option>
                    <option value="oil-filters">Oil Filters</option>
                    <option value="spark-plugs">Spark Plugs</option>
                  </select>
                  <Button
                    size="md"
                    onClick={loadCatalog}
                    disabled={catalogLoading}
                    className="gap-2 shrink-0 bg-sky-600 hover:bg-sky-700 text-white"
                  >
                    <Search className="w-4 h-4" />
                    <span>Search Parts</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-sky-600" /> Popular Vehicle
                  Fitments:
                </span>
                <button
                  onClick={() => setSearchQuery("Hyundai Creta")}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Hyundai Creta (2020+)
                </button>
                <button
                  onClick={() => setSearchQuery("Maruti Suzuki Swift")}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Maruti Suzuki Swift (2018+)
                </button>
                <button
                  onClick={() => setSearchQuery("Brake Pad")}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Ceramic Brake Pads
                </button>
              </div>
            </div>

            {/* Products Grid */}
            {catalogLoading ? (
              <div className="p-12 text-center text-slate-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sky-600 border-t-transparent" />
                <p className="mt-2 text-xs font-semibold">
                  Searching Automotive Part Master...
                </p>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
                <Package className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-700">
                  No matching parts found
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Try searching for standardized part numbers like{" "}
                  <strong>0986AB1234</strong>, OEM numbers like{" "}
                  <strong>26300-35505</strong>, or brands like{" "}
                  <strong>Bosch</strong> or <strong>Mahle</strong>.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {products.map((p) => (
                  <Card
                    key={p.id}
                    className="hover:shadow-md transition-shadow border-slate-200 bg-white"
                  >
                    <CardHeader className="pb-3 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold uppercase mb-1"
                          >
                            {p.brand?.name || "Genuine OEM"}
                          </Badge>
                          <CardTitle className="text-sm font-bold text-slate-900 leading-snug">
                            {p.name}
                          </CardTitle>
                        </div>
                        <Badge
                          variant={
                            p.conditionType === "OES" ? "secondary" : "outline"
                          }
                          className="text-[10px] shrink-0 font-semibold"
                        >
                          {p.conditionType || "AFTERMARKET"}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                            Part Number
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {p.partNumber}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                            OEM Reference
                          </span>
                          <span className="font-mono text-slate-700">
                            {p.oemNumber || "N/A"}
                          </span>
                        </div>
                      </div>

                      {p.category && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="text-slate-400">Category:</span>
                          <span className="font-medium text-slate-700">
                            {p.category.name}
                          </span>
                        </div>
                      )}

                      {p.fitments && p.fitments.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase flex items-center gap-1">
                            <Car className="w-3 h-3 text-sky-600" /> Verified
                            Fitments:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {p.fitments
                              .slice(0, 2)
                              .map((f: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-sky-50 text-sky-800 border border-sky-100"
                                >
                                  {f.vehicleVariant?.model?.make?.name}{" "}
                                  {f.vehicleVariant?.model?.name}
                                </span>
                              ))}
                            {p.fitments.length > 2 && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                +{p.fitments.length - 2} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 flex items-center gap-2 border-t border-slate-100">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedProduct(p)}
                          className="flex-1 text-xs"
                        >
                          Specs & Fitment
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setRfqProductId(p.id);
                            setShowRfqModal(true);
                          }}
                          className="flex-1 text-xs bg-sky-600 hover:bg-sky-700 text-white gap-1"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Raise RFQ</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: BUYER WHOLESALE RFQS & QUOTATION COMPARISON                */}
        {/* ================================================================= */}
        {activeTab === "rfqs" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sky-600" />
                  <span>Wholesale Sourcing RFQs</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Track B2B quotations from verified suppliers, compare unit
                  prices and delivery timelines, and award orders.
                </p>
              </div>
              <Button
                size="md"
                onClick={() => {
                  if (products.length > 0) setRfqProductId(products[0].id);
                  setShowRfqModal(true);
                }}
                className="gap-2 bg-sky-600 hover:bg-sky-700 text-white shadow-sm shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create New RFQ</span>
              </Button>
            </div>

            {rfqsLoading ? (
              <div className="p-12 text-center text-slate-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sky-600 border-t-transparent" />
                <p className="mt-2 text-xs font-semibold">
                  Loading wholesale requests...
                </p>
              </div>
            ) : buyerRfqs.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-700">
                  No active RFQs created yet
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Browse the master catalog and click <strong>Raise RFQ</strong>{" "}
                  to initiate a wholesale quotation request to verified
                  distributors.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RFQ Reference</TableHead>
                      <TableHead>Target Part</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Target Price</TableHead>
                      <TableHead>Delivery City</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buyerRfqs.map((rfq) => (
                      <TableRow key={rfq.id}>
                        <TableCell className="font-mono font-bold text-sky-700">
                          {rfq.rfqNumber}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900 leading-tight">
                            {rfq.masterProduct?.name || "Automotive Part"}
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewComparison(rfq.id)}
                            className="text-xs font-semibold gap-1.5"
                          >
                            <Award className="w-3.5 h-3.5 text-sky-600" />
                            <span>Compare Bids</span>
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
        {/* TAB 3: SHIPMENTS & DELIVERY TRACKING                              */}
        {/* ================================================================= */}
        {activeTab === "shipments" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-sky-600" />
                  <span>Shipment & Delivery Surveillance</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Real-time multi-leg freight tracking from supplier warehouses
                  to workshop delivery bay.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={loadShipments}
                disabled={shipmentsLoading}
                className="gap-2"
              >
                <span>Refresh Status</span>
              </Button>
            </div>

            {shipmentsLoading ? (
              <div className="p-12 text-center text-slate-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sky-600 border-t-transparent" />
                <p className="mt-2 text-xs font-semibold">
                  Loading shipment ledger...
                </p>
              </div>
            ) : shipments.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
                <Truck className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-700">
                  No shipments found
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When an awarded RFQ or order is dispatched by a supplier,
                  multi-leg tracking checkpoints appear here.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking Number</TableHead>
                      <TableHead>Sender Supplier</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Estimated Delivery</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipments.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono font-bold text-sky-700">
                          {s.shipmentNumber}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800">
                          {s.senderBusiness?.tradeName || "Automotive Supplier"}
                        </TableCell>
                        <TableCell>
                          {s.deliveryCity}, {s.deliveryState}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              s.status === "DELIVERED"
                                ? "success"
                                : s.status === "IN_TRANSIT" ||
                                    s.status === "OUT_FOR_DELIVERY"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[11px] font-bold"
                          >
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {s.estimatedDeliveryAt
                            ? new Date(s.estimatedDeliveryAt).toLocaleString(
                                "en-IN",
                                {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                },
                              )
                            : "Scheduled"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedShipment(s)}
                            className="text-xs font-semibold gap-1.5"
                          >
                            <Clock className="w-3.5 h-3.5 text-sky-600" />
                            <span>View Timeline</span>
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
      </main>

      {/* =================================================================== */}
      {/* MODAL 1: AUTHENTICATION / OTP LOGIN MODAL                           */}
      {/* =================================================================== */}
      <Modal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Buyer Account Verification"
        description="Verify your Indian mobile number via one-time password (OTP)."
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
                placeholder="10-digit mobile (e.g. 9876543210)"
                helperText="Standard development test account: 9876543210 (Apex Workshop)"
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
                In local development and test mode, enter{" "}
                <strong>123456</strong> or the OTP printed in your server logs.
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
                Select your active business workspace:
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
      {/* MODAL 2: PRODUCT SPECIFICATION & FITMENT MODAL                      */}
      {/* =================================================================== */}
      <Modal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct?.name || "Product Specification"}
        description={`Part No: ${selectedProduct?.partNumber} • OEM: ${selectedProduct?.oemNumber || "N/A"}`}
        maxWidth="lg"
      >
        {selectedProduct && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-700 block mb-1">
                Description
              </span>
              <p className="text-slate-600">
                {selectedProduct.description || "No description provided."}
              </p>
            </div>

            <div>
              <span className="font-bold text-slate-700 block mb-2">
                Technical Specifications
              </span>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                {selectedProduct.specifications ? (
                  Object.entries(selectedProduct.specifications).map(
                    ([k, v]) => (
                      <div key={k}>
                        <span className="text-slate-500 capitalize">{k}: </span>
                        <span className="font-semibold text-slate-800">
                          {String(v)}
                        </span>
                      </div>
                    ),
                  )
                ) : (
                  <p className="text-slate-400">
                    Standard OEM specifications apply.
                  </p>
                )}
              </div>
            </div>

            {selectedProduct.fitments &&
              selectedProduct.fitments.length > 0 && (
                <div>
                  <span className="font-bold text-slate-700 block mb-2">
                    Verified Compatible Vehicle Models (
                    {selectedProduct.fitments.length})
                  </span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedProduct.fitments.map((f: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 border rounded bg-white flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900">
                            {f.vehicleVariant?.model?.make?.name}{" "}
                            {f.vehicleVariant?.model?.name}
                          </span>
                          <span className="text-slate-500 ml-2">
                            ({f.vehicleVariant?.variantName})
                          </span>
                        </div>
                        <Badge variant="success" className="text-[10px]">
                          {f.position || "Verified Fit"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <div className="pt-3 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedProduct(null)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setRfqProductId(selectedProduct.id);
                  setSelectedProduct(null);
                  setShowRfqModal(true);
                }}
                className="bg-sky-600 hover:bg-sky-700 text-white"
              >
                Raise Wholesale RFQ
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 3: CREATE WHOLESALE RFQ MODAL                                 */}
      {/* =================================================================== */}
      <Modal
        isOpen={showRfqModal}
        onClose={() => setShowRfqModal(false)}
        title="Raise Wholesale Sourcing RFQ"
        description="Publish a procurement request to verified aftermarket distributors."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateRfq} className="space-y-4 text-xs">
          {rfqErrorMsg && <Alert variant="error">{rfqErrorMsg}</Alert>}
          {rfqSuccessMsg && <Alert variant="success">{rfqSuccessMsg}</Alert>}

          <Select
            label="Target Product"
            value={rfqProductId}
            onChange={(e) => setRfqProductId(e.target.value)}
            required
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand?.name} - {p.name} ({p.partNumber})
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Procurement Quantity (Units)"
              type="number"
              min="1"
              value={rfqQuantity}
              onChange={(e) => setRfqQuantity(e.target.value)}
              required
            />
            <Input
              label="Target Unit Price (₹ Optional)"
              type="number"
              min="0"
              value={rfqTargetPrice}
              onChange={(e) => setRfqTargetPrice(e.target.value)}
              placeholder="e.g. 1100"
            />
          </div>

          <Input
            label="Delivery Street Address"
            value={rfqAddress}
            onChange={(e) => setRfqAddress(e.target.value)}
            required
          />

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="City"
              value={rfqCity}
              onChange={(e) => setRfqCity(e.target.value)}
              required
            />
            <Input
              label="State"
              value={rfqState}
              onChange={(e) => setRfqState(e.target.value)}
              required
            />
            <Input
              label="Postal Code (PIN)"
              value={rfqPostalCode}
              onChange={(e) => setRfqPostalCode(e.target.value)}
              required
            />
          </div>

          <Input
            label="Operational Notes for Suppliers"
            value={rfqNotes}
            onChange={(e) => setRfqNotes(e.target.value)}
            placeholder="e.g. Workshop replenishment, need dispatch within 24 hours"
          />

          <div className="pt-3 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRfqModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={rfqSubmitting}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {rfqSubmitting ? "Publishing RFQ..." : "Publish RFQ to Network"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 4: QUOTATION COMPARISON & AWARD MODAL                         */}
      {/* =================================================================== */}
      <Modal
        isOpen={!!selectedRfqComparison}
        onClose={() => setSelectedRfqComparison(null)}
        title={`Quotation Comparison: ${selectedRfqComparison?.rfqNumber || "RFQ"}`}
        description="Side-by-side commercial comparison of responding suppliers."
        maxWidth="2xl"
      >
        {selectedRfqComparison && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Requested Part</span>
                <span className="font-bold text-slate-900">
                  {selectedRfqComparison.masterProduct?.name}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Quantity</span>
                <span className="font-bold text-slate-900">
                  {selectedRfqComparison.quantity} units
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Target Price</span>
                <span className="font-bold text-slate-900">
                  {selectedRfqComparison.targetPrice
                    ? `₹${parseFloat(selectedRfqComparison.targetPrice).toLocaleString("en-IN")}`
                    : "Open"}
                </span>
              </div>
            </div>

            {selectedRfqComparison.quotations?.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No quotations submitted yet by suppliers for this RFQ.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Lead Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedRfqComparison.quotations?.map((q: any) => (
                      <TableRow key={q.id}>
                        <TableCell>
                          <div className="font-bold text-slate-900">
                            {q.supplierBusiness?.tradeName || "Supplier"}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {q.quoteNumber}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-900">
                            ₹{parseFloat(q.unitPrice).toLocaleString("en-IN")}
                          </div>
                          {q.isBestPrice && (
                            <Badge
                              variant="success"
                              className="text-[9px] px-1.5 py-0"
                            >
                              Best Price
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800">
                          ₹{parseFloat(q.totalAmount).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-slate-700">
                            {q.leadTimeDays}{" "}
                            {q.leadTimeDays === 1 ? "day" : "days"}
                          </span>
                          {q.isFastestDelivery && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 block w-max mt-0.5"
                            >
                              Fastest
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              q.status === "ACCEPTED" ? "success" : "outline"
                            }
                            className="text-[10px]"
                          >
                            {q.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {selectedRfqComparison.status !== "AWARDED" &&
                          (q.status === "SUBMITTED" ||
                            q.status === "REVISED") ? (
                            <Button
                              size="sm"
                              disabled={awardSubmitting}
                              onClick={() =>
                                handleAwardQuotation(
                                  selectedRfqComparison.id,
                                  q.id,
                                )
                              }
                              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            >
                              Award Quote
                            </Button>
                          ) : q.status === "ACCEPTED" ? (
                            <span className="text-xs font-bold text-emerald-600 flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Awarded
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Rejected
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
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 5: SHIPMENT TIMELINE & PROOF OF DELIVERY MODAL                */}
      {/* =================================================================== */}
      <Modal
        isOpen={!!selectedShipment}
        onClose={() => setSelectedShipment(null)}
        title={`Shipment: ${selectedShipment?.shipmentNumber || ""}`}
        description={`Status: ${selectedShipment?.status || ""} • Destination: ${selectedShipment?.deliveryCity || ""}`}
        maxWidth="lg"
      >
        {selectedShipment && (
          <div className="space-y-4 text-xs">
            {/* Proof of Delivery Banner if Delivered */}
            {selectedShipment.proofOfDelivery && (
              <Alert variant="success" title="Verified Proof of Delivery (POD)">
                Delivered to{" "}
                <strong>
                  {selectedShipment.proofOfDelivery.recipientName}
                </strong>
                {selectedShipment.proofOfDelivery.verificationCode && (
                  <span>
                    {" "}
                    • OTP Code:{" "}
                    <strong>
                      {selectedShipment.proofOfDelivery.verificationCode}
                    </strong>
                  </span>
                )}
                <div className="text-[10px] text-emerald-700 mt-1">
                  Challan URL:{" "}
                  {selectedShipment.proofOfDelivery.documentUrl ||
                    "Verified Electronic Signature"}
                </div>
              </Alert>
            )}

            {/* Origin & Destination */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Origin (Supplier)
                </span>
                <p className="font-semibold text-slate-800">
                  {selectedShipment.pickupAddress}
                </p>
                <p className="text-slate-500">
                  {selectedShipment.pickupCity}, {selectedShipment.pickupState}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Destination (Workshop)
                </span>
                <p className="font-semibold text-slate-800">
                  {selectedShipment.deliveryAddress}
                </p>
                <p className="text-slate-500">
                  {selectedShipment.deliveryCity},{" "}
                  {selectedShipment.deliveryState}
                </p>
              </div>
            </div>

            {/* Multi-Leg Breakdown */}
            {selectedShipment.legs && selectedShipment.legs.length > 0 && (
              <div className="space-y-2">
                <span className="font-bold text-slate-700 block">
                  Sequential Freight Legs ({selectedShipment.legs.length})
                </span>
                <div className="space-y-2">
                  {selectedShipment.legs.map((leg: any) => (
                    <div
                      key={leg.id}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          <span>
                            Leg {leg.legSequence}: {leg.legType}
                          </span>
                          <Badge
                            variant={
                              leg.status === "COMPLETED" ? "success" : "outline"
                            }
                            className="text-[9px]"
                          >
                            {leg.status}
                          </Badge>
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {leg.originCity} ➔ {leg.destinationCity}
                          {leg.trackingNumber &&
                            ` (Carrier Tracking: ${leg.trackingNumber})`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tracking Events Timeline */}
            {selectedShipment.trackingEvents &&
              selectedShipment.trackingEvents.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-700 block">
                    Checkpoint Audit Log
                  </span>
                  <div className="border-l-2 border-sky-400 pl-3 space-y-2.5 my-2">
                    {selectedShipment.trackingEvents.map(
                      (ev: any, idx: number) => (
                        <div key={idx} className="relative text-xs">
                          <div className="font-bold text-slate-800">
                            {ev.eventType}
                          </div>
                          <div className="text-slate-600">
                            {ev.notes || ev.location}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(ev.timestamp).toLocaleString("en-IN")}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
          </div>
        )}
      </Modal>
    </div>
  );
}
