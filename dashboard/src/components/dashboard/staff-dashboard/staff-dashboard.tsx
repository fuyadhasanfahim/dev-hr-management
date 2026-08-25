"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  AlertCircle,
  LogOut,
  Calendar,
  ListTodo,
  FileText,
  DollarSign,
  UserCheck,
  PlaneTakeoff,
  Lock,
  Unlock,
} from "lucide-react";
import StaffHeader from "./staff-header";
import { HRTimeTrackingWidget } from "../admin-dashboard/hr-time-tracking-widget";
import { StaffTasksWidget } from "./staff-tasks-widget";
import { StaffAttendanceChart } from "./staff-attendance-chart";
import { StatCard } from "../admin-dashboard/stat-card";
import { useGetMonthlyStatsQuery } from "@/redux/features/attendance/attendanceApi";
import { useGetMeQuery } from "@/redux/features/staff/staffApi";
import { useGetMyTasksQuery } from "@/redux/features/task/taskApi";
import { useGetLeaveBalanceQuery } from "@/redux/features/leave/leaveApi";
import StaffAttendanceTable from "./staff-attendance-table";
import { SalaryPinDialog } from "@/components/staff/salary-pin-dialog";
import { ProfileCompletionDialog } from "@/components/account/profile-completion-dialog";
import { toast } from "sonner";
import ShiftOffNotice from "@/components/shifting/shift-off-notice";

export default function StaffDashboard() {
  const { data: monthlyStats, isLoading: isMonthlyLoading } = useGetMonthlyStatsQuery(undefined);
  const { data: meData, isLoading: isStaffLoading } = useGetMeQuery(undefined);
  const { data: tasksData } = useGetMyTasksQuery(undefined);
  const { data: leaveBalanceData } = useGetLeaveBalanceQuery(undefined);

  const staff = meData?.staff;
  const tasks = tasksData?.data || [];
  const activeTasks = tasks.filter((t: any) => t.status !== "completed");
  const leaveBalance = leaveBalanceData?.data;

  const [isSalaryUnlocked, setIsSalaryUnlocked] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-lock salary after 1 minute
  useEffect(() => {
    if (isSalaryUnlocked) {
      autoLockTimerRef.current = setTimeout(() => {
        setIsSalaryUnlocked(false);
        toast.info("Salary view auto-locked");
      }, 60000);

      return () => {
        if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
      };
    }
  }, [isSalaryUnlocked]);

  const handleUnlockSuccess = () => {
    setIsSalaryUnlocked(true);
    setShowPinDialog(false);
  };

  const handleLock = () => {
    setIsSalaryUnlocked(false);
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = null;
    }
  };

  const totalLeaveRemaining = (leaveBalance?.annualLeaveRemaining ?? 0) + (leaveBalance?.sickLeaveRemaining ?? 0);

  return (
    <div className="min-h-screen bg-background space-y-6">
      <ProfileCompletionDialog />
      <ShiftOffNotice />

      {/* ── Staff Header ─────────────────────────────────────────────── */}
      <StaffHeader />

      {/* ── Compact Workday & Shift Tracking (Side-by-Side) ──────────── */}
      <HRTimeTrackingWidget />

      {/* ── KPI Stat Cards ────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Attendance Turnout"
          value={(monthlyStats?.present || 0) + " Days"}
          icon={UserCheck}
          description={"On-Time: " + Math.max(0, (monthlyStats?.present || 0) - (monthlyStats?.late || 0)) + ", Late: " + (monthlyStats?.late || 0)}
          variant="success"
          href="/attendance"
        />

        <StatCard
          title="My Active Tasks"
          value={activeTasks.length}
          icon={ListTodo}
          description={tasks.length + " total assigned assignments"}
          variant="primary"
          href="/tasks"
        />

        <StatCard
          title="Leave Balance"
          value={totalLeaveRemaining + " Days"}
          icon={PlaneTakeoff}
          description={"Annual: " + (leaveBalance?.annualLeaveRemaining ?? 0) + ", Sick: " + (leaveBalance?.sickLeaveRemaining ?? 0)}
          variant="purple"
          href="/leave/apply"
        />

        {/* Financials / Salary Card */}
        <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-md border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Salary Status
            </CardTitle>
            {isSalaryUnlocked ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLock}
                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive rounded-full"
              >
                <Lock className="size-3.5 text-muted-foreground" />
              </Button>
            ) : (
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <DollarSign className="size-4" />
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-1 pb-4">
            <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center justify-between">
              {isSalaryUnlocked ? (
                "৳ " + (staff?.salary?.toLocaleString() || 0)
              ) : (
                <span className="text-muted-foreground tracking-widest font-mono text-base">
                  ••••••••
                </span>
              )}
              {!isSalaryUnlocked && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[10px] font-bold rounded-lg border-border/80"
                  onClick={() => setShowPinDialog(true)}
                  disabled={isStaffLoading}
                >
                  {staff?.isSalaryPinSet ? "Unlock" : "Setup PIN"}
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">
              {isSalaryUnlocked ? "Active monthly rate" : "Protected by Security PIN"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Visual Charts & Task Deadlines Grid ───────────────────────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <StaffAttendanceChart stats={monthlyStats} isLoading={isMonthlyLoading} />
        </div>
        <div className="lg:col-span-5">
          <StaffTasksWidget />
        </div>
      </div>

      {/* ── Monthly Attendance History Table ───────────────────────────── */}
      <StaffAttendanceTable />

      <SalaryPinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        staffId={staff?.staffId || staff?._id || ""}
        isPinSet={!!staff?.isSalaryPinSet}
        onSuccess={handleUnlockSuccess}
      />
    </div>
  );
}
