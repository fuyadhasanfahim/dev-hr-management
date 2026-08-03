import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Loader2, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateStaffMutation } from "@/redux/features/staff/staffApi";
import { Role } from "@/constants/role";
import { toast } from "sonner";

export interface Staff {
  _id: string;
  staffId: string;
  phone: string;
  department: string;
  designation: string;
  joinDate: string;
  status: string;
  profileCompleted: boolean;
  user?: {
    _id: string;
    name: string;
    email: string;
    image?: string;
    role: string;
  };
  branch?: {
    _id: string;
    name: string;
  };
  todayAttendance?: {
    status: string;
    checkInAt?: string;
    checkOutAt?: string;
    lateMinutes?: number;
  };
  currentShift?: {
    name: string;
    startTime: string;
    endTime: string;
  };
}

const ATTENDANCE_DOT_COLORS: Record<string, string> = {
  present: "bg-emerald-500",
  absent: "bg-red-500",
  late: "bg-amber-500",
  half_day: "bg-orange-500",
  early_exit: "bg-purple-500",
  on_leave: "bg-blue-500",
  weekend: "bg-slate-400",
  holiday: "bg-pink-500",
};

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
  early_exit: "Early Exit",
  on_leave: "On Leave",
  weekend: "Weekend",
  holiday: "Holiday",
};

function RoleSwitcher({ staff }: { staff: Staff }) {
  const [updateStaff, { isLoading }] = useUpdateStaffMutation();
  const currentRole = staff.user?.role || Role.STAFF;

  const handleRoleChange = async (newRole: string) => {
    if (newRole === currentRole) return;
    try {
      await updateStaff({
        id: staff.staffId,
        data: { role: newRole },
      }).unwrap();
      toast.success(`Role updated for ${staff.user?.name || "Staff"}`);
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = error as any;
      toast.error(e?.data?.message || "Failed to update role");
    }
  };

  return (
    <Select value={currentRole} onValueChange={handleRoleChange} disabled={isLoading}>
      <SelectTrigger className="h-8 w-[130px] text-xs bg-background">
        <div className="flex items-center gap-2 truncate">
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ShieldCheck className="h-3 w-3 text-primary/80" />
          )}
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={Role.STAFF} className="text-xs">Staff</SelectItem>
        <SelectItem value={Role.TEAM_LEADER} className="text-xs">Team Leader</SelectItem>
        <SelectItem value={Role.HR_MANAGER} className="text-xs">HR Manager</SelectItem>
        <SelectItem value={Role.ADMIN} className="text-xs">Admin</SelectItem>
        <SelectItem value={Role.SUPER_ADMIN} className="text-xs">Super Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}

interface StaffTableProps {
  staffs: Staff[];
  isLoading: boolean;
  onView: (staff: Staff) => void;
}

export function StaffTable({ staffs, isLoading, onView }: StaffTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-border hover:bg-transparent bg-muted/40">
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">
            Name
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Staff ID
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Department
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Designation
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Shift
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Role
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Today
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index} className="border-b border-border/60">
              <TableCell className="pl-6"><Skeleton className="h-3.5 w-[120px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[80px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[90px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[90px]" /></TableCell>
              <TableCell><Skeleton className="h-8 w-[130px]" /></TableCell>
              <TableCell><Skeleton className="h-8 w-[130px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[70px]" /></TableCell>
              <TableCell className="pr-6"><Skeleton className="h-7 w-[80px] ml-auto" /></TableCell>
            </TableRow>
          ))
        ) : staffs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="h-40 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-brand-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No staff members found matching your criteria.
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          staffs.map((staff) => {
            const attendanceStatus = staff.todayAttendance?.status;
            const dot = attendanceStatus ? ATTENDANCE_DOT_COLORS[attendanceStatus] : undefined;
            const label = attendanceStatus ? ATTENDANCE_LABELS[attendanceStatus] || attendanceStatus : null;

            return (
              <TableRow key={staff._id} className="cursor-pointer" onClick={() => onView(staff)}>
                {/* Name */}
                <TableCell className="pl-6">
                  <span className="text-sm text-foreground truncate max-w-[150px] block">
                    {staff.user?.name || "N/A"}
                  </span>
                </TableCell>

                {/* Staff ID */}
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground">
                    {staff.staffId}
                  </span>
                </TableCell>

                {/* Department */}
                <TableCell>
                  <span className="text-sm text-foreground/80">
                    {staff.department || "N/A"}
                  </span>
                </TableCell>

                {/* Designation */}
                <TableCell>
                  <span className="text-sm text-foreground/80">
                    {staff.designation || "N/A"}
                  </span>
                </TableCell>

                {/* Shift */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {staff.currentShift ? (
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground">{staff.currentShift.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {staff.currentShift.startTime} - {staff.currentShift.endTime}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No Shift</span>
                  )}
                </TableCell>

                {/* Role */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <RoleSwitcher staff={staff} />
                </TableCell>

                {/* Today */}
                <TableCell>
                  {label ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-foreground/80">
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dot)} />
                      {label}
                    </span>
                  ) : (
                    <Badge variant="outline" className="text-xs font-normal">No Record</Badge>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="View Details"
                      onClick={() => onView(staff)}
                      className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
