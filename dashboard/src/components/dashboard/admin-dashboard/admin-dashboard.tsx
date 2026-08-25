"use client";

import * as React from "react";
import { useGetAdminDashboardQuery } from "@/redux/features/dashboard/dashboardApi";
import { StatCard } from "./stat-card";
import { AttendanceOverviewChart } from "./attendance-overview-chart";
import { FinancialPerformanceChart } from "./financial-performance-chart";
import { DepartmentWorkloadChart } from "./department-workload-chart";
import { OrderPipelineWidget } from "./order-pipeline-widget";
import { PendingActionsWidget } from "./pending-actions-widget";
import { RecentActivities } from "./recent-activities";
import { AdminDashboardSkeleton } from "./admin-dashboard-skeleton";
import { HRTimeTrackingWidget } from "./hr-time-tracking-widget";
import { useSession } from "@/lib/auth-client";
import { Role } from "@/constants/role";
import {
  Users,
  UserCheck,
  TrendingUp,
  DollarSign,
  Package,
  FileText,
  AlertCircle,
  Plus,
  UserPlus,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";

export default function AdminDashboard() {
  const { data: session } = useSession();
  const userRole = session?.user?.role as Role;
  const userName = session?.user?.name || "Admin";

  const isSuperAdmin = userRole === Role.SUPER_ADMIN;
  const isHRManager = userRole === Role.HR_MANAGER;

  const { data, isLoading, error, refetch } = useGetAdminDashboardQuery(undefined, {
    pollingInterval: 30000,
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getRoleLabel = () => {
    if (isSuperAdmin) return "Super Admin";
    if (userRole === Role.ADMIN) return "Administrator";
    if (isHRManager) return "HR Manager";
    return "Operations Lead";
  };

  if (isLoading) {
    return <AdminDashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-4 p-4">
        <Alert variant="destructive" className="rounded-2xl border-destructive/30">
          <AlertCircle className="size-5" />
          <AlertDescription className="text-sm font-medium">
            Failed to load dashboard statistics. Please check your connection or retry.
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          Retry Loading
        </Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const {
    staffStats,
    attendanceOverview,
    monthlyAttendanceStats,
    recentActivities,
    financialStats,
  } = data;

  const formatCurrency = (amount: number) => {
    return "৳" + amount.toLocaleString("en-BD", { maximumFractionDigits: 0 });
  };

  const earningsThisMonth = financialStats?.thisMonthEarnings || 0;
  const totalProfit = financialStats?.profit || 0;

  return (
    <div className="space-y-6">
      {/* ── Top Header & Quick Actions Bar ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/15 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              {getGreeting()}, {userName.split(" ")[0]}!
            </h1>
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/30 font-semibold px-2 py-0.5 text-xs inline-flex items-center gap-1"
            >
              <ShieldCheck className="size-3" />
              {getRoleLabel()}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 font-medium">
            <Calendar className="size-3.5 text-primary" />
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        {/* Quick Actions for Admins & Super Admins */}
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="rounded-xl shadow-xs gap-1.5 bg-primary hover:bg-primary/90">
            <Link href="/orders">
              <Plus className="size-4" />
              <span>New Order</span>
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline" className="rounded-xl shadow-xs gap-1.5 border-border/80 hover:bg-muted">
            <Link href="/quotations/new">
              <FileText className="size-4 text-primary" />
              <span>Quotation</span>
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline" className="rounded-xl shadow-xs gap-1.5 border-border/80 hover:bg-muted">
            <Link href="/invitations">
              <UserPlus className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>Invite Staff</span>
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline" className="rounded-xl shadow-xs gap-1.5 border-border/80 hover:bg-muted">
            <Link href="/clients">
              <Users className="size-4 text-blue-600 dark:text-blue-400" />
              <span>Clients</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* ── HR Manager Personal Punch & Leave Tracking ───────────────── */}
      {isHRManager && (
        <div className="transition-all duration-200">
          <HRTimeTrackingWidget />
        </div>
      )}

      {/* ── Primary KPI Cards Grid ───────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Staff Strength"
          value={staffStats.total}
          icon={Users}
          description={staffStats.active + " active members, " + staffStats.inactive + " inactive"}
          variant="primary"
          href="/staffs"
        />

        <StatCard
          title="Today's Attendance"
          value={attendanceOverview.presentPercentage.toFixed(1) + "%"}
          icon={UserCheck}
          description={attendanceOverview.present + " on-duty out of " + attendanceOverview.total}
          variant="success"
          href="/attendance"
        />

        <StatCard
          title="This Month Revenue"
          value={formatCurrency(earningsThisMonth)}
          icon={DollarSign}
          description="Paid revenue received this month"
          variant="purple"
          href="/earnings"
        />

        {isSuperAdmin ? (
          <StatCard
            title="Net Profit"
            value={formatCurrency(totalProfit)}
            icon={TrendingUp}
            description="Total net revenue after expenses"
            variant="success"
            href="/profit-share"
          />
        ) : (
          <StatCard
            title="Monthly Attendance"
            value={monthlyAttendanceStats.averageAttendance.toFixed(1) + "%"}
            icon={TrendingUp}
            description={"Average turnout in " + monthlyAttendanceStats.month}
            variant="default"
            href="/attendance"
          />
        )}
      </div>

      {/* ── Analytics & Visual Charts Grid ───────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <FinancialPerformanceChart />
        </div>
        <div className="lg:col-span-4">
          <AttendanceOverviewChart data={attendanceOverview} />
        </div>
      </div>

      {/* ── Operational Widgets Grid ─────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <OrderPipelineWidget />
        </div>
        <div className="lg:col-span-6">
          <DepartmentWorkloadChart
            departments={staffStats.byDepartment}
            totalStaff={staffStats.total}
          />
        </div>
      </div>

      {/* ── Action Center & Activity Stream Grid ─────────────────────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <PendingActionsWidget />
        </div>
        <div className="lg:col-span-6">
          <RecentActivities activities={recentActivities} />
        </div>
      </div>
    </div>
  );
}
