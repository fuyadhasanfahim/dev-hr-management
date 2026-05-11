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
    phases?: Array<{ title: string; description?: string; items?: string[]; startDate?: string; endDate?: string }>;
}

export function AssignTaskModal({ open, onOpenChange, orderId, phases = [] }: AssignTaskModalProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [priority, setPriority] = useState("medium");
    const [customTitle, setCustomTitle] = useState("");

    // Reactively update deadline and description when title (Phase) changes
    const handlePhaseChange = (selectedTitle: string) => {
        setTitle(selectedTitle);
        
        const matchedPhase = phases.find(p => p.title === selectedTitle);
        if (matchedPhase) {
            if (matchedPhase.description) setDescription(matchedPhase.description);
            
            // Auto populate deadline if endDate exists
            if (matchedPhase.endDate) {
                try {
                    const d = new Date(matchedPhase.endDate);
                    // Format as local string for datetime-local input: "YYYY-MM-DDThh:mm"
                    const offset = d.getTimezoneOffset() * 60000;
                    const localISOTime = (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
                    setDueDate(localISOTime);
                } catch (e) {
                    // suppress silently if date format was weird
                }
            }
        }
    };

    const { data: staffsData, isLoading: isStaffLoading } = useGetStaffsQuery({ limit: 100 });
    const [createTask, { isLoading: isCreating }] = useCreateTaskMutation();

    const handleAssign = async () => {
        const finalTitle = title === "_CUSTOM_" ? customTitle : title;

        if (!finalTitle || !assignedTo || !dueDate) {
            toast.error("Please complete all required fields (Title, Assigned Staff, and Due Date)");
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
                        {phases && phases.length > 0 ? (
                            <Select value={title} onValueChange={handlePhaseChange}>
                                <SelectTrigger className="font-medium bg-card">
                                    <SelectValue placeholder="Select order phase..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {phases.map((p, idx) => (
                                        <SelectItem key={idx} value={p.title}>
                                            {p.title}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="_CUSTOM_" className="italic text-muted-foreground text-xs border-t mt-1">
                                        + Add custom task not in scope
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                id="title"
                                placeholder="e.g., Frontend Redesign"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="font-medium"
                            />
                        )}
                        
                        {/* Show manual input if Custom was selected or no phases existed */}
                        {phases && phases.length > 0 && title === "_CUSTOM_" && (
                            <Input
                                placeholder="Type custom phase title..."
                                className="mt-2 font-medium animate-in slide-in-from-top-2 duration-200"
                                value={customTitle}
                                onChange={(e) => setCustomTitle(e.target.value)}
                            />
                        )}
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
