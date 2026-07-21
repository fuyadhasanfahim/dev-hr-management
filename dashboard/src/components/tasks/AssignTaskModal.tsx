"use client";

import { useState, useMemo, useEffect } from "react";
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
import { useGetOrdersQuery, useGetOrderByIdQuery } from "@/redux/features/order/orderApi";
import { useCreateTaskMutation } from "@/redux/features/task/taskApi";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { toast } from "sonner";
import { Loader2, CalendarClock, UserPlus, Layers, Sparkles, CheckSquare, Square, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssignTaskModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId?: string;
    order?: any;
    phases?: any;
    existingTasks?: any[];
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

    // Extract trailing price e.g. "- 5000" or "- 20000"
    const priceMatch = text.match(/\s*-\s*(\d+)\s*$/);
    if (priceMatch) {
        price = priceMatch[1];
        text = text.substring(0, priceMatch.index).trim();
    }

    // Extract route from parentheses e.g. "( /services/... )" or "( http... )"
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

    // Check JSON format
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

    // Line by line indentation parsing
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
    isChild = false,
}: {
    node: ScopeFeatureNode;
    selectedFeatures: string[];
    onToggle: (node: ScopeFeatureNode, checked: boolean) => void;
    existingTasks: any[];
    isChild?: boolean;
}) {
    const isChecked = selectedFeatures.includes(node.name);
    const isTaskAssigned = existingTasks.some((t: any) => t.title?.includes(node.name));

    return (
        <div className="space-y-1.5">
            <div
                onClick={() => onToggle(node, !isChecked)}
                className={cn(
                    "flex items-start space-x-2.5 p-2.5 rounded-lg transition-colors cursor-pointer border hover:bg-accent/40",
                    isChild ? "ml-5 bg-muted/20 border-dashed" : "bg-card border-border shadow-2xs",
                    isChecked && "border-primary/60 bg-primary/5"
                )}
            >
                <Checkbox
                    id={`feat-${node.id}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => onToggle(node, !!checked)}
                    className="mt-0.5"
                />
                <div className="flex-1 space-y-1 leading-none">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className={cn("text-xs font-semibold text-foreground", isChild && "font-medium")}>
                            {node.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <Badge
                                variant={node.isSubFeature ? "outline" : "secondary"}
                                className="text-[9px] font-extrabold uppercase px-1.5 py-0 tracking-wider"
                            >
                                {node.isSubFeature ? "Sub-Feature" : "Main Feature"}
                            </Badge>
                            {isTaskAssigned && (
                                <Badge variant="outline" className="text-[9px] text-muted-foreground px-1.5 py-0">
                                    Assigned
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Route display if available */}
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

            {/* Render children sub-features */}
            {node.children && node.children.length > 0 && (
                <div className="space-y-1.5">
                    {node.children.map((child) => (
                        <FeatureItemRow
                            key={child.id}
                            node={child}
                            selectedFeatures={selectedFeatures}
                            onToggle={onToggle}
                            existingTasks={existingTasks}
                            isChild={true}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function AssignTaskModal({ 
    open, 
    onOpenChange, 
    orderId: initialOrderId,
    order: initialOrder,
    existingTasks = [] 
}: AssignTaskModalProps) {
    const [selectedOrderId, setSelectedOrderId] = useState<string>(initialOrderId || "");
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
    const [taskTitle, setTaskTitle] = useState("");
    const [customTitle, setCustomTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
    const [priority, setPriority] = useState("medium");

    // Fetch orders if no order pre-selected
    const { data: ordersRes, isLoading: isOrdersLoading } = useGetOrdersQuery({ limit: 1000 });

    const ordersList = useMemo(() => {
        if (!ordersRes) return [];
        if (Array.isArray(ordersRes.data)) return ordersRes.data;
        if ((ordersRes as any)?.data?.data && Array.isArray((ordersRes as any).data.data)) {
            return (ordersRes as any).data.data;
        }
        return [];
    }, [ordersRes]);

    // Fetch order by ID if selected from dropdown and no initial order passed
    const { data: fetchedOrderRes } = useGetOrderByIdQuery(selectedOrderId, {
        skip: !selectedOrderId || !!initialOrder,
    });

    const activeOrder = useMemo(() => {
        if (initialOrder) return initialOrder;
        if (fetchedOrderRes?.data) return fetchedOrderRes.data;
        return ordersList.find((o: any) => o._id === selectedOrderId);
    }, [initialOrder, fetchedOrderRes, ordersList, selectedOrderId]);

    useEffect(() => {
        if (initialOrderId) {
            setSelectedOrderId(initialOrderId);
        } else if (ordersList.length > 0 && (!selectedOrderId || !ordersList.some((o: any) => o._id === selectedOrderId))) {
            setSelectedOrderId(ordersList[0]._id);
        }
    }, [initialOrderId, ordersList, selectedOrderId]);

    const { data: staffsData, isLoading: isStaffLoading } = useGetStaffsQuery({ limit: 100 });
    const [createTask, { isLoading: isCreating }] = useCreateTaskMutation();

    const staffs = staffsData?.staffs || [];

    // Extract available Web Design & Development features grouped by category with hierarchical nodes
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

    // Flatten all feature & sub-feature names for quick search / toggle all
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

            if (next.length === 1) {
                setTaskTitle(next[0]);
            } else if (next.length > 1) {
                setTaskTitle(`${next.length} Features: ${next.slice(0, 2).join(", ")}...`);
            } else {
                setTaskTitle("");
            }
            return next;
        });
    };

    const handleToggleAll = () => {
        if (selectedFeatures.length === allFeatureNodes.length) {
            setSelectedFeatures([]);
            setTaskTitle("");
        } else {
            setSelectedFeatures(allFeatureNodes.map((n) => n.name));
            setTaskTitle(`All ${allFeatureNodes.length} Features & Sub-Features`);
        }
    };

    const handleAssign = async () => {
        const finalTitle = (taskTitle || customTitle || selectedFeatures.join(", ")).trim();
        const targetOrderId = selectedOrderId || initialOrderId || activeOrder?._id;

        if (!targetOrderId) {
            toast.error("Please select an Order.");
            return;
        }
        if (!finalTitle && selectedFeatures.length === 0) {
            toast.error("Please select at least one feature or enter a task title.");
            return;
        }
        if (!assignedTo) {
            toast.error("Please select a Developer / Staff member to assign.");
            return;
        }
        if (!dueDate) {
            toast.error("Please specify a target delivery deadline.");
            return;
        }

        const formattedDescription = [
            selectedFeatures.length > 0 ? `Selected Features & Sub-Features:\n- ${selectedFeatures.join("\n- ")}` : "",
            description ? `\nInstructions:\n${description}` : "",
        ].filter(Boolean).join("\n\n");

        try {
            await createTask({
                orderId: targetOrderId,
                title: finalTitle,
                description: formattedDescription,
                assignedTo,
                dueDate: dueDate.toISOString(),
                priority,
                status: "pending",
            }).unwrap();

            toast.success("Task successfully assigned to staff!");
            setSelectedFeatures([]);
            setTaskTitle("");
            setCustomTitle("");
            setDescription("");
            setAssignedTo("");
            setDueDate(undefined);
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err?.data?.message || "Failed to assign task.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[620px] h-[85vh] max-h-[720px] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-5 pb-3 border-b shrink-0 bg-transparent">
                    <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Assign Task & Deliverables
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Select an order, check features or sub-features with routes, and assign to a developer.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Order Selection */}
                    {!initialOrderId && (
                        <div className="space-y-1.5">
                            <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                                Target Order <span className="text-destructive">*</span>
                            </Label>
                            <Select value={selectedOrderId} onValueChange={(val) => { setSelectedOrderId(val); setSelectedFeatures([]); }}>
                                <SelectTrigger className="w-full h-9 text-xs font-medium">
                                    <SelectValue placeholder={isOrdersLoading ? "Loading orders..." : "Select active order..."} />
                                </SelectTrigger>
                                <SelectContent className="max-h-56">
                                    {ordersList.map((o: any) => (
                                        <SelectItem key={o._id} value={o._id}>
                                            <div className="flex items-center justify-between w-full gap-4 text-xs">
                                                <span className="font-semibold">{o.quotationSnapshot?.templateName || o.orderNumber}</span>
                                                <span className="text-[11px] text-muted-foreground font-mono">#{o.orderNumber}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Features & Sub-Features Checkbox Section */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                Features & Sub-Features (With Routes)
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

                        {groupedServices.length > 0 ? (
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
                                                    existingTasks={existingTasks}
                                                />
                                            ))}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="p-3 border border-dashed rounded-lg text-center text-xs text-muted-foreground">
                                No features found for this order scope. Enter custom task details below.
                            </div>
                        )}
                    </div>

                    {/* Task Title */}
                    <div className="space-y-1.5">
                        <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                            Task Title / Deliverable Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            placeholder="e.g. Frontend Authentication & Dashboard"
                            value={taskTitle}
                            onChange={(e) => setTaskTitle(e.target.value)}
                            className="h-9 text-xs font-medium"
                        />
                    </div>

                    {/* Developer Staff + Priority */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                                Assign Staff <span className="text-destructive">*</span>
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

                    {/* Submission Deadline */}
                    <div className="space-y-1.5">
                        <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5 text-primary" />
                            Delivery Deadline <span className="text-destructive">*</span>
                        </Label>
                        <DateTimePicker
                            value={dueDate}
                            onChange={setDueDate}
                            placeholder="Select delivery date and time..."
                        />
                    </div>

                    {/* Additional Directives */}
                    <div className="space-y-1.5">
                        <Label htmlFor="desc" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                            Additional Instructions
                        </Label>
                        <Textarea
                            id="desc"
                            placeholder="Provide guidelines or acceptance criteria..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[70px] resize-none text-xs leading-relaxed"
                        />
                    </div>
                </div>

                <DialogFooter className="p-4 border-t shrink-0 flex items-center justify-end gap-2 bg-transparent">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isCreating} className="font-semibold">
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleAssign} disabled={isCreating} className="font-semibold">
                        {isCreating ? (
                            <>
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                Assigning...
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
