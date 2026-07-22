"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useGetStaffsQuery } from "@/redux/features/staff/staffApi";
import { useGetOrderByIdQuery } from "@/redux/features/order/orderApi";
import { useUpdateTaskMutation, useGetOrderTasksQuery } from "@/redux/features/task/taskApi";
import { getFeatureAssignmentInfo } from "@/components/tasks/AssignTaskModal";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { toast } from "sonner";
import { Loader2, CalendarClock, Edit3, Layers, Sparkles, CheckSquare, Square, Link2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditTaskModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: any;
}

export interface ScopeFeatureNode {
    id: string;
    name: string;
    route?: string;
    price?: string;
    isSubFeature: boolean;
    parentName?: string;
    children?: ScopeFeatureNode[];
}

const CATEGORY_NAMES: Record<string, string> = {
    'web-development': 'Web Design & Development',
    'web-design-development': 'Web Design & Development',
    'marketing': 'Marketing & Growth',
    'photo-editing': 'Photo Editing',
    'video-editing': 'Video Editing',
};

function parseNameRoutePrice(inputLine: string) {
    let text = inputLine.trim();
    let route = '';
    let price = '';

    const priceMatch = text.match(/\s*-\s*(\d+)\s*$/);
    if (priceMatch) {
        price = priceMatch[1];
        text = text.substring(0, priceMatch.index).trim();
    }

    const routeMatch = text.match(/\s*\(([^)]+)\)$/);
    if (routeMatch) {
        const potentialRoute = routeMatch[1].trim();
        if (potentialRoute.startsWith('/') || potentialRoute.startsWith('http')) {
            route = potentialRoute;
            text = text.substring(0, routeMatch.index).trim();
        }
    }

    return { name: text, route, price };
}

function parseOrderScopeFeatures(rawItems: string[]): ScopeFeatureNode[] {
    if (!rawItems || rawItems.length === 0) return [];
    const fullText = rawItems.join('\n');
    const trimmed = fullText.trim();

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
            const cleanText = trimmed.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanText);
            const items = Array.isArray(parsed) ? parsed : [parsed];

            return items.map((item: any, idx: number) => {
                const node = parseNameRoutePrice(typeof item === 'string' ? item : item.name || item.title || '');
                const childrenRaw = Array.isArray(item.children)
                    ? item.children
                    : Array.isArray(item.subFeatures)
                    ? item.subFeatures
                    : Array.isArray(item.items)
                    ? item.items
                    : [];

                const children: ScopeFeatureNode[] = childrenRaw.map((c: any, cIdx: number) => {
                    const cNode = parseNameRoutePrice(typeof c === 'string' ? c : c.name || c.title || '');
                    return {
                        id: `json_${idx}_child_${cIdx}`,
                        name: cNode.name,
                        route: c.route || cNode.route,
                        price: c.price || cNode.price,
                        isSubFeature: true,
                        parentName: node.name,
                    };
                });

                return {
                    id: `json_${idx}`,
                    name: node.name,
                    route: item.route || node.route,
                    price: item.price || node.price,
                    isSubFeature: false,
                    children: children.length > 0 ? children : undefined,
                };
            });
        } catch {}
    }

    const lines = fullText.split('\n').filter((l) => l.trim() !== '');
    const nodes: ScopeFeatureNode[] = [];
    const stack: { level: number; node: ScopeFeatureNode }[] = [];

    lines.forEach((line, index) => {
        const match = line.match(/^(\s*)/);
        const indentStr = match ? match[0] : '';
        const level = indentStr.replace(/\t/g, '    ').length;
        const parsed = parseNameRoutePrice(line);

        if (!parsed.name) return;

        const isSub = level > 0;
        const newNode: ScopeFeatureNode = {
            id: `line_${index}`,
            name: parsed.name,
            route: parsed.route,
            price: parsed.price,
            isSubFeature: isSub,
            children: [],
        };

        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
            stack.pop();
        }

        if (stack.length === 0) {
            nodes.push(newNode);
        } else {
            const parent = stack[stack.length - 1].node;
            newNode.isSubFeature = true;
            newNode.parentName = parent.name;
            if (!parent.children) parent.children = [];
            parent.children.push(newNode);
        }

        stack.push({ level, node: newNode });
    });

    return nodes;
}

function FeatureItemRow({
    node,
    selectedFeatures,
    onToggle,
    existingTasks,
    currentTaskId,
    isChild = false,
}: {
    node: ScopeFeatureNode;
    selectedFeatures: string[];
    onToggle: (node: ScopeFeatureNode, checked: boolean) => void;
    existingTasks: any[];
    currentTaskId?: string;
    isChild?: boolean;
}) {
    const isChecked = selectedFeatures.includes(node.name);
    const assignInfo = useMemo(
        () => getFeatureAssignmentInfo(node.name, existingTasks, currentTaskId),
        [node.name, existingTasks, currentTaskId]
    );

    const isAlreadyAssigned = assignInfo.isAssigned;

    return (
        <div className="space-y-1.5">
            <div
                onClick={() => {
                    if (!isAlreadyAssigned) {
                        onToggle(node, !isChecked);
                    }
                }}
                className={cn(
                    "flex items-start space-x-2.5 p-2.5 rounded-lg transition-colors border select-none",
                    isChild ? "ml-5 bg-muted/20 border-dashed" : "bg-card border-border shadow-2xs",
                    isChecked && !isAlreadyAssigned && "border-primary/60 bg-primary/5",
                    isAlreadyAssigned 
                        ? "opacity-60 bg-muted/40 cursor-not-allowed border-muted" 
                        : "cursor-pointer hover:bg-accent/40"
                )}
            >
                <Checkbox
                    id={`edit-feat-${node.id}`}
                    checked={isChecked || isAlreadyAssigned}
                    disabled={isAlreadyAssigned}
                    onCheckedChange={(checked) => {
                        if (!isAlreadyAssigned) {
                            onToggle(node, !!checked);
                        }
                    }}
                    className="mt-0.5"
                />
                <div className="flex-1 space-y-1 leading-none">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className={cn(
                            "text-xs font-semibold", 
                            isAlreadyAssigned ? "text-muted-foreground line-through" : "text-foreground",
                            isChild && "font-medium"
                        )}>
                            {node.name}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                                variant={node.isSubFeature ? "outline" : "secondary"}
                                className="text-[9px] font-extrabold uppercase px-1.5 py-0 tracking-wider"
                            >
                                {node.isSubFeature ? "Sub-Feature" : "Main Feature"}
                            </Badge>
                            {isAlreadyAssigned && (
                                <Badge 
                                    variant="outline" 
                                    className="text-[9px] font-semibold px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1"
                                >
                                    🔒 Assigned ({assignInfo.assignedStaffName})
                                </Badge>
                            )}
                        </div>
                    </div>

                    {node.route && (
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground pt-1">
                            <Link2 className="h-3 w-3 text-primary shrink-0" />
                            <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono border break-all">
                                {node.route}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {node.children && node.children.length > 0 && (
                <div className="space-y-1.5">
                    {node.children.map((child) => (
                        <FeatureItemRow
                            key={child.id}
                            node={child}
                            selectedFeatures={selectedFeatures}
                            onToggle={onToggle}
                            existingTasks={existingTasks}
                            currentTaskId={currentTaskId}
                            isChild={true}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function EditTaskModal({ 
    open, 
    onOpenChange, 
    task 
}: EditTaskModalProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
    const [priority, setPriority] = useState("medium");
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

    const orderId = typeof task?.orderId === 'object' ? task?.orderId?._id : task?.orderId;
    const { data: fetchedOrderRes } = useGetOrderByIdQuery(orderId, { skip: !orderId || !open });
    const { data: orderTasksRes } = useGetOrderTasksQuery(orderId, { skip: !orderId || !open });

    const activeOrder = fetchedOrderRes?.data || (typeof task?.orderId === 'object' ? task?.orderId : null);
    const activeOrderTasks = useMemo(() => {
        if (orderTasksRes?.data && Array.isArray(orderTasksRes.data)) return orderTasksRes.data;
        return [];
    }, [orderTasksRes]);

    const { data: staffsData, isLoading: isStaffLoading } = useGetStaffsQuery({ limit: 100 });
    const [updateTask, { isLoading: isUpdating }] = useUpdateTaskMutation();
    const staffs = staffsData?.staffs || [];

    useEffect(() => {
        if (task && open) {
            setTitle(task.title || "");

            // Extract initial description & features if embedded
            let rawDesc = task.description || "";
            let extractedFeatures: string[] = [];

            if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
                extractedFeatures = task.subtasks.map((s: any) => s.title);
                if (rawDesc.includes("Selected Features & Sub-Features:\n- ")) {
                    const parts = rawDesc.split("\n\nInstructions:\n");
                    rawDesc = parts[1] || "";
                }
            } else if (rawDesc.includes("Selected Features & Sub-Features:\n- ")) {
                const parts = rawDesc.split("\n\nInstructions:\n");
                const featPart = parts[0];
                rawDesc = parts[1] || "";
                
                const lines = featPart.replace("Selected Features & Sub-Features:\n- ", "").split("\n- ");
                extractedFeatures = lines.map((l: string) => l.trim()).filter(Boolean);
            }

            setDescription(rawDesc);
            setSelectedFeatures(extractedFeatures);

            const staffId = task.assignedTo?._id || task.assignedTo;
            setAssignedTo(staffId || "");
            setPriority(task.priority || "medium");
            
            if (task.dueDate) {
                try {
                    setDueDate(new Date(task.dueDate));
                } catch {
                    setDueDate(undefined);
                }
            }
        }
    }, [task, open]);

    // Extract available order features
    const groupedServices = useMemo(() => {
        const snapshot = activeOrder?.quotationSnapshot;
        if (!snapshot) return [];

        const groups: Array<{ categoryKey: string; categoryName: string; featureNodes: ScopeFeatureNode[] }> = [];

        if (Array.isArray(snapshot.services) && snapshot.services.length > 0) {
            snapshot.services.forEach((s: any) => {
                const name = CATEGORY_NAMES[s.category] || s.category || "Web Design & Development";
                const rawItems = Array.isArray(s.scopeItems) ? [...s.scopeItems] : [];
                if (Array.isArray(s.lineItems)) {
                    s.lineItems.forEach((li: any) => {
                        if (li.title) rawItems.push(li.title);
                    });
                }

                const featureNodes = parseOrderScopeFeatures(rawItems);
                if (featureNodes.length > 0) {
                    groups.push({
                        categoryKey: s.category || "web-development",
                        categoryName: name,
                        featureNodes,
                    });
                }
            });
        } else if (Array.isArray(snapshot.scopeOfWork)) {
            snapshot.scopeOfWork.forEach((sow: any, idx: number) => {
                const rawItems = Array.isArray(sow.items) ? sow.items : [];
                const featureNodes = parseOrderScopeFeatures(rawItems);
                if (featureNodes.length > 0) {
                    groups.push({
                        categoryKey: `scope_${idx}`,
                        categoryName: sow.title || "Web Design & Development Scope",
                        featureNodes,
                    });
                }
            });
        }

        return groups;
    }, [activeOrder]);

    const allFeatureNodes = useMemo(() => {
        const list: ScopeFeatureNode[] = [];
        const traverse = (node: ScopeFeatureNode) => {
            list.push(node);
            if (node.children) node.children.forEach(traverse);
        };
        groupedServices.forEach((g) => g.featureNodes.forEach(traverse));
        return list;
    }, [groupedServices]);

    const handleFeatureToggle = (node: ScopeFeatureNode, checked: boolean) => {
        setSelectedFeatures((prev) => {
            const toAdd = new Set<string>();
            const toRemove = new Set<string>();

            const collectNames = (n: ScopeFeatureNode) => {
                if (checked) toAdd.add(n.name);
                else toRemove.add(n.name);
                if (n.children) n.children.forEach(collectNames);
            };
            collectNames(node);

            let next = [...prev];
            if (checked) {
                toAdd.forEach((name) => {
                    if (!next.includes(name)) next.push(name);
                });
            } else {
                next = next.filter((name) => !toRemove.has(name));
            }
            return next;
        });
    };

    const handleToggleAll = () => {
        if (selectedFeatures.length === allFeatureNodes.length) {
            setSelectedFeatures([]);
        } else {
            setSelectedFeatures(allFeatureNodes.map((n) => n.name));
        }
    };

    const handleUpdate = async () => {
        if (!title.trim() || !assignedTo || !dueDate) {
            toast.error("Title, Assigned Staff, and Deadline cannot be empty.");
            return;
        }

        const formattedDescription = [
            selectedFeatures.length > 0 ? `Selected Features & Sub-Features:\n- ${selectedFeatures.join("\n- ")}` : "",
            description ? `\nInstructions:\n${description}` : "",
        ].filter(Boolean).join("\n\n");

        const subtasks = selectedFeatures.map((f) => {
            const existing = Array.isArray(task?.subtasks) ? task.subtasks.find((s: any) => s.title === f) : null;
            const matchedNode = allFeatureNodes.find((n) => n.name === f);
            return {
                title: f,
                completed: existing ? existing.completed : false,
                isSubFeature: matchedNode ? matchedNode.isSubFeature : (existing?.isSubFeature || false),
                parentName: matchedNode?.parentName || existing?.parentName,
            };
        });

        try {
            await updateTask({
                taskId: task._id,
                data: {
                    title: title.trim(),
                    description: formattedDescription,
                    subtasks,
                    assignedTo,
                    dueDate: dueDate.toISOString(),
                    priority
                },
            }).unwrap();
            toast.success("Task updated successfully!");
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err?.data?.message || "Failed to update task.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[620px] h-[85vh] max-h-[720px] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-5 pb-3 border-b shrink-0 bg-transparent">
                    <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                        <Edit3 className="h-5 w-5 text-primary" />
                        Edit Task & Staff Assignment
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Adjust task details, deadline, priority, features, or reassign to another staff member.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Order Reference Banner */}
                    {activeOrder && (
                        <div className="p-3 bg-muted/30 border rounded-lg flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                <span className="font-semibold text-foreground">
                                    {activeOrder.quotationSnapshot?.clientName || activeOrder.quotationSnapshot?.templateName || "Active Order"}
                                </span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground bg-background border px-2 py-0.5 rounded">
                                #{activeOrder.orderNumber || "N/A"}
                            </span>
                        </div>
                    )}

                    {/* Features Checkbox Section if order features available */}
                    {groupedServices.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                    Scope Features & Sub-Features
                                </Label>
                                {allFeatureNodes.length > 0 && (
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={handleToggleAll}
                                        className="h-6 text-[11px] font-medium px-2 text-primary"
                                    >
                                        {selectedFeatures.length === allFeatureNodes.length ? (
                                            <span className="flex items-center gap-1"><Square className="h-3 w-3" /> Deselect All</span>
                                        ) : (
                                            <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" /> Select All ({allFeatureNodes.length})</span>
                                        )}
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {groupedServices.map((group) => (
                                    <Card key={group.categoryKey} className="border shadow-2xs">
                                        <div className="px-3 py-2 border-b flex items-center justify-between bg-transparent">
                                            <span className="font-semibold text-xs flex items-center gap-1.5">
                                                <Layers className="h-3.5 w-3.5 text-primary" />
                                                {group.categoryName}
                                            </span>
                                            <Badge variant="outline" className="text-[10px] font-semibold px-1.5 py-0">
                                                {allFeatureNodes.filter(f => selectedFeatures.includes(f.name)).length} / {allFeatureNodes.length} Selected
                                            </Badge>
                                        </div>
                                        <CardContent className="p-2 space-y-2">
                                            {group.featureNodes.map((node) => (
                                                <FeatureItemRow
                                                    key={node.id}
                                                    node={node}
                                                    selectedFeatures={selectedFeatures}
                                                    onToggle={handleFeatureToggle}
                                                    existingTasks={activeOrderTasks}
                                                    currentTaskId={task?._id}
                                                />
                                            ))}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Task Title */}
                    <div className="space-y-1.5">
                        <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                            Task Title / Deliverable Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            placeholder="e.g. Interface Mockup Implementation"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="h-9 text-xs font-medium"
                        />
                    </div>

                    {/* Assigned Staff + Priority */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                                Assigned Staff <span className="text-destructive">*</span>
                            </Label>
                            <Select value={assignedTo} onValueChange={setAssignedTo} disabled={isStaffLoading}>
                                <SelectTrigger className="w-full h-9 text-xs font-medium">
                                    <SelectValue placeholder={isStaffLoading ? "Loading staff..." : "Select staff..."} />
                                </SelectTrigger>
                                <SelectContent className="max-h-56 text-xs">
                                    {staffs.map((staff: any) => (
                                        <SelectItem key={staff._id} value={staff._id}>
                                            <div className="flex flex-col text-left">
                                                <span className="font-semibold">{staff.user?.name || staff.name || "Unknown"}</span>
                                                <span className="text-[10px] text-muted-foreground capitalize">{staff.designation || "Developer"}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                                Priority Level
                            </Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger className="w-full h-9 text-xs font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="text-xs">
                                    <SelectItem value="low">Low Priority</SelectItem>
                                    <SelectItem value="medium">Medium Priority</SelectItem>
                                    <SelectItem value="high">High Priority</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Deadline */}
                    <div className="space-y-1.5">
                        <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5 text-primary" />
                            Target Delivery Deadline <span className="text-destructive">*</span>
                        </Label>
                        <DateTimePicker
                            value={dueDate}
                            onChange={setDueDate}
                            placeholder="Select delivery date and time..."
                        />
                    </div>

                    {/* Instructions */}
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-desc" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                            Additional Instructions
                        </Label>
                        <Textarea
                            id="edit-desc"
                            placeholder="Provide guidelines or acceptance criteria..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[70px] resize-none text-xs leading-relaxed"
                        />
                    </div>
                </div>

                <DialogFooter className="p-4 border-t shrink-0 flex items-center justify-end gap-2 bg-transparent">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isUpdating} className="font-semibold">
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleUpdate} disabled={isUpdating} className="font-semibold">
                        {isUpdating ? (
                            <>
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                Saving Changes...
                            </>
                        ) : (
                            "Save Changes"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
