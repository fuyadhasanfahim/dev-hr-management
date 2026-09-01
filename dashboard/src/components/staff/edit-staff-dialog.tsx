"use client";

import { Button } from "@/components/ui/button";
import { SharedDialog } from "@/components/shared/shared-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Role } from "@/constants/role";
import { useGetAllBranchesQuery } from "@/redux/features/branch/branchApi";
import { useGetAllDepartmentsQuery } from "@/redux/features/department/departmentApi";
import { useGetAllDesignationsQuery } from "@/redux/features/designation/designationApi";
import { useUpdateStaffMutation } from "@/redux/features/staff/staffApi";
import IStaff from "@/types/staff.type";
import { zodResolver } from "@hookform/resolvers/zod";
import { DESIGNATIONS, DEPARTMENTS } from "@/constants/metadata";
import { Edit, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
    branchId: z.string().optional(),
    department: z.string().min(1, "Department is required"),
    designation: z.string().min(1, "Designation is required"),
    role: z.string().optional(),
    status: z.enum(["active", "inactive", "terminated"]),
    salary: z.number().min(0, "Salary must be positive"),
    salaryVisibleToEmployee: z.boolean(),
    // Bank Account Fields
    bank: z.object({
        bankName: z.string().optional(),
        accountNumber: z.string().optional(),
        accountHolderName: z.string().optional(),
        branch: z.string().optional(),
        routingNumber: z.string().optional(),
    }),
});

type FormData = z.infer<typeof formSchema>;

interface EditStaffDialogProps {
    staff: IStaff;
    currentShiftId?: string;
}

export function EditStaffDialog({ staff }: EditStaffDialogProps) {
    const [open, setOpen] = useState(false);

    const { data: branchesData } = useGetAllBranchesQuery({});
    const { data: deptData } = useGetAllDepartmentsQuery({ isActive: true });
    const { data: desigData } = useGetAllDesignationsQuery({ isActive: true });
    const [updateStaff, { isLoading }] = useUpdateStaffMutation();

    // Build available departments list and guarantee current value is present
    const availableDepartments = useMemo(() => {
        const list: { value: string; label: string }[] = [];
        if (deptData?.departments?.length) {
            deptData.departments.forEach((d) => {
                list.push({ value: d.name, label: d.name });
            });
        } else {
            DEPARTMENTS.forEach((d) => {
                list.push({ value: d.label, label: d.label });
            });
        }

        if (
            staff?.department &&
            !list.some(
                (item) =>
                    item.value.toLowerCase() ===
                        staff.department?.toLowerCase() ||
                    item.label.toLowerCase() === staff.department?.toLowerCase()
            )
        ) {
            list.push({ value: staff.department, label: staff.department });
        }
        return list;
    }, [deptData?.departments, staff?.department]);

    // Build available designations list and guarantee current value is present
    const availableDesignations = useMemo(() => {
        const list: { value: string; label: string }[] = [];
        if (desigData?.designations?.length) {
            desigData.designations.forEach((d) => {
                // Store the designation *code* (lower_snake_case) so it matches
                // what the invite flow saves and what the permission resolver
                // looks grants up by.
                list.push({ value: d.code, label: d.name });
            });
        } else {
            DESIGNATIONS.forEach((d) => {
                list.push({ value: d.value, label: d.label });
            });
        }

        if (
            staff?.designation &&
            !list.some(
                (item) =>
                    item.value.toLowerCase() ===
                        staff.designation?.toLowerCase() ||
                    item.label.toLowerCase() ===
                        staff.designation?.toLowerCase()
            )
        ) {
            list.push({ value: staff.designation, label: staff.designation });
        }
        return list;
    }, [desigData?.designations, staff?.designation]);

    // Build available branches list and guarantee current branch is present
    const availableBranches = useMemo(() => {
        const list: { _id: string; name: string }[] = [];
        if (branchesData?.branches?.length) {
            branchesData.branches.forEach((b: any) => {
                list.push({ _id: b._id, name: b.name });
            });
        }

        if (
            staff?.branch?._id &&
            !list.some((b) => b._id === staff.branch._id)
        ) {
            list.push({
                _id: staff.branch._id,
                name: staff.branch.name || "Assigned Branch",
            });
        }
        return list;
    }, [branchesData?.branches, staff?.branch]);

    // Helper functions to resolve normalized matching values
    const resolveDepartmentValue = (deptStr?: string) => {
        if (!deptStr) return "";
        const found = availableDepartments.find(
            (d) =>
                d.value.toLowerCase() === deptStr.toLowerCase() ||
                d.label.toLowerCase() === deptStr.toLowerCase()
        );
        return found ? found.value : deptStr;
    };

    const resolveDesignationValue = (desigStr?: string) => {
        if (!desigStr) return "";
        const found = availableDesignations.find(
            (d) =>
                d.value.toLowerCase() === desigStr.toLowerCase() ||
                d.label.toLowerCase() === desigStr.toLowerCase()
        );
        return found ? found.value : desigStr;
    };

    const resolveBranchId = () => {
        const id =
            (typeof staff?.branchId === "object" && staff?.branchId !== null
                ? (staff.branchId as any)._id
                : staff?.branchId) ||
            staff?.branch?._id ||
            "";
        return id;
    };

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            branchId: resolveBranchId(),
            department: resolveDepartmentValue(staff?.department),
            designation: resolveDesignationValue(staff?.designation),
            role: staff?.user?.role || Role.STAFF,
            status: staff?.status || "active",
            salary: staff?.salary || 0,
            salaryVisibleToEmployee: staff?.salaryVisibleToEmployee !== false,
            bank: {
                bankName:
                    staff?.bank?.bankName || (staff as any)?.bankName || "",
                accountNumber:
                    staff?.bank?.accountNumber ||
                    (staff as any)?.bankAccountNo ||
                    "",
                accountHolderName:
                    staff?.bank?.accountHolderName ||
                    (staff as any)?.bankAccountName ||
                    "",
                branch:
                    staff?.bank?.branch || (staff as any)?.branchName || "",
                routingNumber: staff?.bank?.routingNumber || "",
            },
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                branchId: resolveBranchId(),
                department: resolveDepartmentValue(staff?.department),
                designation: resolveDesignationValue(staff?.designation),
                role: staff?.user?.role || Role.STAFF,
                status: staff?.status || "active",
                salary: staff?.salary || 0,
                salaryVisibleToEmployee:
                    staff?.salaryVisibleToEmployee !== false,
                bank: {
                    bankName:
                        staff?.bank?.bankName ||
                        (staff as any)?.bankName ||
                        "",
                    accountNumber:
                        staff?.bank?.accountNumber ||
                        (staff as any)?.bankAccountNo ||
                        "",
                    accountHolderName:
                        staff?.bank?.accountHolderName ||
                        (staff as any)?.bankAccountName ||
                        "",
                    branch:
                        staff?.bank?.branch ||
                        (staff as any)?.branchName ||
                        "",
                    routingNumber: staff?.bank?.routingNumber || "",
                },
            });
        }
    }, [open, staff, availableDepartments, availableDesignations, availableBranches]);

    const onSubmit = async (data: FormData) => {
        try {
            await updateStaff({
                id: staff?._id || (staff as any)?.id || staff?.staffId,
                ...data,
            }).unwrap();

            toast.success("Staff profile updated successfully");
            setOpen(false);
        } catch (error: any) {
            toast.error(
                error?.data?.message || "Failed to update staff profile"
            );
        }
    };

    return (
        <SharedDialog
            open={open}
            onOpenChange={setOpen}
            trigger={
                <Button variant="outline" size="sm" className="gap-1.5">
                    <Edit className="h-4 w-4" />
                    Edit Profile
                </Button>
            }
            title="Edit Staff Profile"
            description="Update employment details, role, salary and bank information."
            className="sm:max-w-2xl"
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="edit-staff-form"
                        disabled={isLoading}
                    >
                        {isLoading && (
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        )}
                        Save Changes
                    </Button>
                </>
            }
        >
            <form
                id="edit-staff-form"
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6 w-full"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    {/* Department */}
                    <div className="space-y-2 w-full">
                        <Label>Department</Label>
                        <Controller
                            control={form.control}
                            name="department"
                            render={({ field }) => (
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value || ""}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableDepartments.map((dept) => (
                                            <SelectItem
                                                key={dept.value}
                                                value={dept.value}
                                            >
                                                {dept.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {form.formState.errors.department && (
                            <p className="text-sm text-destructive">
                                {form.formState.errors.department.message}
                            </p>
                        )}
                    </div>

                    {/* Designation */}
                    <div className="space-y-2 w-full">
                        <Label>Designation</Label>
                        <Controller
                            control={form.control}
                            name="designation"
                            render={({ field }) => (
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value || ""}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select designation" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableDesignations.map((desig) => (
                                            <SelectItem
                                                key={desig.value}
                                                value={desig.value}
                                            >
                                                {desig.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {form.formState.errors.designation && (
                            <p className="text-sm text-destructive">
                                {form.formState.errors.designation.message}
                            </p>
                        )}
                    </div>

                    {/* Branch */}
                    <div className="space-y-2 w-full">
                        <Label>Branch</Label>
                        <Controller
                            control={form.control}
                            name="branchId"
                            render={({ field }) => (
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value || ""}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select branch" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableBranches.map((branch) => (
                                            <SelectItem
                                                key={branch._id}
                                                value={branch._id}
                                            >
                                                {branch.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {form.formState.errors.branchId && (
                            <p className="text-sm text-destructive">
                                {form.formState.errors.branchId.message}
                            </p>
                        )}
                    </div>

                    {/* Status */}
                    <div className="space-y-2 w-full">
                        <Label>Status</Label>
                        <Controller
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value || "active"}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">
                                            Active
                                        </SelectItem>
                                        <SelectItem value="inactive">
                                            Inactive
                                        </SelectItem>
                                        <SelectItem value="terminated">
                                            Terminated
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                </div>

                <div className="border-t border-border/60 pt-4 w-full">
                    <h4 className="text-sm font-semibold mb-4">
                        Role & Permissions
                    </h4>
                    <div className="space-y-2 w-full">
                        <Label>System Role</Label>
                        <Controller
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value || Role.STAFF}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={Role.STAFF}>
                                            Staff
                                        </SelectItem>
                                        <SelectItem
                                            value={Role.TEAM_LEADER}
                                        >
                                            Team Leader
                                        </SelectItem>
                                        <SelectItem value={Role.HR_MANAGER}>
                                            HR Manager
                                        </SelectItem>
                                        <SelectItem value={Role.ADMIN}>
                                            Admin
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                </div>

                <div className="border-t border-border/60 pt-4 w-full">
                    <h4 className="text-sm font-semibold mb-4">
                        Compensation
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        <div className="space-y-2 w-full">
                            <Label htmlFor="salary">
                                Base Salary (Monthly)
                            </Label>
                            <Input
                                id="salary"
                                type="number"
                                className="w-full"
                                {...form.register("salary", {
                                    valueAsNumber: true,
                                })}
                            />
                            {form.formState.errors.salary && (
                                <p className="text-sm text-destructive">
                                    {form.formState.errors.salary.message}
                                </p>
                            )}
                        </div>

                        <div className="md:mt-1 w-full">
                            <Controller
                                control={form.control}
                                name="salaryVisibleToEmployee"
                                render={({ field }) => (
                                    <div className="flex flex-row items-center justify-between rounded-lg border border-border/60 p-3 shadow-xs h-full bg-muted/20 w-full">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-medium">
                                                Visible to Staff
                                            </Label>
                                            <div className="text-xs text-muted-foreground">
                                                Can staff see this salary?
                                            </div>
                                        </div>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                </div>

                {/* Bank Account Section */}
                <div className="border-t border-border/60 pt-4 w-full">
                    <h4 className="text-sm font-semibold mb-4">
                        Bank Account Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        <div className="space-y-2 w-full">
                            <Label htmlFor="bankName">Bank Name</Label>
                            <Input
                                id="bankName"
                                placeholder="e.g., Dutch Bangla Bank"
                                className="w-full"
                                {...form.register("bank.bankName")}
                            />
                        </div>

                        <div className="space-y-2 w-full">
                            <Label htmlFor="accountNumber">
                                Account Number
                            </Label>
                            <Input
                                id="accountNumber"
                                placeholder="e.g., 1234567890"
                                className="w-full"
                                {...form.register("bank.accountNumber")}
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2 w-full">
                            <Label htmlFor="accountHolderName">
                                Account Holder Name
                            </Label>
                            <Input
                                id="accountHolderName"
                                placeholder="Name as per bank account"
                                className="w-full"
                                {...form.register("bank.accountHolderName")}
                            />
                        </div>

                        <div className="space-y-2 w-full">
                            <Label htmlFor="branch">Branch</Label>
                            <Input
                                id="branch"
                                placeholder="Branch Name"
                                className="w-full"
                                {...form.register("bank.branch")}
                            />
                        </div>

                        <div className="space-y-2 w-full">
                            <Label htmlFor="routingNumber">
                                Routing Number
                            </Label>
                            <Input
                                id="routingNumber"
                                placeholder="Routing Number"
                                className="w-full"
                                {...form.register("bank.routingNumber")}
                            />
                        </div>
                    </div>
                </div>
            </form>
        </SharedDialog>
    );
}
