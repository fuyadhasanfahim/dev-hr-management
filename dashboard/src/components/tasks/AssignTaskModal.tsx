"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useGetStaffsQuery } from "@/redux/features/staff/staffApi";
import { useCreateTaskMutation } from "@/redux/features/task/taskApi";
import { toast } from "sonner";
import { Loader2, CalendarClock, UserPlus, CheckCircle2, Clock } from "lucide-react";

interface AssignTaskModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    phases?: Array<{ title: string; description?: string; items?: string[]; startDate?: string; endDate?: string }>;
    existingTasks?: any[];
}

export function AssignTaskModal({ 
    open, 
    onOpenChange, 
    orderId, 
    phases = [],
    existingTasks = [] 
}: AssignTaskModalProps) {
    const [title, setTitle] = useState("");
    const [customTitle, setCustomTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [priority, setPriority] = useState("medium");

    const { data: staffsData, isLoading: isStaffLoading } = useGetStaffsQuery({ limit: 100 });
    const [createTask, { isLoading: isCreating }] = useCreateTaskMutation();

    const staffs = staffsData?.staffs || [];

    const handlePhaseChange = (selectedTitle: string) => {
        setTitle(selectedTitle);
        if (selectedTitle === "_CUSTOM_") {
            setCustomTitle("");
            return;
        }
        const matched = phases.find((p) => p.title === selectedTitle);
        if (matched) {
            if (matched.description) setDescription(matched.description);
            if (matched.endDate) {
                try {
                    const d = new Date(matched.endDate);
                    const offset = d.getTimezoneOffset() * 60000;
                    setDueDate(new Date(d.getTime() - offset).toISOString().slice(0, 16));
                } catch {
                    // ignore invalid date
                }
            }
        }
    };

    const handleAssign = async () => {
        const finalTitle = title === "_CUSTOM_" ? customTitle.trim() : title.trim();
        if (!finalTitle || !assignedTo || !dueDate) {
            toast.error("Please fill in Task/Phase, Assigned Staff, and Deadline.");
            return;
        }
        try {
            await createTask({
                orderId,
                title: finalTitle,
                description,
                assignedTo,
                dueDate: new Date(dueDate).toISOString(),
                priority,
                status: "pending",
            }).unwrap();
            toast.success("Task assigned successfully!");
            setTitle(""); setCustomTitle(""); setDescription("");
            setAssignedTo(""); setDueDate("");
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err?.data?.message || "Failed to assign task.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Assign Order Task
                    </DialogTitle>
                    <DialogDescription>
                        Select a phase from the order scope and assign it to a developer.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 py-4">
                    {/* Phase / Title */}
                    <div className="space-y-2">
                        <Label className="font-semibold">
                            Task / Phase Title <span className="text-destructive">*</span>
                        </Label>
                        {phases.length > 0 ? (
                            <>
                                <Select value={title} onValueChange={handlePhaseChange}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select order phase..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {phases.map((p, idx) => {
                                            const matchingTask = existingTasks.find((t: any) => t.title === p.title);
                                            const isCompleted = matchingTask?.status === "completed";
                                            const isAssigned = !!matchingTask;
                                            
                                            return (
                                                <SelectItem key={idx} value={p.title}>
                                                    <div className="flex items-center justify-between w-full gap-3 pr-2">
                                                        <span className={isCompleted ? "text-muted-foreground line-through" : ""}>
                                                            {p.title}
                                                        </span>
                                                        {isCompleted ? (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                Done
                                                            </span>
                                                        ) : isAssigned ? (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900">
                                                                <Clock className="h-3 w-3" />
                                                                Active
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                        <SelectItem value="_CUSTOM_" className="italic text-muted-foreground text-xs">
                                            + Custom task (not in scope)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {title === "_CUSTOM_" && (
                                    <Input
                                        placeholder="Enter custom task title..."
                                        value={customTitle}
                                        onChange={(e) => setCustomTitle(e.target.value)}
                                        className="mt-2"
                                    />
                                )}
                            </>
                        ) : (
                            <Input
                                placeholder="e.g., Frontend Redesign"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        )}
                    </div>

                    {/* Staff + Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="font-semibold">
                                Assign To Staff <span className="text-destructive">*</span>
                            </Label>
                            <Select value={assignedTo} onValueChange={setAssignedTo} disabled={isStaffLoading}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={isStaffLoading ? "Loading..." : "Select staff"} />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {staffs.map((staff: any) => (
                                        <SelectItem key={staff._id} value={staff._id}>
                                            <div className="flex flex-col">
                                                <span className="font-semibold">{staff.user?.name || staff.name || "Unknown"}</span>
                                                <span className="text-xs text-muted-foreground capitalize">{staff.designation || "Staff"}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-semibold">Priority</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">🟢 Low</SelectItem>
                                    <SelectItem value="medium">🟡 Medium</SelectItem>
                                    <SelectItem value="high">🟠 High</SelectItem>
                                    <SelectItem value="urgent">🔴 Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Deadline */}
                    <div className="space-y-2">
                        <Label htmlFor="due" className="font-semibold flex items-center gap-1.5">
                            <CalendarClock className="h-4 w-4 opacity-70" />
                            Submission Deadline <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="due"
                            type="datetime-local"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="font-mono text-sm"
                        />
                    </div>

                    {/* Instructions */}
                    <div className="space-y-2">
                        <Label htmlFor="desc" className="font-semibold">Instructions / Overview (Optional)</Label>
                        <Textarea
                            id="desc"
                            placeholder="Describe the expected deliverables..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[90px] resize-none"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
                        Cancel
                    </Button>
                    <Button onClick={handleAssign} disabled={isCreating} className="font-bold">
                        {isCreating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            "Confirm Assignment"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
