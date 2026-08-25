"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogHeader,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  LogIn,
  FileText,
  Timer,
  LogOut,
  Calendar,
  Briefcase,
  PlaneTakeoff,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  useCheckInMutation,
  useCheckOutMutation,
  useGetTodayAttendanceQuery,
} from "@/redux/features/attendance/attendanceApi";
import { useGetMyShiftQuery } from "@/redux/features/shift/shiftApi";
import { useGetLeaveBalanceQuery } from "@/redux/features/leave/leaveApi";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

const EARLY_CHECKIN_WINDOW_MINUTES = 15;

export function HRTimeTrackingWidget() {
  const router = useRouter();
  const { data: todaysData } = useGetTodayAttendanceQuery(undefined);
  const { data: myShiftData } = useGetMyShiftQuery(undefined);
  const { data: leaveBalanceData } = useGetLeaveBalanceQuery(undefined);

  const attendanceDay = todaysData?.attendance?.attendanceDay;
  const shiftInfo = myShiftData?.shift?.shift;
  const leaveBalance = leaveBalanceData?.data;

  const [checkIn, { isLoading: isCheckingIn }] = useCheckInMutation();
  const [checkOut, { isLoading: isCheckingOut }] = useCheckOutMutation();

  const getShiftStartTime = useCallback(() => {
    if (!shiftInfo?.startTime) return null;
    const now = new Date();
    const [h, m] = shiftInfo.startTime.split(":");
    const shiftStart = new Date(now);
    shiftStart.setHours(Number(h), Number(m), 0, 0);
    return shiftStart;
  }, [shiftInfo]);

  const performCheckIn = useCallback(async () => {
    try {
      const res = await checkIn({ source: "web" }).unwrap();
      if (!res.success) {
        toast.error(res.message || "Failed to check in.");
        return false;
      }
      const officialTime = res.attendanceDay?.checkInAt
        ? new Date(res.attendanceDay.checkInAt)
        : new Date();
      toast.success("🎉 Checked in successfully!", {
        description: `Time: ${format(officialTime, "hh:mm aa")}`,
      });
      return true;
    } catch (error: unknown) {
      const err = error as { data?: { message?: string }; error?: string };
      const apiMessage =
        err?.data?.message || err?.error || "Failed to check in.";
      toast.error(apiMessage);
      return false;
    }
  }, [checkIn]);

  const handleCheckIn = async () => {
    const shiftStart = getShiftStartTime();
    if (!shiftStart) {
      await performCheckIn();
      return;
    }
    const now = new Date();
    const diffMinutes = (shiftStart.getTime() - now.getTime()) / 1000 / 60;
    if (diffMinutes > EARLY_CHECKIN_WINDOW_MINUTES) {
      toast.warning("Too early to check in", {
        description: `Shift starts at ${format(shiftStart, "hh:mm aa")}`,
      });
      return;
    }
    await performCheckIn();
  };

  const handleCheckOut = async () => {
    try {
      const res = await checkOut({ source: "web" }).unwrap();
      if (!res.success) {
        toast.error(res.message || "Failed to check out.");
        return;
      }
      toast.success("Checked out successfully!");
    } catch (error: unknown) {
      const err = error as { data?: { message?: string }; error?: string };
      toast.error(err?.data?.message || err?.error || "Failed to check out.");
    }
  };

  // Live Duration
  const [currentDuration, setCurrentDuration] = useState(0);

  const calculateDuration = useCallback(() => {
    if (!attendanceDay?.checkInAt) return 0;
    if (attendanceDay.checkOutAt) {
      return attendanceDay.totalMinutes || 0;
    }
    const start = new Date(attendanceDay.checkInAt);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / 1000 / 60);
  }, [attendanceDay]);

  useEffect(() => {
    setCurrentDuration(calculateDuration());
    if (attendanceDay?.checkInAt && !attendanceDay?.checkOutAt) {
      const interval = setInterval(() => {
        setCurrentDuration(calculateDuration());
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [attendanceDay, calculateDuration]);

  const isCheckedIn = !!attendanceDay?.checkInAt;
  const isCheckedOut = !!attendanceDay?.checkOutAt;

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
      {/* ── Left: Compact Punch & Time Tracking Card (7 Cols) ─────── */}
      <Card className="lg:col-span-7 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardHeader className="pb-2 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Timer className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-base font-bold">
                  My Workday & Time Tracking
                </CardTitle>
                <CardDescription className="text-xs">
                  {format(new Date(), "EEEE, MMM d, yyyy")}
                </CardDescription>
              </div>
            </div>

            {attendanceDay?.status ? (
              <Badge
                variant="outline"
                className={cn(
                  "capitalize text-[11px] font-semibold px-2 py-0.5",
                  attendanceDay.status === "present" &&
                    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                  attendanceDay.status === "late" &&
                    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                  attendanceDay.status === "on_leave" &&
                    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
                  attendanceDay.status === "absent" &&
                    "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                )}
              >
                {attendanceDay.status.replace(/_/g, " ")}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[11px] text-muted-foreground">
                Not Checked In
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-4 space-y-3">
          {/* Mini Stats Row */}
          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-background/80 border border-border/60 text-center">
            <div>
              <div className="text-[10px] text-muted-foreground font-medium flex items-center justify-center gap-1">
                <LogIn className="size-3 text-primary" /> Start Time
              </div>
              <div className="text-xs sm:text-sm font-bold text-foreground mt-0.5">
                {attendanceDay?.checkInAt
                  ? format(new Date(attendanceDay.checkInAt), "hh:mm aa")
                  : "--:--"}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-muted-foreground font-medium flex items-center justify-center gap-1">
                <Clock className="size-3 text-primary" /> End Time
              </div>
              <div className="text-xs sm:text-sm font-bold text-foreground mt-0.5">
                {attendanceDay?.checkOutAt
                  ? format(new Date(attendanceDay.checkOutAt), "hh:mm aa")
                  : "--:--"}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-muted-foreground font-medium flex items-center justify-center gap-1">
                <Timer className="size-3 text-emerald-500" /> Duration
              </div>
              <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatDuration(currentDuration)}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            {!isCheckedIn ? (
              <Button
                size="sm"
                className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-white shadow-xs font-semibold gap-1.5 h-9"
                onClick={handleCheckIn}
                disabled={isCheckingIn}
              >
                {isCheckingIn ? (
                  <Spinner />
                ) : (
                  <>
                    <LogIn className="size-4" /> Check In
                  </>
                )}
              </Button>
            ) : isCheckedOut ? (
              <Button size="sm" variant="outline" className="flex-1 rounded-xl h-9" disabled>
                <LogOut className="size-4 mr-1.5 text-muted-foreground" /> Checked Out
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 rounded-xl shadow-xs font-semibold gap-1.5 h-9"
                    disabled={isCheckingOut}
                  >
                    {isCheckingOut ? (
                      <Spinner />
                    ) : (
                      <>
                        <LogOut className="size-4" /> Check Out
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Check Out</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will conclude your shift for today. Are you sure you want to clock out?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCheckOut}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Check Out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Button
              asChild
              size="sm"
              variant="outline"
              className="flex-1 rounded-xl border-border/80 hover:bg-muted font-medium gap-1.5 h-9"
            >
              <Link href="/leave/apply">
                <FileText className="size-4 text-primary" /> Apply Leave
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Right: My Shift & Leave Balances Summary Card (5 Cols) ─── */}
      <Card className="lg:col-span-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border-border/60">
        <CardHeader className="pb-2 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Briefcase className="size-4 text-primary" />
              My Shift & Leaves
            </CardTitle>
            <Link
              href="/attendance"
              className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
            >
              My Logs <ArrowRight className="size-3" />
            </Link>
          </div>
        </CardHeader>

        <CardContent className="pb-4 space-y-3">
          {/* Shift Details */}
          <div className="p-2.5 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-foreground">
                {shiftInfo?.name || "General Shift"}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <Clock className="size-3" />
                {shiftInfo?.startTime ? `${shiftInfo.startTime} - ${shiftInfo.endTime}` : "10:00 AM - 07:00 PM"}
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] bg-background">
              Active Shift
            </Badge>
          </div>

          {/* Leave Balances */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-muted/20 border border-border/40">
              <div className="text-[10px] text-muted-foreground font-medium">Annual</div>
              <div className="text-xs sm:text-sm font-bold text-foreground">
                {leaveBalance?.annualLeaveRemaining ?? 12}
                <span className="text-[10px] text-muted-foreground font-normal"> / {leaveBalance?.annualLeaveTotal ?? 14}</span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-muted/20 border border-border/40">
              <div className="text-[10px] text-muted-foreground font-medium">Sick</div>
              <div className="text-xs sm:text-sm font-bold text-foreground">
                {leaveBalance?.sickLeaveRemaining ?? 8}
                <span className="text-[10px] text-muted-foreground font-normal"> / {leaveBalance?.sickLeaveTotal ?? 10}</span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-muted/20 border border-border/40">
              <div className="text-[10px] text-muted-foreground font-medium">Used</div>
              <div className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400">
                {(leaveBalance?.annualLeaveUsed ?? 0) + (leaveBalance?.sickLeaveUsed ?? 0)}
                <span className="text-[10px] text-muted-foreground font-normal"> days</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
