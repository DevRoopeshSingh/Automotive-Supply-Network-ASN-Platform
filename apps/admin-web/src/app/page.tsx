import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@asn/ui";
import {
  ShieldAlert,
  Navigation,
  Database,
  DollarSign,
  Activity,
} from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-slate-200 bg-slate-900 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight">
              ASN<span className="text-rose-500">.AdminCentre</span>
            </span>
            <Badge variant="destructive">Production Governance</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Cluster: Mumbai Central (Pilot Zone)
            </span>
            <div className="h-8 w-8 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-semibold">
              SA
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 space-y-8 w-full">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Platform Operations & SLA Control
          </h1>
          <p className="text-slate-500 text-sm">
            Real-time surveillance across the 5 core platform experiences.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Active Mumbai Drivers
              </span>
              <CardTitle className="text-2xl pt-1 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-sky-600" /> 18 Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-emerald-600 font-medium">
                100% SLA eligible range
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                60-Min SLA Compliance
              </span>
              <CardTitle className="text-2xl pt-1 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" /> 97.2%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-slate-500">
                Average fulfillment: 44.8 mins
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Catalog Accuracy
              </span>
              <CardTitle className="text-2xl pt-1 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" /> 5,200 SKUs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-slate-500">
                12 pending verification flags
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Escrow Reconciliation
              </span>
              <CardTitle className="text-2xl pt-1 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" /> Balanced
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-emerald-600 font-medium">
                Zero discrepancy detected
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="w-5 h-5" />
              <CardTitle>System Audit & Dispatch Override Console</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 text-sm mb-4">
              All high-impact actions (commission schedule overrides, partner
              manual reassignment, dispute fund releases) require Super Admin
              MFA and are permanently logged to the append-only audit trail.
            </p>
            <Button variant="secondary" size="sm">
              View Immutable Audit Logs
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
