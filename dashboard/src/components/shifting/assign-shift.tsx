"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Role } from "@/constants/role";
import { useSession } from "@/lib/auth-client";
import { useGetAllShiftsQuery } from "@/redux/features/shift/shiftApi";
import { useGetStaffsQuery } from "@/redux/features/staff/staffApi";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useState, useCallback } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import z from "zod";
import { DatePicker } from "../shared/DatePicker";
import { Combobox } from "../ui/combobox";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import IStaff from "@/types/staff.type";
import { IShift } from "@/types/shift.type";
import { toast } from "sonner";
import { useAssignShiftMutation } from "@/redux/features/shiftAssignment/shiftAssignmentApi";
import { usePermissions } from "@/hooks/use-permissions";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { Checkbox } from "../ui/checkbox";

const shiftAssignSchema = z.object({
  staffIds: z.array(z.string()).min(1, "At least one staff member is required"),
  shiftId: z.string().min(1, "Shift is required"),
  startDate: z
    .date()
    .refine(
      (date) => date >= new Date(new Date().setHours(0, 0, 0, 0)),
      "Start date must be today or later",
    ),
});

type FormData = z.infer<typeof shiftAssignSchema>;

export default function AssignShift() {
  const { data: session, isPending } = useSession();

  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [staffSelectOpen, setStaffSelectOpen] = useState(false);

  const {
    data: staffsData,
    isLoading: isStaffsLoading,
  } = useGetStaffsQuery(
    { limit: 1000, status: "active" },
    { skip: !session || session.user.role === Role.STAFF },
  );

  const {
    data: shiftsData,
    isLoading: isShiftsLoading,
  } = useGetAllShiftsQuery(
    {},
    { skip: !session || session.user.role === Role.STAFF },
  );

  const [assignShift, { isLoading: isAssigning }] = useAssignShiftMutation();

  const form = useForm<FormData>({
    resolver: zodResolver(shiftAssignSchema),
    defaultValues: {
      staffIds: [],
      shiftId: "",
      startDate: new Date(),
    },
  });

  const shiftId = useWatch({ control: form.control, name: "shiftId" });
  const startDate = useWatch({ control: form.control, name: "startDate" });
  const watchStaffIds =
    useWatch({ control: form.control, name: "staffIds" }) || [];

  const isLoading =
    isPending ||
    (isStaffsLoading && !staffsData) ||
    (isShiftsLoading && !shiftsData);

  const canCreate = session && session.user.role !== Role.STAFF;

  const getStaffById = useCallback(
    (id: string): IStaff | undefined => {
      return staffsData?.staffs?.find((s: IStaff) => s._id === id);
    },
    [staffsData?.staffs],
  );

  const onSubmit = async (data: FormData) => {
    try {
      const result = await assignShift({
        staffIds: data.staffIds,
        shiftId: data.shiftId,
        startDate: data.startDate.toISOString(),
      }).unwrap();

      if (result.success) {
        toast.success(result.message);
        form.reset();
        setOpen(false);
      } else {
        toast.error(result.message || "Failed to assign shift");
      }
    } catch (error) {
      toast.error((error as Error).message || "Failed to assign shift");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!can("shift.assign")) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          form.reset();
        }
        setOpen(isOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={isLoading || !canCreate}>
          <IconPlus className="h-4 w-4" />
          Assign Shift
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl p-0 flex flex-col max-h-[90vh]">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col min-h-0 flex-1"
        >
          {/* Fixed header */}
          <div className="px-6 pt-6 pb-4 shrink-0">
            <DialogHeader>
              <DialogTitle>Assign Shift to Staff</DialogTitle>
              <DialogDescription>
                Select one or more staff members and assign them to a shift.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Scrollable body — key fix: overflow-y-auto + min-h-0 */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6">
            <div className="grid gap-6 pb-4">
              {/* Shift Selection */}
              <div className="grid gap-3">
                <Label className="font-semibold">Shift Selection *</Label>
                <Combobox
                  value={shiftId}
                  onChange={(v) =>
                    form.setValue("shiftId", v, { shouldValidate: true })
                  }
                  isLoading={isShiftsLoading}
                  placeholder="Select shift"
                  searchPlaceholder="Search shift..."
                  emptyText="No shift found."
                  options={(shiftsData?.shifts || [])
                    .filter((s: IShift) => s.isActive)
                    .map((shift: IShift) => ({
                      value: shift._id,
                      label: shift.name,
                      description: `${shift.startTime} - ${shift.endTime}`,
                    }))}
                />
                {form.formState.errors.shiftId && (
                  <p className="text-sm text-destructive font-medium">
                    {form.formState.errors.shiftId.message}
                  </p>
                )}
              </div>

              {/* Staff Members */}
              <div className="grid gap-3">
                <Label className="font-semibold">Staff Members *</Label>

                <Controller
                  name="staffIds"
                  control={form.control}
                  render={({ field }) => {
                    const allStaffIds: string[] =
                      staffsData?.staffs?.map((s: IStaff) => s._id) || [];
                    const isAllSelected =
                      allStaffIds.length > 0 &&
                      field.value.length === allStaffIds.length;

                    const toggleStaff = (staffId: string) => {
                      const isSelected = field.value.includes(staffId);
                      field.onChange(
                        isSelected
                          ? field.value.filter((id: string) => id !== staffId)
                          : [...field.value, staffId],
                      );
                    };

                    const toggleAll = () => {
                      field.onChange(isAllSelected ? [] : allStaffIds);
                    };

                    const removeStaff = (staffId: string) => {
                      field.onChange(
                        field.value.filter((id: string) => id !== staffId),
                      );
                    };

                    return (
                      <div className="space-y-3">
                        <Popover open={staffSelectOpen} onOpenChange={setStaffSelectOpen} modal>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={staffSelectOpen}
                              className="w-full justify-between h-10 text-left font-normal"
                            >
                              <span
                                className={cn(
                                  "truncate",
                                  field.value.length === 0 &&
                                    "text-muted-foreground",
                                )}
                              >
                                {field.value.length === 0
                                  ? "Select staff members..."
                                  : `${field.value.length} staff selected`}
                              </span>
                              {isStaffsLoading ? (
                                <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
                              ) : (
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              )}
                            </Button>
                          </PopoverTrigger>

                          <PopoverContent
                            className="w-[var(--radix-popover-trigger-width)] p-0"
                            align="start"
                          >
                            <Command>
                              <CommandInput placeholder="Search name, ID, or designation..." />
                              <CommandList className="max-h-72">
                                <CommandEmpty>No staff found.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="__select_all__"
                                    keywords={["select all"]}
                                    onSelect={toggleAll}
                                  >
                                    <Checkbox
                                      checked={isAllSelected}
                                      className="pointer-events-none"
                                    />
                                    <span className="font-semibold">
                                      Select All
                                    </span>
                                    <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-bold">
                                      {allStaffIds.length}
                                    </span>
                                  </CommandItem>
                                  {(staffsData?.staffs || []).map(
                                    (staff: IStaff) => (
                                      <CommandItem
                                        key={staff._id}
                                        value={staff._id}
                                        keywords={[
                                          staff.user?.name || "",
                                          staff.staffId || "",
                                          staff.designation || "",
                                          staff.user?.email || "",
                                        ]}
                                        onSelect={() => toggleStaff(staff._id)}
                                      >
                                        <Checkbox
                                          checked={field.value.includes(
                                            staff._id,
                                          )}
                                          className="pointer-events-none"
                                        />
                                        <Avatar className="h-8 w-8 border border-muted">
                                          <AvatarImage
                                            src={staff.user?.image as string}
                                          />
                                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                                            {getInitials(
                                              staff.user?.name || "U",
                                            )}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col min-w-0">
                                          <span className="truncate font-medium leading-none mb-1">
                                            {staff.user?.name}
                                          </span>
                                          <span className="truncate text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                                            {staff.staffId} •{" "}
                                            {staff.designation}
                                          </span>
                                        </div>
                                      </CommandItem>
                                    ),
                                  )}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>

                        {field.value.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {field.value.map((id: string) => {
                              const staff = getStaffById(id);
                              return (
                                <Badge
                                  key={id}
                                  variant="secondary"
                                  className="pl-1 pr-1 py-0.5 gap-1.5 items-center bg-muted/50 border-muted hover:bg-muted"
                                >
                                  <Avatar className="h-5 w-5 border border-muted">
                                    <AvatarImage
                                      src={staff?.user?.image as string}
                                    />
                                    <AvatarFallback className="text-[10px] font-bold">
                                      {getInitials(staff?.user?.name || "U")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-[11px] font-medium truncate max-w-[120px]">
                                    {staff?.user?.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeStaff(id)}
                                    className="rounded-full p-0.5 hover:bg-destructive hover:text-white transition-all"
                                  >
                                    <IconX size={12} />
                                  </button>
                                </Badge>
                              );
                            })}
                            {field.value.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive font-bold uppercase tracking-wider"
                                onClick={() => field.onChange([])}
                              >
                                Clear All
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />

                {form.formState.errors.staffIds && (
                  <p className="text-sm text-destructive font-medium">
                    {form.formState.errors.staffIds.message}
                  </p>
                )}
              </div>

              {/* Assignment Period */}
              <div className="grid gap-3">
                <Label className="font-semibold">Assignment Period *</Label>
                <DatePicker
                  value={startDate}
                  onChange={(d) => d && form.setValue("startDate", d)}
                />
                <p className="text-[11px] text-muted-foreground font-medium">
                  The shift assignment will be effective from the selected date.
                </p>
              </div>
            </div>
          </div>

          {/* Fixed footer */}
          <div className="px-6 py-4 border-t bg-muted/10 shrink-0">
            <DialogFooter className="gap-2 sm:gap-0">
              <DialogClose asChild>
                <Button variant="ghost" className="font-semibold">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isAssigning || watchStaffIds.length === 0}
                className="font-bold min-w-[140px]"
              >
                {isAssigning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Assign to ${watchStaffIds.length} Member${watchStaffIds.length !== 1 ? "s" : ""}`
                )}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
