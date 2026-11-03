import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@asn/ui";
import {
  Package,
  ArrowUpRight,
  UploadCloud,
  Bell,
  Layers,
  ShoppingBag,
} from "lucide-react";

export default function SupplierDashboardPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-slate-900">
              ASN<span className="text-sky-600">.SupplierOS</span>
            </span>
            <Badge variant="success">Active Workspace</Badge>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2">
              <Layers className="w-4 h-4 text-sky-600" />
              <span>Switch to Supply Network</span>
            </Button>
            <Button variant="ghost" size="sm" className="relative p-2">
              <Bell className="w-5 h-5 text-slate-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
            </Button>
            <div className="h-8 w-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold">
              MS
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 space-y-8 w-full">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Metropolitan Spares & Distributors
            </h1>
            <p className="text-slate-500 text-sm">
              GSTIN: 27AABCS1429B1Z8 • Mumbai Central Warehouse
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <UploadCloud className="w-4 h-4" /> Bulk Excel/CSV Import
            </Button>
            <Button size="sm" className="gap-2">
              <Package className="w-4 h-4" /> Add New SKU
            </Button>
          </div>
        </div>

        {/* Operational Overview Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Active Listings
              </span>
              <CardTitle className="text-2xl pt-1">1,482 SKUs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-emerald-600 gap-1 font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" /> 98.4% mapped to master
                catalog
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Incoming Orders
              </span>
              <CardTitle className="text-2xl pt-1">6 Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-amber-600 gap-1 font-medium">
                Requires pick & pack confirmation
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Wholesale Sourcing RFQs
              </span>
              <CardTitle className="text-2xl pt-1">3 New</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-sky-600 gap-1 font-medium">
                Inter-supplier trading board
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Settlement Balance
              </span>
              <CardTitle className="text-2xl pt-1">₹42,850.00</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-slate-500 gap-1">
                Next scheduled batch: Tomorrow 10:00 AM
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Orders Queue Placeholder */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-sky-600" />
                <CardTitle>Live Marketplace Orders Queue</CardTitle>
              </div>
              <Badge variant="outline">Auto-Refresh Enabled</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border border-slate-100 rounded-lg p-8 text-center text-slate-500 text-sm">
              No pending orders requiring immediate dispatch action. New orders
              will trigger an audible sound and SMS alert.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
