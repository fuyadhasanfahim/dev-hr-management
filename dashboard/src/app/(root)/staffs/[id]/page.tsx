'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, differenceInYears, differenceInMonths } from 'date-fns';
import { toast } from 'sonner';
import {
    Mail,
    Phone,
    Briefcase,
    Clock,
    AlertCircle,
    Banknote,
    Calendar,
    CalendarDays,
    CreditCard,
    Droplet,
    Fingerprint,
    MapPin,
    ShieldAlert,
    UserCircle,
    Building2,
    Copy,
    Check,
    Users,
    HeartHandshake,
    ShieldCheck,
    IdCard,
    KeyRound,
} from 'lucide-react';

import { useGetStaffByIdQuery } from '@/redux/features/staff/staffApi';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

import { StaffAttendanceTab } from '@/app/(root)/staffs/[id]/_components/attendance-tab';
import { StaffLeaveTab } from '@/app/(root)/staffs/[id]/_components/staff-leave-tab';
import { PaymentHistoryTab } from '@/app/(root)/staffs/[id]/_components/payment-history-tab';
import { useSession } from '@/lib/auth-client';
import { Role } from '@/constants/role';
import { EditStaffDialog } from '@/components/staff/edit-staff-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { UserAccessForm } from '@/components/roles/user-access-form';

function StaffDetailsSkeleton() {
    return (
        <div className="w-full space-y-6 pb-16">
            <Card className="p-6 border-border/60">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <Skeleton className="size-20 sm:size-24 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-7 w-52" />
                            <Skeleton className="h-4 w-40" />
                            <div className="flex gap-2 pt-1">
                                <Skeleton className="h-5 w-20 rounded-md" />
                                <Skeleton className="h-5 w-24 rounded-md" />
                            </div>
                        </div>
                    </div>
                    <Skeleton className="h-9 w-28 rounded-lg" />
                </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
            </div>

            <Skeleton className="h-10 w-full max-w-md rounded-lg" />
            <Skeleton className="h-96 w-full rounded-xl" />
        </div>
    );
}

export default function StaffDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { data: session } = useSession();

    const { data, isLoading, isError } = useGetStaffByIdQuery(id);
    const staff = data?.staff;

    const [copiedField, setCopiedField] = useState<string | null>(null);

    const { can } = usePermissions();
    const canManageAccess = can('role.assign');
    const canEditStaff = can('staff.update');

    const userRole = session?.user?.role;
    const isOwner = session?.user?.id === staff?.userId;
    const canEdit =
        userRole === Role.ADMIN ||
        userRole === Role.HR_MANAGER ||
        userRole === Role.SUPER_ADMIN;
    const canViewSalary =
        canEdit || (isOwner && staff?.salaryVisibleToEmployee);

    const handleCopy = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(label);
        toast.success(`${label} copied to clipboard`);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .filter(Boolean)
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const tenure = useMemo(() => {
        if (!staff?.joinDate) return null;
        const join = new Date(staff.joinDate);
        const end = staff.exitDate ? new Date(staff.exitDate) : new Date();
        const years = differenceInYears(end, join);
        const months = differenceInMonths(end, join) % 12;

        if (years === 0 && months === 0) return 'Less than a month';
        if (years === 0) return `${months} mo${months > 1 ? 's' : ''}`;
        if (months === 0) return `${years} yr${years > 1 ? 's' : ''}`;
        return `${years} yr${years > 1 ? 's' : ''} ${months} mo${months > 1 ? 's' : ''}`;
    }, [staff?.joinDate, staff?.exitDate]);

    const age = useMemo(() => {
        if (!staff?.dateOfBirth) return null;
        return differenceInYears(new Date(), new Date(staff.dateOfBirth));
    }, [staff?.dateOfBirth]);

    if (isLoading) {
        return <StaffDetailsSkeleton />;
    }

    if (isError || !staff) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-4">
                <div className="size-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                    <AlertCircle className="size-8" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-bold">Staff Member Not Found</h2>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        The requested staff profile does not exist or has been removed.
                    </p>
                </div>
                <Button onClick={() => router.push('/staffs')}>
                    Back to Staff List
                </Button>
            </div>
        );
    }

    const { user, branch, currentShift } = staff;
    const bankDetails = staff.bank || {};
    const bankName = bankDetails.bankName || (staff as any).bankName;
    const bankAccountNo = bankDetails.accountNumber || (staff as any).bankAccountNo;
    const bankAccountName = bankDetails.accountHolderName || (staff as any).bankAccountName;
    const bankBranch = bankDetails.branch || (staff as any).branchName;
    const bankRouting = bankDetails.routingNumber;

    const formattedDesignation = staff.designation
        ? staff.designation.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        : 'Staff Member';

    const formattedDepartment = staff.department
        ? staff.department.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        : 'General';

    const formattedRole = user?.role
        ? user.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        : 'Staff';

    return (
        <div className="w-full space-y-6 pb-16">
            {/* Clean, Unified Profile Header Card */}
            <Card className="border-border/60 shadow-xs rounded-2xl bg-card overflow-hidden">
                <CardContent className="p-6 sm:p-7">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        {/* Avatar & Core Profile Info */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
                            <div className="relative shrink-0">
                                <Avatar className="size-20 sm:size-24 rounded-full border-2 border-border/80 shadow-xs bg-muted">
                                    <AvatarImage src={user?.image || undefined} className="object-cover" />
                                    <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                                        {getInitials(user?.name || 'Staff User')}
                                    </AvatarFallback>
                                </Avatar>
                                <span
                                    className={`absolute bottom-1 right-1 size-3.5 rounded-full border-2 border-card ${
                                        staff.status === 'active'
                                            ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                                            : staff.status === 'inactive'
                                            ? 'bg-amber-500 ring-2 ring-amber-500/20'
                                            : 'bg-destructive ring-2 ring-destructive/20'
                                    }`}
                                />
                            </div>

                            <div className="space-y-2.5">
                                {/* Name + Badges */}
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                        {user?.name || 'Staff User'}
                                    </h1>

                                    <button
                                        type="button"
                                        onClick={() => handleCopy(staff.staffId, 'Staff ID')}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/40"
                                        title="Click to copy Staff ID"
                                    >
                                        ID: {staff.staffId}
                                        {copiedField === 'Staff ID' ? (
                                            <Check className="size-3 text-emerald-500" />
                                        ) : (
                                            <Copy className="size-3 opacity-60" />
                                        )}
                                    </button>

                                    <Badge
                                        variant="outline"
                                        className={`px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider capitalize rounded-md ${
                                            staff.status === 'active'
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                                : staff.status === 'inactive'
                                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                                : 'bg-destructive/10 text-destructive border-destructive/30'
                                        }`}
                                    >
                                        {staff.status}
                                    </Badge>

                                    <Badge variant="secondary" className="text-xs font-medium tracking-wide">
                                        {formattedRole}
                                    </Badge>
                                </div>

                                {/* Meta information */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                                        <Briefcase className="size-4 text-primary shrink-0" />
                                        <span>{formattedDesignation}</span>
                                    </div>
                                    <span className="opacity-40 hidden sm:inline">•</span>
                                    <div className="flex items-center gap-1.5">
                                        <Building2 className="size-4 text-muted-foreground/70 shrink-0" />
                                        <span>{formattedDepartment}</span>
                                    </div>
                                    {branch?.name && (
                                        <>
                                            <span className="opacity-40 hidden sm:inline">•</span>
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="size-4 text-muted-foreground/70 shrink-0" />
                                                <span>{branch.name}</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Contact buttons */}
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    {user?.email && (
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(user.email, 'Email')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/70 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                            title="Click to copy email"
                                        >
                                            <Mail className="size-3.5 text-primary" />
                                            <span className="max-w-[200px] truncate">{user.email}</span>
                                            {copiedField === 'Email' ? (
                                                <Check className="size-3 text-emerald-500" />
                                            ) : (
                                                <Copy className="size-3 opacity-40" />
                                            )}
                                        </button>
                                    )}

                                    {staff.phone && (
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(staff.phone, 'Phone')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/70 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                            title="Click to copy phone"
                                        >
                                            <Phone className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                            <span>{staff.phone}</span>
                                            {copiedField === 'Phone' ? (
                                                <Check className="size-3 text-emerald-500" />
                                            ) : (
                                                <Copy className="size-3 opacity-40" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions (Right Aligned) */}
                        {canEditStaff && (
                            <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                                <EditStaffDialog
                                    staff={staff}
                                    currentShiftId={currentShift?._id}
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Quick Metrics & Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1: Organization & Role */}
                <Card className="border-border/60 shadow-xs bg-card">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Department & Role
                            </span>
                            <h4 className="text-base font-bold text-foreground truncate max-w-[180px]">
                                {formattedDepartment}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {formattedDesignation}
                            </p>
                        </div>
                        <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Briefcase className="size-5" />
                        </div>
                    </CardContent>
                </Card>

                {/* Metric 2: Branch Location */}
                <Card className="border-border/60 shadow-xs bg-card">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Branch Location
                            </span>
                            <h4 className="text-base font-bold text-foreground truncate max-w-[180px]">
                                {branch?.name || 'Unassigned'}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {branch?.code ? `Code: ${branch.code}` : branch?.address || 'Headquarters'}
                            </p>
                        </div>
                        <div className="size-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <Building2 className="size-5" />
                        </div>
                    </CardContent>
                </Card>

                {/* Metric 3: Shift Schedule */}
                <Card className="border-border/60 shadow-xs bg-card">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Active Shift
                            </span>
                            <h4 className="text-base font-bold text-foreground truncate max-w-[180px]">
                                {currentShift?.name || 'No Shift'}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {currentShift ? `${currentShift.startTime} — ${currentShift.endTime}` : 'Flexible Schedule'}
                            </p>
                        </div>
                        <div className="size-11 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                            <Clock className="size-5" />
                        </div>
                    </CardContent>
                </Card>

                {/* Metric 4: Tenure / Compensation */}
                <Card className="border-border/60 shadow-xs bg-card">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                {canViewSalary ? 'Base Salary' : 'Tenure'}
                            </span>
                            <h4 className="text-base font-bold text-foreground truncate max-w-[180px]">
                                {canViewSalary ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                        ৳{staff.salary?.toLocaleString() || 0}
                                    </span>
                                ) : (
                                    tenure || 'N/A'
                                )}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {canViewSalary
                                    ? `Tenure: ${tenure || 'N/A'}`
                                    : staff.joinDate
                                    ? `Joined ${format(new Date(staff.joinDate), 'MMM yyyy')}`
                                    : 'Active Member'}
                            </p>
                        </div>
                        <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            {canViewSalary ? <Banknote className="size-5" /> : <Calendar className="size-5" />}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Tabs Hub */}
            <Tabs defaultValue="overview" className="w-full space-y-6">
                <div className="border-b border-border pb-1">
                    <TabsList className="bg-muted/60 p-1">
                        <TabsTrigger value="overview" className="gap-2 px-4">
                            <UserCircle className="size-4" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="attendance" className="gap-2 px-4">
                            <Clock className="size-4" />
                            Attendance
                        </TabsTrigger>
                        <TabsTrigger value="leave" className="gap-2 px-4">
                            <CalendarDays className="size-4" />
                            Leaves
                        </TabsTrigger>
                        {canViewSalary && (
                            <TabsTrigger value="payments" className="gap-2 px-4">
                                <CreditCard className="size-4" />
                                Payments
                            </TabsTrigger>
                        )}
                        {canManageAccess && (
                            <TabsTrigger
                                value="permissions"
                                className="gap-2 px-4"
                            >
                                <KeyRound className="size-4" />
                                Permissions
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>

                {/* Tab 1: Overview */}
                <TabsContent value="overview" className="space-y-6 outline-none">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        {/* Left 2 Columns: Personal & Financial Info */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Personal Information Card */}
                            <Card className="border-border/60 shadow-xs bg-card overflow-hidden">
                                <CardHeader className="border-b border-border/40 bg-muted/20 pb-4 px-6">
                                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        <IdCard className="size-4 text-primary" />
                                        Personal & Demographic Information
                                    </CardTitle>
                                    <CardDescription>
                                        Employee identity, identification, and personal records
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
                                        <div className="space-y-1">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <Calendar className="size-3.5 opacity-70" />
                                                Date of Birth
                                            </span>
                                            <p className="text-sm font-medium text-foreground">
                                                {staff.dateOfBirth ? (
                                                    <span>
                                                        {format(new Date(staff.dateOfBirth), 'MMM dd, yyyy')}
                                                        {age !== null && (
                                                            <span className="text-xs text-muted-foreground ml-1.5">
                                                                ({age} yrs)
                                                            </span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <Droplet className="size-3.5 text-rose-500" />
                                                Blood Group
                                            </span>
                                            <p className="text-sm font-medium text-foreground">
                                                {staff.bloodGroup ? (
                                                    <Badge variant="secondary" className="font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20 text-xs">
                                                        {staff.bloodGroup}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <Fingerprint className="size-3.5 opacity-70" />
                                                National ID (NID)
                                            </span>
                                            <p className="text-sm font-mono font-medium text-foreground">
                                                {staff.nationalId || <span className="text-muted-foreground text-xs font-sans">—</span>}
                                            </p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <CalendarDays className="size-3.5 opacity-70" />
                                                Join Date
                                            </span>
                                            <p className="text-sm font-medium text-foreground">
                                                {staff.joinDate ? (
                                                    format(new Date(staff.joinDate), 'MMM dd, yyyy')
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <ShieldCheck className="size-3.5 opacity-70" />
                                                Profile Completion
                                            </span>
                                            <p className="text-sm font-medium">
                                                <Badge
                                                    variant="secondary"
                                                    className={
                                                        staff.profileCompleted
                                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                                    }
                                                >
                                                    {staff.profileCompleted ? 'Completed' : 'Pending Details'}
                                                </Badge>
                                            </p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <Users className="size-3.5 opacity-70" />
                                                Marital / Family
                                            </span>
                                            <p className="text-sm font-medium text-foreground">
                                                {staff.spouseName
                                                    ? `Spouse: ${staff.spouseName}`
                                                    : staff.fathersName
                                                    ? `Father: ${staff.fathersName}`
                                                    : <span className="text-muted-foreground text-xs">—</span>}
                                            </p>
                                        </div>

                                        <div className="col-span-1 sm:col-span-2 md:col-span-3 space-y-1 pt-2 border-t border-border/40">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <MapPin className="size-3.5 opacity-70" />
                                                Present Address
                                            </span>
                                            <p className="text-sm font-medium text-foreground">
                                                {staff.address || <span className="text-muted-foreground text-xs">No address specified</span>}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Bank Account Card */}
                            <Card className="border-border/60 shadow-xs bg-card overflow-hidden">
                                <CardHeader className="border-b border-border/40 bg-muted/20 pb-4 px-6">
                                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        <CreditCard className="size-4 text-primary" />
                                        Bank & Settlement Information
                                    </CardTitle>
                                    <CardDescription>
                                        Payroll disbursement account details
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
                                        <div className="space-y-1">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                Bank Name
                                            </span>
                                            <p className="text-sm font-semibold text-foreground">
                                                {bankName || <span className="text-muted-foreground text-xs font-normal">—</span>}
                                            </p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                Account Number
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-mono font-medium text-foreground">
                                                    {bankAccountNo || <span className="text-muted-foreground text-xs font-sans font-normal">—</span>}
                                                </p>
                                                {bankAccountNo && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(bankAccountNo, 'Account Number')}
                                                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                                                        title="Copy Account Number"
                                                    >
                                                        <Copy className="size-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                Account Holder Name
                                            </span>
                                            <p className="text-sm font-medium text-foreground">
                                                {bankAccountName || <span className="text-muted-foreground text-xs">—</span>}
                                            </p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                Bank Branch
                                            </span>
                                            <p className="text-sm font-medium text-foreground">
                                                {bankBranch || <span className="text-muted-foreground text-xs">—</span>}
                                            </p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                Routing Number
                                            </span>
                                            <p className="text-sm font-mono font-medium text-foreground">
                                                {bankRouting || <span className="text-muted-foreground text-xs font-sans font-normal">—</span>}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right 1 Column: Emergency Contact & Work Shift Details */}
                        <div className="space-y-6">
                            {/* Emergency Contact Card */}
                            <Card className="border-border/60 shadow-xs bg-card overflow-hidden">
                                <CardHeader className="border-b border-border/40 bg-muted/20 pb-4 px-6">
                                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        <HeartHandshake className="size-4 text-rose-500" />
                                        Emergency Contact
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    {staff.emergencyContact?.name || staff.emergencyContact?.phone ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between border-b border-border/40 pb-3">
                                                <span className="text-xs text-muted-foreground">Contact Name</span>
                                                <span className="text-sm font-semibold text-foreground">
                                                    {staff.emergencyContact.name || '—'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between border-b border-border/40 pb-3">
                                                <span className="text-xs text-muted-foreground">Relationship</span>
                                                <Badge variant="secondary" className="text-xs">
                                                    {staff.emergencyContact.relation || 'Relative'}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground">Phone</span>
                                                {staff.emergencyContact.phone ? (
                                                    <a
                                                        href={`tel:${staff.emergencyContact.phone}`}
                                                        className="text-sm font-semibold text-primary hover:underline flex items-center gap-1.5"
                                                    >
                                                        <Phone className="size-3.5" />
                                                        {staff.emergencyContact.phone}
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-6 text-center text-muted-foreground">
                                            <ShieldAlert className="size-8 mx-auto opacity-30 mb-2" />
                                            <p className="text-xs">No emergency contact provided</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Job & Shift Card */}
                            <Card className="border-border/60 shadow-xs bg-card overflow-hidden">
                                <CardHeader className="border-b border-border/40 bg-muted/20 pb-4 px-6">
                                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        <Clock className="size-4 text-violet-500" />
                                        Shift Schedule & Work Hours
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    {currentShift ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between border-b border-border/40 pb-3">
                                                <span className="text-xs text-muted-foreground">Shift Name</span>
                                                <span className="text-sm font-semibold text-foreground">
                                                    {currentShift.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between border-b border-border/40 pb-3">
                                                <span className="text-xs text-muted-foreground">Working Hours</span>
                                                <span className="text-sm font-mono font-medium text-foreground">
                                                    {currentShift.startTime} — {currentShift.endTime}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground">Workdays</span>
                                                <span className="text-xs font-semibold px-2 py-1 bg-muted rounded-md">
                                                    {currentShift.workDays?.length || 0} days / week
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-6 text-center text-muted-foreground">
                                            <Clock className="size-8 mx-auto opacity-30 mb-2" />
                                            <p className="text-xs">No active shift assigned</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* Tab 2: Attendance */}
                <TabsContent value="attendance" className="outline-none">
                    <Card className="border-border/60 shadow-xs">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg font-bold">Attendance Record</CardTitle>
                            <CardDescription>
                                Complete attendance history and punch logs for {user?.name}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <StaffAttendanceTab staffId={id} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 3: Leaves */}
                <TabsContent value="leave" className="outline-none">
                    <Card className="border-border/60 shadow-xs">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg font-bold">Leave Applications</CardTitle>
                            <CardDescription>
                                Track leave balances, history, and approval status
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <StaffLeaveTab staffId={id} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 4: Payments (Authorized only) */}
                {canViewSalary && (
                    <TabsContent value="payments" className="outline-none">
                        <Card className="border-border/60 shadow-xs">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg font-bold">Payment & Payroll History</CardTitle>
                                <CardDescription>
                                    Monthly disbursement records and transaction history
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <PaymentHistoryTab
                                    staffId={id}
                                    isPinSet={staff.isSalaryPinSet || false}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Tab 5: Permissions (role.assign only) */}
                {canManageAccess && (
                    <TabsContent value="permissions" className="outline-none">
                        <Card className="border-border/60 shadow-xs">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg font-bold">
                                    Permission Overrides
                                </CardTitle>
                                <CardDescription>
                                    Grant or revoke individual permissions for{' '}
                                    {user?.name || 'this user'}, on top of their
                                    role, department and designation.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {staff.userId ? (
                                    <UserAccessForm
                                        userId={staff.userId}
                                        embedded
                                    />
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        This staff record has no linked user
                                        account.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
