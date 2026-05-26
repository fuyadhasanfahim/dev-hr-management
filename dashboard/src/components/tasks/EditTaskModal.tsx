"use client";

import { useState, useEffect } from "react";
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
import { useUpdateTaskMutation } from "@/redux/features/task/taskApi";
import { toast } from "sonner";
import { Loader2, CalendarClock, Edit3 } from "lucide-react";

interface EditTaskModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: any;
}

export function EditTaskModal({ 
    open, 
    onOpenChange, 
    task 
}: EditTaskModalProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [priority, setPriority] = useState("");

    const { data: staffsData, isLoading: isStaffLoading } = useGetStaffsQuery({ limit: 100 });
    const [updateTask, { isLoading: isUpdating }] = useUpdateTaskMutation();

    const staffs = staffsData?.staffs || [];

    useEffect(() => {
        if (task && open) {
            setTitle(task.title || "");
            setDescription(task.description || "");
            setAssignedTo(task.assignedTo?._id || task.assignedTo || "");
            setPriority(task.priority || "medium");
            
            if (task.dueDate) {
                try {
                    const d = new Date(task.dueDate);
                    const offset = d.getTimezoneOffset() * 60000;
                    setDueDate(new Date(d.getTime() - offset).toISOString().slice(0, 16));
                } catch {
                    setDueDate("");
                }
            }
        }
    }, [task, open]);

    const handleUpdate = async () => {
        if (!title.trim() || !assignedTo || !dueDate) {
            toast.error("Title, Assigned Staff, and Deadline cannot be empty.");
            return;
        }
        try {
            await updateTask({
                taskId: task._id,
                data: {
                    title,
                    description,
                    assignedTo,
                    dueDate: new Date(dueDate).toISOString(),
                    priority
                },
            }).unwrap();
            toast.success("Milestone updated successfully!");
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err?.data?.message || "Failed to update milestone.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500" />
                <DialogHeader className="pt-2">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-md">
                            <Edit3 className="h-5 w-5" />
                        </div>
                        Edit Milestone
                    </DialogTitle>
                    <DialogDescription>
                        Adjust deadline, priority, assignment, or task scope.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 py-3">
                    {/* Phase / Title */}
                    <div className="space-y-2">
                        <Label className="font-bold text-foreground">
                            Task Title <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            placeholder="e.g. Interface Mockup Implementation"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="font-medium h-11"
                        />
                    </div>

                    {/* Staff + Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="font-bold text-foreground">
                                Assigned Staff <span className="text-destructive">*</span>
                            </Label>
                            <Select value={assignedTo} onValueChange={setAssignedTo} disabled={isStaffLoading}>
                                <SelectTrigger className="w-full h-11 font-medium">
                                    <SelectValue placeholder={isStaffLoading ? "Loading..." : "Select staff"} />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {staffs.map((staff: any) => (
                                        <SelectItem key={staff._id} value={staff._id}>
                                            <div className="flex flex-col text-left">
                                                <span className="font-bold">{staff.user?.name || staff.name || "Unknown"}</span>
                                                <span className="text-[10px] opacity-80 capitalize">{staff.designation || "Staff"}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-bold text-foreground">Priority</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger className="w-full h-11 font-medium">
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
                        <Label htmlFor="edit-due" className="font-bold flex items-center gap-1.5 text-foreground">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            New Deadline <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="edit-due"
                            type="datetime-local"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="font-mono text-sm h-11"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="edit-desc" className="font-bold text-foreground">Detailed Instructions</Label>
                        <Textarea
                            id="edit-desc"
                            placeholder="Add descriptive notes..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[100px] resize-none font-medium leading-relaxed text-sm"
                        />
                    </div>
                </div>

                <DialogFooter className="bg-slate-50 dark:bg-muted/30 -mx-6 -mb-6 px-6 py-4 mt-2 border-t border-muted/50 flex gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isUpdating} className="font-bold">
                        Cancel
                    </Button>
                    <Button onClick={handleUpdate} disabled={isUpdating} className="font-bold bg-indigo-600 hover:bg-indigo-700 shadow-sm px-6">
                        {isUpdating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving Changes...
                            </>
                        ) : (
                            "Save Milestone"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
