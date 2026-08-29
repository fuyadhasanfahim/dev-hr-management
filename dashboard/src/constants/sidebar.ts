import { Role } from "@/constants/role";
import {
    IconLayoutDashboard,
    IconArrowsShuffle,
    IconCalendarOff,
    IconMail,
    IconCalendarStats,
    IconReceipt,
    IconUsers,
    IconPackage,
    IconChartBar,
    IconUserShare,
    IconCreditCard,
    IconUserCircle,
    IconSpeakerphone,
    IconBriefcase,
    IconCash,
    IconWallet,
    IconShieldLock,
    IconCalendarEvent,
    IconTarget,
    IconClipboardList,
    IconMessageChatbot,
    IconFileInvoice,
    IconBuildingCommunity,
} from "@tabler/icons-react";


export interface SidebarItem {
    title: string;
    url: string;
    icon: React.ComponentType<{ strokeWidth?: number; className?: string }>;
    /** Legacy role gate — kept as the fallback when `permission` is unset. */
    access: Role[];
    /**
     * Phase 4 — permission gate. When set, the item shows only if the user
     * holds this permission (or all of them, if an array). Takes precedence
     * over `access`.
     */
    permission?: string | string[];
    requiredDesignation?: string;
    external?: boolean;
}

export interface SidebarGroup {
    groupLabel: string;
    items: SidebarItem[];
}

export const sidebarGroups: SidebarGroup[] = [
    {
        groupLabel: "Overview",
        items: [
            {
                title: "Dashboard",
                url: "/dashboard",
                permission: 'dashboard.read',
                icon: IconLayoutDashboard,
                access: [
                    Role.SUPER_ADMIN,
                    Role.ADMIN,
                    Role.HR_MANAGER,
                    Role.TEAM_LEADER,
                    Role.STAFF,
                ],
            },
            {
                title: "Profile",
                url: "/account",
                icon: IconUserCircle,
                access: [
                    Role.SUPER_ADMIN,
                    Role.ADMIN,
                    Role.HR_MANAGER,
                    Role.TEAM_LEADER,
                    Role.STAFF,
                ],
            },
            {
                title: "Tasks & Kanban",
                url: "/tasks",
                permission: 'task.read',
                icon: IconClipboardList,
                access: [
                    Role.SUPER_ADMIN,
                    Role.ADMIN,
                    Role.HR_MANAGER,
                    Role.TEAM_LEADER,
                    Role.STAFF,
                ],
            },
            {
                title: "Analytics",
                url: "/analytics",
                permission: 'analytics.read',
                icon: IconChartBar,
                access: [Role.SUPER_ADMIN, Role.ADMIN],
            },
        ],
    },

    {
        groupLabel: "Business",
        items: [
            {
                title: "Leads",
                url: "/leads",
                permission: 'lead.read',
                icon: IconTarget,
                access: [
                    Role.SUPER_ADMIN,
                    Role.ADMIN,
                    Role.TEAM_LEADER,
                    Role.STAFF,
                ],
                requiredDesignation: "telemarketer",
            },
            {
                title: "Clients",
                url: "/clients",
                permission: 'client.read',
                icon: IconUsers,
                access: [
                    Role.SUPER_ADMIN,
                    Role.ADMIN,
                    Role.TEAM_LEADER,
                    Role.STAFF,
                ],
                requiredDesignation: "telemarketer",
            },
            {
                title: "Orders",
                url: "/orders",
                permission: 'order.read',
                icon: IconPackage,
                access: [
                    Role.SUPER_ADMIN,
                    Role.ADMIN,
                    Role.TEAM_LEADER,
                    Role.STAFF,
                ],
            },
            {
                title: "Earnings",
                url: "/earnings",
                permission: 'earning.read',
                icon: IconReceipt,
                access: [Role.SUPER_ADMIN, Role.ADMIN],
            },

            {
                title: "Quotations",
                url: "/quotations",
                permission: 'quotation.read',
                icon: IconReceipt,
                access: [Role.SUPER_ADMIN, Role.ADMIN, Role.TEAM_LEADER],
            },
            {
                title: "Receipts",
                url: "/receipts",
                permission: 'receipt.read',
                icon: IconFileInvoice,
                access: [Role.SUPER_ADMIN, Role.ADMIN, Role.TEAM_LEADER],
            },
            {
                title: "Meetings",
                url: "/meetings",
                permission: 'meeting.read',
                icon: IconCalendarEvent,
                access: [Role.SUPER_ADMIN, Role.ADMIN, Role.TEAM_LEADER],
            },
            {
                title: "Consultations",
                url: "/consultations",
                permission: 'consultation.read',
                icon: IconMessageChatbot,
                access: [Role.SUPER_ADMIN, Role.ADMIN],
            },

            {
                title: "Profit Share",
                url: "/profit-share",
                permission: 'profitShare.read',
                icon: IconUserShare,
                access: [Role.SUPER_ADMIN, Role.ADMIN],
            },
            {
                title: "Balances",
                url: "/balances",
                icon: IconWallet,
                access: [
                    Role.SUPER_ADMIN,
                    Role.ADMIN,
                    Role.TEAM_LEADER,
                    Role.STAFF,
                ],
                requiredDesignation: "telemarketer",
            },
        ],
    },
    {
        groupLabel: "Team Management",
        items: [
            {
                title: "Staffs",
                url: "/staffs",
                permission: 'staff.read',
                icon: IconUsers,
                access: [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER],
            },
            {
                title: "Invitations",
                url: "/invitations",
                permission: 'invitation.read',
                icon: IconMail,
                access: [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER],
            },
            {
                title: "Shifting",
                url: "/shifting",
                permission: 'shift.read',
                icon: IconArrowsShuffle,
                access: [
                    Role.SUPER_ADMIN,
                    Role.ADMIN,
                    Role.HR_MANAGER,
                    Role.TEAM_LEADER,
                ],
            },
            {
                title: "Attendance",
                url: "/attendance",
                permission: 'attendance.read',
                icon: IconCalendarStats,
                access: [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.TEAM_LEADER],
            },
            {
                title: "Careers",
                url: "/careers",
                permission: 'career.read',
                icon: IconBriefcase,
                access: [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER],
            },
            {
                title: "Organization",
                url: "/organization",
                icon: IconBuildingCommunity,
                access: [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER],
            },
            {
                title: "Roles & Permissions",
                url: "/roles",
                permission: 'role.read',
                icon: IconShieldLock,
                access: [Role.SUPER_ADMIN, Role.ADMIN],
            },
        ],
    },
    {
        groupLabel: "HR & Leave",
        items: [
            {
                title: "Leave Application",
                url: "/leave/apply",
                permission: 'leave.apply',
                icon: IconCalendarOff,
                access: [
                    Role.SUPER_ADMIN,
                    Role.ADMIN,
                    Role.HR_MANAGER,
                    Role.TEAM_LEADER,
                    Role.STAFF,
                ],
            },
            {
                title: "Leave Management",
                url: "/leave/manage",
                permission: 'leave.manage',
                icon: IconCalendarStats,
                access: [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER],
            },

        ],
    },
    {
        groupLabel: "Finance",
        items: [
            {
                title: "Expense",
                url: "/expense",
                permission: 'expense.read',
                icon: IconReceipt,
                access: [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER],
            },
            {
                title: "Debit",
                url: "/debit",
                permission: 'debit.read',
                icon: IconCreditCard,
                access: [Role.SUPER_ADMIN, Role.ADMIN],
            },
            {
                title: "Payroll",
                url: "/payroll",
                permission: 'payroll.read',
                icon: IconCash,
                access: [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER],
            },
        ],
    },
    {
        groupLabel: "Communication",
        items: [
            {
                title: "Notices",
                url: "/notices",
                permission: 'notice.read',
                icon: IconSpeakerphone,
                access: [
                    Role.SUPER_ADMIN,
                    Role.ADMIN,
                    Role.HR_MANAGER,
                    Role.TEAM_LEADER,
                    Role.STAFF,
                ],
            },
            {
                title: "Policies",
                url: "/policies",
                permission: 'policy.read',
                icon: IconShieldLock,
                access: [
                    Role.SUPER_ADMIN,
                    Role.ADMIN,
                    Role.HR_MANAGER,
                    Role.TEAM_LEADER,
                    Role.STAFF,
                ],
            },
            {
                title: "Notice Management",
                url: "/notices/manage",
                permission: 'notice.create',
                icon: IconSpeakerphone,
                access: [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER],
            },
            {
                title: "Support Console",
                url: process.env.NEXT_PUBLIC_SUPPORT_URL || 'http://localhost:3002',
                icon: IconSpeakerphone,
                external: true,
                access: [
                    Role.SUPER_ADMIN,
                    Role.ADMIN,
                    Role.HR_MANAGER,
                    Role.TEAM_LEADER,
                    Role.STAFF,
                ],
            },
        ],
    },
];

// Flat array for backward compatibility
export const sidebarData = sidebarGroups.flatMap((group) => group.items);
