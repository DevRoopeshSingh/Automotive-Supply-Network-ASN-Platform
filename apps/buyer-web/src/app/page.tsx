import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@asn/ui";
import { Search, Car, ShieldCheck, Zap, Clock } from "lucide-react";

export default function BuyerHomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Bar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-slate-900">
              ASN<span className="text-sky-600">.Marketplace</span>
            </span>
            <Badge variant="outline" className="hidden sm:inline-flex">
              Mumbai Cluster
            </Badge>
          </div>

          <div className="flex-1 max-w-xl relative">
            <input
              type="text"
              placeholder="Search by Part Number, OEM Number, or Brand..."
              className="w-full h-10 pl-10 pr-4 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Car className="w-4 h-4 text-sky-600" />
              <span>Select Vehicle</span>
            </Button>
            <Button size="sm">Sign In</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 space-y-8 w-full">
        <div className="rounded-xl bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <Badge variant="success" className="gap-1 text-xs">
              <Zap className="w-3 h-3" /> Network-First 60-Minute Delivery
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              One Network. Every Automotive Requirement.
            </h1>
            <p className="text-slate-300 text-sm sm:text-base">
              Direct access to verified automotive parts distributors,
              wholesalers, and rapid local delivery across Mumbai.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <Button size="lg" className="gap-2">
              <Car className="w-5 h-5" /> Add Vehicle to Garage
            </Button>
          </div>
        </div>

        {/* Core Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sky-600 font-semibold text-sm">
                <ShieldCheck className="w-5 h-5" />
                <span>Verified Fitment Guarantee</span>
              </div>
              <CardTitle className="pt-2">Accurate Parts Matching</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">
                Filter catalogs by vehicle make, model, variant, engine, and
                transmission. Eliminate wrong parts and return friction.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                <Clock className="w-5 h-5" />
                <span>60-Minute SLA Check</span>
              </div>
              <CardTitle className="pt-2">
                Real-Time Proximity Routing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">
                Algorithmic discovery evaluates preparation, multi-pickup, and
                last-mile travel time before checkout confirmation.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
                <Zap className="w-5 h-5" />
                <span>5-Minute Stock Hold</span>
              </div>
              <CardTitle className="pt-2">Zero Overselling</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">
                Atomic database reservations hold verified physical stock while
                you complete checkout and delivery confirmation.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        © 2026 Automotive Supply Network (ASN). All rights reserved.
      </footer>
    </div>
  );
}
