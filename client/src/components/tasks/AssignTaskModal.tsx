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
import { Loader2, CalendarClock, UserPlus } from "lucide-react";

interface AssignTaskModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    assignedTeamIds?: string[]; // To optionally prioritize existing team members in dropdown
}

export function AssignTaskModal({ open, onOpenChange, orderId }: AssignTaskModalProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [priority, setPriority] = useState("medium");

    const { data: staffsData, isLoading: isStaffLoading } = useGetStaffsQuery({ limit: 100 });
    const [createTask, { isLoading: isCreating }] = useCreateTaskMutation();

    const handleAssign = async () => {
        if (!title || !assignedTo || !dueDate) {
            toast.error("Please complete all required fields (Title, Assigned Staff, and Due Date)");
            return;
        }

        try {
            await createTask({
                orderId,
                title,
                description,
                assignedTo,
                dueDate: new Date(dueDate).toISOString(),
                priority,
                status: "pending",
            }).unwrap();

            toast.success("Task successfully created and assigned!");
            // Reset and close
            setTitle("");
            setDescription("");
            setAssignedTo("");
            setDueDate("");
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err?.data?.message || "Failed to assign task. Please try again.");
        }
    };

    const staffs = staffsData?.data?.data || staffsData?.data || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Assign Order Task
                    </DialogTitle>
                    <DialogDescription>
                        Decompose the order phase and assign a specialized task to a developer.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title" className="font-semibold">Task / Phase Title <span className="text-destructive">*</span></Label>
                        <Input
                            id="title"
                            placeholder="e.g., Frontend Redesign, API Schema Integration"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="font-medium"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="font-semibold">Assign To Staff <span className="text-destructive">*</span></Label>
                            <Select value={assignedTo} onValueChange={setAssignedTo} disabled={isStaffLoading}>
                                <SelectTrigger className="bg-card font-medium">
                                    <SelectValue placeholder={isStaffLoading ? "Loading..." : "Select developer"} />
                                </SelectTrigger>
                                <SelectContent className="max-h-[250px]">
                                    {staffs.map((staff: any) => (
                                        <SelectItem key={staff._id} value={staff._id} className="py-2">
                                            <div className="flex flex-col">
                                                <span className="font-bold leading-none">{staff.name}</span>
                                                <span className="text-[10px] text-muted-foreground mt-1 capitalize">{staff.designation || "Staff"}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-semibold">Priority</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger className="bg-card font-medium">
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

                    <div className="space-y-2">
                        <Label htmlFor="due" className="font-semibold flex items-center gap-1">
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

                    <div className="space-y-2">
                        <Label htmlFor="desc" className="font-semibold">Instructions / Overview (Optional)</Label>
                        <Textarea
                            id="desc"
                            placeholder="Describe the expected deliverables..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[100px] resize-none leading-relaxed"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAssign}
                        disabled={isCreating}
                        className="font-bold"
                    >
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
