"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useGetStaffsQuery } from "@/redux/features/staff/staffApi";
import { useGetAllShiftsQuery } from "@/redux/features/shift/shiftApi";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader, TrendingUp, TrendingDown } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { StaffFilters } from "@/components/staff/StaffFilters";
import { StaffTable, type Staff } from "@/components/staff/StaffTable";
import { StaffPagination } from "@/components/staff/StaffPagination";

export default function StaffsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);

  const [departmentFilter, setDepartmentFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const queryParams = {
    page,
    limit,
    search: debouncedSearch || undefined,
    department: departmentFilter || undefined,
    designation: designationFilter || undefined,
    shiftId: shiftFilter || undefined,
    status: statusFilter || undefined,
  };

  const { data, isLoading, isFetching } = useGetStaffsQuery(queryParams);
  const { data: shiftsData } = useGetAllShiftsQuery({});

  const staffs: Staff[] = useMemo(() => data?.staffs || [], [data]);
  const meta = data?.meta;
  const shifts = shiftsData?.shifts || [];

  const handleViewDetails = (staff: Staff) => {
    router.push(`/staffs/${staff._id}`);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === "search") setSearchQuery(value);
    if (key === "status") setStatusFilter(value);
    if (key === "department") setDepartmentFilter(value);
    if (key === "designation") setDesignationFilter(value);
    if (key === "shiftId") setShiftFilter(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setDepartmentFilter("");
    setDesignationFilter("");
    setShiftFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const staffStats = useMemo(() => {
    const total = meta?.total ?? staffs.length;
    const active = staffs.filter((s) => s.status === "active").length;
    const inactive = staffs.filter((s) => s.status === "inactive").length;
    const presentToday = staffs.filter((s) => s.todayAttendance?.status === "present").length;

    return [
      {
        description: "Total Staff",
        value: total,
        trend: "up" as const,
        trendLabel: "All",
        footerTitle: "All registered staff members",
      },
      {
        description: "Active",
        value: active,
        trend: "up" as const,
        trendLabel: "Active",
        footerTitle: "Currently active accounts",
      },
      {
        description: "Inactive",
        value: inactive,
        trend: inactive > 0 ? ("down" as const) : ("up" as const),
        trendLabel: "Inactive",
        footerTitle: "Deactivated accounts",
      },
      {
        description: "Present Today",
        value: presentToday,
        trend: "up" as const,
        trendLabel: "Today",
        footerTitle: "Checked in today",
      },
    ];
  }, [meta, staffs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full min-h-screen pb-10"
    >
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Staff Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            View and manage staff members, attendance, and details
            {(isLoading || isFetching) && (
              <Loader className="h-3 w-3 animate-spin text-primary" />
            )}
          </p>
        </div>
      </div>

      {/* ── Stats Strip ──────────────────────────────────────────── */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        {staffStats.map((stat) => {
          const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown;
          return (
            <Card key={stat.description} className="@container/card">
              <CardHeader>
                <CardDescription>{stat.description}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {stat.value}
                </CardTitle>
                <CardAction>
                  <Badge variant="outline" className="text-primary border-primary/30">
                    <TrendIcon className="text-primary" />
                    {stat.trendLabel}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium">
                  {stat.footerTitle}
                  <TrendIcon className="size-4 text-primary" />
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* ── Filters Card ─────────────────────────────────────────── */}
      <Card className="mt-5 py-0 shadow-sm">
        <div className="px-5 py-4">
          <StaffFilters
            search={searchQuery}
            status={statusFilter}
            department={departmentFilter}
            designation={designationFilter}
            shiftId={shiftFilter}
            shifts={shifts}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />
        </div>
      </Card>

      {/* ── Table Card ───────────────────────────────────────────── */}
      <Card className="mt-4 py-0 gap-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <StaffTable
            staffs={staffs}
            isLoading={isLoading || isFetching}
            onView={handleViewDetails}
          />
        </div>

        <Separator />

        {/* Footer: Count + Pagination */}
        <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
          <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            Showing{' '}
            <span className="mx-1 font-medium text-foreground/80">
              {staffs.length}
            </span>{' '}
            of{' '}
            <span className="mx-1 font-medium text-foreground/80">
              {meta?.total ?? staffs.length}
            </span>{' '}
            staff members
          </p>
          <StaffPagination
            currentPage={page}
            totalPages={meta?.totalPage ?? 1}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            isLoading={isLoading || isFetching}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}
