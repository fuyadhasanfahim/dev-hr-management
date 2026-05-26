export interface StaffStats {
    total: number;
    active: number;
    inactive: number;
    byDepartment: {
        department: string;
        count: number;
    }[];
}

export interface AttendanceOverview {
    date: string;
    total: number;
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    presentPercentage: number;
}

export interface MonthlyAttendanceStats {
    month: string;
    year: number;
    totalWorkingDays: number;
    totalPresent: number;
    totalAbsent: number;
    totalLate: number;
    averageAttendance: number;
}



export interface RecentActivity {
    _id: string;
    type: 'attendance' | 'shift' | 'staff' | 'leave';
    action: string;
    description: string;
    user: {
        _id: string;
        name: string;
        email: string;
    };
    timestamp: string;
}

export interface DashboardStats {
    staffStats: StaffStats;
    attendanceOverview: AttendanceOverview;
    monthlyAttendanceStats: MonthlyAttendanceStats;

    recentActivities: RecentActivity[];
}
