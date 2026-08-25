"use client";

import * as React from "react";
import { useSession } from "@/lib/auth-client";
import { useGetMyTasksQuery } from "@/redux/features/task/taskApi";
import { useGetMonthlyStatsQuery } from "@/redux/features/attendance/attendanceApi";
import { useGetOrdersQuery } from "@/redux/features/order/orderApi";
import { useGetMeQuery } from "@/redux/features/staff/staffApi";
import { HRTimeTrackingWidget } from "../admin-dashboard/hr-time-tracking-widget";
import { StatCard } from "../admin-dashboard/stat-card";
import { TeamTaskStatsChart } from "./team-task-stats-chart";
import { TeamTasksReviewWidget } from "./team-tasks-review-widget";
import { TeamOrdersWidget } from "./team-orders-widget";
import StaffAttendanceTable from "../staff-dashboard/staff-attendance-table";
import { SalaryPinDialog } from "@/components/staff/salary-pin-dialog";
import { ProfileCompletionDialog } from "@/components/account/profile-completion-dialog";
import ShiftOffNotice from "@/components/shifting/shift-off-notice";
import {
  ListTodo,
  CheckCircle2,
  Package,
  Calendar,
  Plus,
  Crown,
  TrendingUp,
  FileText,
  DollarSign,
  LogOut,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";

export default function TeamLeaderDashboard() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "Team Leader";

  const { data: tasksData, isLoading: isTasksLoading } = useGetMyTasksQuery(undefined, {
    pollingInterval: 30000,
  });

  const { data: monthlyStats } = useGetMonthlyStatsQuery(undefined);
  const { data: ordersData } = useGetOrdersQuery({ page: 1, limit: 10 });
  const { data: meData } = useGetMeQuery(undefined);
  const staff = meData?.staff;

  const tasks = tasksData?.data || [];
  const activeTasks = tasks.filter((t: any) => t.status !== "completed");
  const underReviewTasks = tasks.filter((t: any) => t.status === "under_review");
  const orders = ordersData?.data || [];

  // Salary pin lock state
  const [isSalaryUnlocked, setIsSalaryUnlocked] = React.useState(false);
  const [showPinDialog, setShowPinDialog] = React.useState(false);
  const autoLockTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (isSalaryUnlocked) {
      autoLockTimerRef.current = setTimeout(() => {
        setIsSalaryUnlocked(false);
        toast.info("Salary view locked");
      }, 60000);
      return () => {
        if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
      };
    }
  }, [isSalaryUnlocked]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6">
      <ProfileCompletionDialog />
      <ShiftOffNotice />

      {/* ── Top Header & Action Bar ───────────────────────────────────── */}
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
              <Crown className="size-3" />
              Team Leader
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 font-medium">
            <Calendar className="size-3.5 text-primary" />
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="rounded-xl shadow-xs gap-1.5 bg-primary hover:bg-primary/90">
            <Link href="/tasks">
              <Plus className="size-4" />
              <span>New Task</span>
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline" className="rounded-xl shadow-xs gap-1.5 border-border/80 hover:bg-muted">
            <Link href="/orders">
              <Package className="size-4 text-primary" />
              <span>Team Orders</span>
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline" className="rounded-xl shadow-xs gap-1.5 border-border/80 hover:bg-muted">
            <Link href="/leave/apply">
              <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>Apply Leave</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Compact Workday & Time Tracking ───────────────────────────── */}
      <HRTimeTrackingWidget />

      {/* ── KPI Stat Cards ────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Team Tasks"
          value={activeTasks.length}
          icon={ListTodo}
          description={tasks.length + " total assigned assignments"}
          variant="primary"
          href="/tasks"
        />

        <StatCard
          title="Tasks Under Review"
          value={underReviewTasks.length}
          icon={CheckCircle2}
          description="Submissions waiting for sign-off"
          variant={underReviewTasks.length > 0 ? "warning" : "success"}
          href="/tasks"
        />

        <StatCard
          title="Assigned Orders"
          value={orders.length}
          icon={Package}
          description="Client projects in sprint"
          variant="purple"
          href="/orders"
        />

        <StatCard
          title="Monthly Turnout"
          value={(monthlyStats?.present || 0) + " Days"}
          icon={UserCheck}
          description={"Present: " + (monthlyStats?.present || 0) + ", Late: " + (monthlyStats?.late || 0)}
          variant="success"
          href="/attendance"
        />
      </div>

      {/* ── Charts & Progress Grid ────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <TeamTaskStatsChart tasks={tasks} />
        </div>
        <div className="lg:col-span-4">
          {/* Financials Card */}
          <Card className="h-full flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border-muted/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base font-extrabold flex items-center gap-2">
                  <DollarSign className="size-4 text-primary" />
                  My Financials
                </CardTitle>
                <CardDescription className="text-xs">
                  Salary & Earnings Status
                </CardDescription>
              </div>
              {isSalaryUnlocked && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSalaryUnlocked(false)}
                  className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive rounded-full"
                >
                  <LogOut className="size-3.5" />
                </Button>
              )}
            </CardHeader>

            <CardContent className="space-y-3 pb-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Monthly Salary
                  </div>
                  <div className="text-base sm:text-lg font-black tracking-tight text-foreground">
                    {isSalaryUnlocked ? (
                      "৳ " + (staff?.salary?.toLocaleString() || 0)
                    ) : (
                      <span className="text-muted-foreground tracking-widest font-medium text-sm">
                        ••••••••
                      </span>
                    )}
                  </div>
                </div>
                {!isSalaryUnlocked && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs font-bold rounded-xl"
                    onClick={() => setShowPinDialog(true)}
                  >
                    {staff?.isSalaryPinSet ? "Unlock" : "Setup PIN"}
                  </Button>
                )}
              </div>

              <div className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Current Month</span>
                  <span className="font-semibold text-foreground">
                    {monthlyStats?.month || "Active"}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Present Days</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {monthlyStats?.present || 0} days
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Operational Grid (Tasks Review & Assigned Orders) ─────────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <TeamTasksReviewWidget tasks={tasks} isLoading={isTasksLoading} />
        </div>
        <div className="lg:col-span-6">
          <TeamOrdersWidget />
        </div>
      </div>

      {/* ── Monthly Attendance History ─────────────────────────────────── */}
      <StaffAttendanceTable />

      <SalaryPinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        staffId={staff?.staffId || staff?._id || ""}
        isPinSet={!!staff?.isSalaryPinSet}
        onSuccess={() => {
          setIsSalaryUnlocked(true);
          setShowPinDialog(false);
        }}
      />
    </div>
  );
}
