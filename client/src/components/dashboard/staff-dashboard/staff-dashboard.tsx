'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
    TrendingUp,
    AlertCircle,
    LogOut,
} from 'lucide-react';
import StaffHeader from './staff-header';
import StaffTracking from './staff-tracking';
import { StaffTasksWidget } from './staff-tasks-widget';

import { useGetMonthlyStatsQuery } from '@/redux/features/attendance/attendanceApi';
import { useGetMeQuery } from '@/redux/features/staff/staffApi';
import { Skeleton } from '@/components/ui/skeleton';
import StaffAttendanceTable from './staff-attendance-table';
import { SalaryPinDialog } from '@/components/staff/salary-pin-dialog';
import { ProfileCompletionDialog } from '@/components/account/profile-completion-dialog';
import { toast } from 'sonner';
import ShiftOffNotice from '@/components/shifting/shift-off-notice';

const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
};

export default function StaffDashboard() {
    const { data: monthlyStats, isLoading } = useGetMonthlyStatsQuery(undefined);
    const { data: meData, isLoading: isStaffLoading } = useGetMeQuery(undefined);
    const staff = meData?.staff;

    const [isSalaryUnlocked, setIsSalaryUnlocked] = useState(false);
    const [showPinDialog, setShowPinDialog] = useState(false);
    const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-lock after 1 minute
    useEffect(() => {
        if (isSalaryUnlocked) {
            autoLockTimerRef.current = setTimeout(() => {
                setIsSalaryUnlocked(false);
                toast.info('Salary view auto-locked');
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

    return (
        <div className="min-h-screen bg-background space-y-6">
            <ProfileCompletionDialog />
            <ShiftOffNotice />
            <StaffHeader />

            <StaffTracking />

            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
                
                {/* Widget 1: Tasks & Deliverables */}
                <div className="h-full">
                    <StaffTasksWidget />
                </div>

                {/* Widget 2: This Month Stats */}
                <Card className="h-full flex flex-col shadow-sm hover:shadow-md transition-shadow border-muted/50 overflow-hidden">
                    <CardHeader className="pb-3 pt-4 bg-muted/5">
                        <CardTitle className="text-base font-extrabold flex items-center gap-2">
                            <div className="p-1 bg-emerald-100 dark:bg-emerald-900/40 rounded text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="h-3.5 w-3.5" />
                            </div>
                            Overview
                        </CardTitle>
                        <CardDescription className="text-[10px] font-medium uppercase tracking-wider">
                            {isLoading ? <Skeleton className="h-3 w-20" /> : monthlyStats?.month || 'This Month'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 flex-1">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg p-3 border">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                                    Present
                                </div>
                                <div className="text-2xl font-black text-emerald-600 tracking-tighter">
                                    {isLoading ? (
                                        <Skeleton className="h-7 w-8 mx-auto" />
                                    ) : (
                                        monthlyStats?.present || 0
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg p-3 border">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                                    Late
                                </div>
                                <div className="text-2xl font-black text-orange-600 tracking-tighter">
                                    {isLoading ? (
                                        <Skeleton className="h-7 w-8 mx-auto" />
                                    ) : (
                                        monthlyStats?.late || 0
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg p-3 border">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                                    OT
                                </div>
                                <div className="text-base font-black text-blue-600 leading-tight mt-1">
                                    {isLoading ? (
                                        <Skeleton className="h-5 w-12 mx-auto" />
                                    ) : (
                                        formatDuration(monthlyStats?.totalOvertimeMinutes || 0)
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Widget 3: Salary & PF */}
                <Card className="h-full md:col-span-2 xl:col-span-1 flex flex-col shadow-sm hover:shadow-md transition-shadow border-muted/50 overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-4 bg-muted/5">
                        <div>
                            <CardTitle className="text-base font-extrabold">Financials</CardTitle>
                            <CardDescription className="text-[10px] uppercase tracking-wider">Earnings & PF</CardDescription>
                        </div>
                        {isSalaryUnlocked && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleLock}
                                className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive rounded-full"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                <span className="sr-only">Lock</span>
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="flex-1 pt-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                                <div>
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                        Monthly Salary
                                    </div>
                                    <div className="text-lg font-black tracking-tight text-foreground">
                                        {isSalaryUnlocked ? (
                                            `৳ ${staff?.salary?.toLocaleString() || 0}`
                                        ) : (
                                            <span className="text-muted-foreground tracking-widest font-medium text-sm">
                                                ••••
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {!isSalaryUnlocked && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-3 text-[10px] font-black uppercase tracking-wider rounded-full bg-background hover:bg-primary hover:text-white transition-all shadow-sm"
                                        onClick={() => setShowPinDialog(true)}
                                        disabled={isStaffLoading}
                                    >
                                        {staff?.isSalaryPinSet ? 'Unlock' : 'Setup'}
                                    </Button>
                                )}
                            </div>

                            {isSalaryUnlocked ? (
                                <div className="p-3 bg-accent/50 rounded-lg border border-dashed space-y-1.5">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold text-muted-foreground">PF Contribution (0%)</span>
                                        <span className="font-black">৳ 0</span>
                                    </div>
                                    <Separator className="bg-muted-foreground/20" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-muted-foreground">Total Balance</span>
                                        <span className="text-xs font-black text-primary">৳ 0</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg border border-dashed opacity-60">
                                    <span className="text-[10px] font-bold uppercase">PF Status</span>
                                    <span className="text-[10px] font-black bg-muted px-2 py-0.5 rounded">N/A</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <SalaryPinDialog
                open={showPinDialog}
                onOpenChange={setShowPinDialog}
                staffId={staff?.staffId || ''}
                isPinSet={!!staff?.isSalaryPinSet}
                onSuccess={handleUnlockSuccess}
            />

            <StaffAttendanceTable />

            {/* Notifications */}
            <Card className="border-muted/50 shadow-sm">
                <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-extrabold">System Board</CardTitle>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase font-black tracking-wider">
                            Recent
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pb-4">
                    <Alert className="bg-amber-50/50 border-amber-200/50 dark:bg-amber-950/10 dark:border-amber-900/50">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        <AlertDescription className="text-[11px] font-medium leading-relaxed text-foreground/90">
                            Your account has been de-activated. You can no longer access the portal.
                            <span className="text-[10px] font-bold text-muted-foreground ml-2">
                                3 months ago
                            </span>
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    );
}
