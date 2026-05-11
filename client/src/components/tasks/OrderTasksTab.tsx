"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { 
    useGetOrderTasksQuery, 
    useDeleteTaskMutation,
    useReviewTaskMutation
} from "@/redux/features/task/taskApi";
import { useUpdateOrderTeamMutation } from "@/redux/features/order/orderApi";
import { useGetStaffsQuery } from "@/redux/features/staff/staffApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { AssignTaskModal } from "./AssignTaskModal";
import { 
    ClipboardList, 
    UserCog, 
    PlusCircle, 
    MoreHorizontal, 
    Trash2, 
    CheckCircle2, 
    XCircle, 
    ExternalLink,
    Calendar,
    ShieldAlert
} from "lucide-react";

interface OrderTasksTabProps {
    order: any;
    canManage: boolean; // Higher tier roles: Admin, SuperAdmin, HR, TL
}

export function OrderTasksTab({ order, canManage }: OrderTasksTabProps) {
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const { data: tasksRes, isLoading: isTasksLoading } = useGetOrderTasksQuery(order._id);
    const [deleteTask] = useDeleteTaskMutation();
    const [reviewTask] = useReviewTaskMutation();
    const [updateTeam, { isLoading: isUpdatingTeam }] = useUpdateOrderTeamMutation();
    const { data: staffsRes } = useGetStaffsQuery({ limit: 100 });

    const tasks = tasksRes?.data || [];
    const staffs = staffsRes?.data?.data || staffsRes?.data || [];

    // Setup handling for Team Leader nomination
    const handleSetTeamLeader = async (leaderId: string) => {
        try {
            await updateTeam({
                id: order._id,
                data: { teamLeader: leaderId || undefined }
            }).unwrap();
            toast.success("Team Leader updated successfully.");
        } catch (err: any) {
            toast.error("Failed to update Team Leader.");
        }
    };

    const handleReview = async (taskId: string, decision: "approve" | "reject") => {
        try {
            await reviewTask({
                taskId,
                data: { decision, note: `Task ${decision}d by management.` }
            }).unwrap();
            toast.success(`Task successfully ${decision}d.`);
        } catch (err) {
            toast.error("Failed to record review decision.");
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!confirm("Are you sure you want to remove this task assignment?")) return;
        try {
            await deleteTask(taskId).unwrap();
            toast.success("Task assignment deleted.");
        } catch (err) {
            toast.error("Failed to delete task.");
        }
    };

    const getStatusVariant = (status: string) => {
        switch (status) {
            case "completed": return "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-200";
            case "under_review": return "bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 border-amber-200";
            case "in_progress": return "bg-blue-500/15 text-blue-600 hover:bg-blue-500/20 border-blue-200";
            case "rejected": return "bg-red-500/15 text-red-600 hover:bg-red-500/20 border-red-200";
            default: return "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200";
        }
    };

    // Calculate progress summary
    const completedTasks = tasks.filter((t: any) => t.status === "completed").length;
    const totalTasks = tasks.length;
    const completionPct = totalTasks > 0 ? Math.floor((completedTasks / totalTasks) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* Management Header Control Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="shadow-sm border-muted/60">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <UserCog className="h-4 w-4" /> Order Lead
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        {canManage ? (
                            <Select 
                                disabled={isUpdatingTeam} 
                                value={order.teamLeader?._id || order.teamLeader || ""} 
                                onValueChange={handleSetTeamLeader}
                            >
                                <SelectTrigger className="h-10 mt-1 font-bold border-dashed bg-primary/5 border-primary/20 text-primary">
                                    <SelectValue placeholder="Nominate Leader" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none" className="text-muted-foreground italic">No explicit leader</SelectItem>
                                    {staffs.map((s: any) => (
                                        <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <div className="flex items-center gap-2 mt-2 font-bold">
                                <ShieldAlert className="h-4 w-4 text-primary" />
                                {order.teamLeader ? staffs.find((s: any) => s._id === (order.teamLeader?._id || order.teamLeader))?.name || "Assigned Supervisor" : "Not Assigned"}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="md:col-span-2 shadow-sm border-muted/60 bg-gradient-to-r from-indigo-50 to-transparent dark:from-indigo-950/20">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-base font-bold">Task Breakdown Status</CardTitle>
                            <CardDescription className="text-xs">Visual tracking of developer milestones</CardDescription>
                        </div>
                        <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{completionPct}%</div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                        <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden relative">
                            <div 
                                className="absolute h-full bg-indigo-500 transition-all duration-700 ease-out shadow-sm" 
                                style={{ width: `${completionPct}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] mt-1.5 text-muted-foreground font-medium">
                            <span>{completedTasks} Tasks Completed</span>
                            <span>{totalTasks} Assigned in Total</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Task Manifest */}
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-foreground/70" />
                            Execution Pipeline
                        </CardTitle>
                    </div>
                    {canManage && (
                        <Button onClick={() => setIsAssignModalOpen(true)} size="sm" className="font-bold shadow-sm gap-1.5">
                            <PlusCircle className="h-4 w-4" />
                            Assign New Task
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    {isTasksLoading ? (
                        <div className="p-6 space-y-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center gap-3">
                            <div className="p-4 bg-muted rounded-full">
                                <ClipboardList className="h-8 w-8 text-muted-foreground opacity-50" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-lg">No tasks created yet</h3>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">Order scope hasn't been broken down into discrete dev tasks yet.</p>
                            </div>
                            {canManage && (
                                <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(true)} className="mt-2">
                                    Get Started
                                </Button>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="font-bold pl-6">Developer / Staff</TableHead>
                                    <TableHead className="font-bold">Assigned Mission</TableHead>
                                    <TableHead className="font-bold">Target Delivery</TableHead>
                                    <TableHead className="font-bold">Status</TableHead>
                                    {canManage && <TableHead className="text-right pr-6">Action</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tasks.map((task: any) => (
                                    <TableRow key={task._id} className="hover:bg-muted/20 transition-colors">
                                        <TableCell className="pl-6">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9 border">
                                                    <AvatarImage src={task.assignedTo?.avatar} />
                                                    <AvatarFallback className="text-xs bg-primary/5">{task.assignedTo?.name?.charAt(0) || "?"}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm leading-tight">{task.assignedTo?.name || "Unknown User"}</span>
                                                    <span className="text-[10px] text-muted-foreground capitalize">{task.assignedTo?.designation || "Staff"}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">{task.title}</span>
                                                {task.description && (
                                                    <span className="text-xs text-muted-foreground line-clamp-1">{task.description}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-xs font-medium">
                                                <Calendar className="h-3.5 w-3.5 opacity-60" />
                                                {format(new Date(task.dueDate), "MMM d, yyyy")}
                                                <span className="text-[10px] text-muted-foreground italic">
                                                    ({formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })})
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`capitalize text-[10px] font-bold tracking-wide py-0.5 ${getStatusVariant(task.status)}`}>
                                                {task.status.replace("_", " ")}
                                            </Badge>
                                        </TableCell>
                                        {canManage && (
                                            <TableCell className="text-right pr-6">
                                                <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
                                                                {task.status === "under_review" && (
                                                                    <>
                                                                        <DropdownMenuItem 
                                                                            onClick={() => handleReview(task._id, "approve")}
                                                                            className="text-emerald-600 font-bold cursor-pointer"
                                                                        >
                                                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                                                            Approve Work
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem 
                                                                            onClick={() => handleReview(task._id, "reject")}
                                                                            className="text-amber-600 font-bold cursor-pointer"
                                                                        >
                                                                            <XCircle className="h-4 w-4 mr-2" />
                                                                            Request Revision
                                                                        </DropdownMenuItem>
                                                                        <div className="h-px bg-muted my-1" />
                                                                    </>
                                                                )}
                                                                {task.submissionAttachment && (
                                                                    <DropdownMenuItem asChild>
                                                                        <a href={task.submissionAttachment} target="_blank" rel="noreferrer" className="flex items-center cursor-pointer">
                                                                            <ExternalLink className="h-4 w-4 mr-2" />
                                                                            View Deliverable
                                                                        </a>
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuItem 
                                                                    onClick={() => handleDelete(task._id)}
                                                                    className="text-destructive focus:text-destructive cursor-pointer"
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                                    Delete Task
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <AssignTaskModal 
                open={isAssignModalOpen}
                onOpenChange={setIsAssignModalOpen}
                orderId={order._id}
            />
        </div>
    );
}
