'use client';

import React, { useState, createContext, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import {
    IconArrowLeft,
    IconChevronDown,
    IconChevronRight,
    IconCopy,
    IconDots,
    IconFileText,
    IconGripVertical,
    IconPlus,
    IconTrash,
    IconFolder,
    IconFile,
    IconIndentIncrease,
    IconIndentDecrease,
    IconArrowUp,
    IconArrowDown,
    IconStar,
    IconPencil,
    IconDeviceFloppy,
    IconDownload,
    IconCalendar,
    IconLayout,
    IconSpeakerphone,
    IconVideo,
    IconPhoto,
    IconCheck,
    IconCopyCheck,
} from "@tabler/icons-react";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
    Select as ShadcnSelect,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog";

import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import {
    useCreateQuotationMutation,
    useUpdateQuotationMutation,
} from "@/redux/features/quotation/quotationApi";
import { Client } from "@/types/client.type";
import { QuotationData } from "@/types/quotation.type";
import { publicApiUrl } from "@/lib/public-api";

// --- Types & Data Interfaces ---

type Feature = {
    id: number;
    name: string;
    route?: string;
    price?: string;
    children?: Feature[];
};

type PricingItem = {
    id: number;
    name: string;
    description: string;
    price: number;
    billingType: "fixed" | "monthly" | "yearly";
};

const currencies = [
    "Bangladeshi Taka (BDT)",
    "US Dollar (USD)"
];

const servicesList = [
    "Web Design & Development",
    "Marketing",
    "Video Editing",
    "Photo Editing",
];

const serviceMetaData: Record<string, { icon: any; description: string }> = {
    "Web Design & Development": {
        icon: IconLayout,
        description: "Custom web applications, responsive websites, and interactive UI/UX.",
    },
    "Marketing": {
        icon: IconSpeakerphone,
        description: "SEO, social media management, brand strategy, and paid ad campaigns.",
    },
    "Video Editing": {
        icon: IconVideo,
        description: "Post-production, motion graphics, video cutting, and color grading.",
    },
    "Photo Editing": {
        icon: IconPhoto,
        description: "High-end retouching, background removal, and product photo enhancement.",
    },
};

// Helper to get currency symbol
function getCurrencySymbol(currencyName: string) {
    if (currencyName.includes("USD")) return "$";
    return "৳";
}

// --- Initial Preset Data ---

const initialFeatures: Feature[] = [];

const initialMarketingFeatures: Feature[] = [];

// --- Recursive Tree Manipulations ---

const addNode = (
    nodes: Feature[],
    parentId: number | undefined,
    newNode: Feature,
): Feature[] => {
    if (parentId === undefined) return [...nodes, newNode];
    return nodes.map((node) => {
        if (node.id === parentId) {
            return {
                ...node,
                children: [...(node.children || []), newNode],
            };
        }
        if (node.children) {
            return {
                ...node,
                children: addNode(node.children, parentId, newNode),
            };
        }
        return node;
    });
};

const addNodesWithDuplicateCheck = (
    nodes: Feature[],
    parentId: number | undefined,
    newNodes: Feature[],
): { updatedNodes: Feature[]; addedCount: number; duplicateCount: number } => {
    let addedCount = 0;
    let duplicateCount = 0;

    const filterDuplicates = (existingList: Feature[], incomingList: Feature[]): Feature[] => {
        const existingNames = new Set(existingList.map((item) => item.name.trim().toLowerCase()));
        const uniqueIncoming: Feature[] = [];

        for (const item of incomingList) {
            const normalized = item.name.trim().toLowerCase();
            if (normalized && existingNames.has(normalized)) {
                duplicateCount++;
            } else {
                if (normalized) existingNames.add(normalized);
                const cleanedChildren =
                    item.children && item.children.length > 0
                        ? filterDuplicates([], item.children)
                        : item.children;
                uniqueIncoming.push({
                    ...item,
                    children: cleanedChildren,
                });
                addedCount++;
            }
        }
        return uniqueIncoming;
    };

    if (parentId === undefined) {
        const uniqueNew = filterDuplicates(nodes, newNodes);
        return { updatedNodes: [...nodes, ...uniqueNew], addedCount, duplicateCount };
    }

    const appendRecursive = (list: Feature[]): Feature[] => {
        return list.map((node) => {
            if (node.id === parentId) {
                const currentChildren = node.children || [];
                const uniqueNew = filterDuplicates(currentChildren, newNodes);
                return {
                    ...node,
                    children: [...currentChildren, ...uniqueNew],
                };
            }
            if (node.children && node.children.length > 0) {
                return {
                    ...node,
                    children: appendRecursive(node.children),
                };
            }
            return node;
        });
    };

    return { updatedNodes: appendRecursive(nodes), addedCount, duplicateCount };
};

const updateNode = (
    nodes: Feature[],
    id: number,
    updates: Partial<Feature>,
): Feature[] => {
    return nodes.map((node) => {
        if (node.id === id) {
            return { ...node, ...updates };
        }
        if (node.children) {
            return {
                ...node,
                children: updateNode(node.children, id, updates),
            };
        }
        return node;
    });
};

const deleteNode = (nodes: Feature[], id: number): Feature[] => {
    return nodes
        .filter((node) => node.id !== id)
        .map((node) => {
            if (node.children) {
                return {
                    ...node,
                    children: deleteNode(node.children, id),
                };
            }
            return node;
        });
};

let globalFeatureIdCounter = 0;
const generateUniqueFeatureId = (): number => {
    globalFeatureIdCounter += 1;
    return Date.now() * 1000 + (globalFeatureIdCounter % 1000);
};

const cloneFeatureWithNewIds = (node: Feature): Feature => {
    return {
        ...node,
        id: generateUniqueFeatureId(),
        name: `${node.name} (Copy)`,
        children: node.children ? node.children.map(cloneFeatureWithNewIds) : [],
    };
};

const duplicateNode = (nodes: Feature[], id: number): Feature[] => {
    const result: Feature[] = [];
    for (const node of nodes) {
        if (node.id === id) {
            result.push(node);
            result.push(cloneFeatureWithNewIds(node));
        } else if (node.children && node.children.length > 0) {
            result.push({
                ...node,
                children: duplicateNode(node.children, id),
            });
        } else {
            result.push(node);
        }
    }
    return result;
};

const indentNode = (nodes: Feature[], id: number): Feature[] => {
    let targetNode: Feature | null = null;

    const findAndRemove = (list: Feature[]): Feature[] => {
        return list
            .filter((node) => {
                if (node.id === id) {
                    targetNode = node;
                    return false;
                }
                return true;
            })
            .map((node) => {
                if (node.children) {
                    return {
                        ...node,
                        children: findAndRemove(node.children),
                    };
                }
                return node;
            });
    };

    const cleanTree = findAndRemove(nodes);
    if (!targetNode) return nodes;

    const insertSibling = (list: Feature[]): Feature[] => {
        for (let i = 0; i < list.length; i++) {
            if (list[i].children && list[i].children?.some((c) => c.id === id)) {
                return list;
            }
            if (i > 0 && list[i].id === id) {
                const sibling = list[i - 1];
                sibling.children = [...(sibling.children || []), targetNode!];
                return list.filter((n) => n.id !== id);
            }
            if (list[i].children) {
                const updated = insertSibling(list[i].children || []);
                if (updated !== list[i].children) {
                    list[i].children = updated;
                    return list;
                }
            }
        }
        return list;
    };

    return insertSibling(cleanTree);
};

const outdentNode = (nodes: Feature[], id: number): Feature[] => {
    let targetNode: Feature | null = null;

    const findAndRemove = (list: Feature[]): Feature[] => {
        return list
            .filter((node) => {
                if (node.id === id) {
                    targetNode = node;
                    return false;
                }
                return true;
            })
            .map((node) => {
                if (node.children) {
                    return {
                        ...node,
                        children: findAndRemove(node.children),
                    };
                }
                return node;
            });
    };

    const cleanTree = findAndRemove(nodes);
    if (!targetNode) return nodes;

    const insertSibling = (list: Feature[], parent?: Feature): Feature[] => {
        if (list.some((node) => node.id === id)) {
            return list;
        }

        for (let i = 0; i < list.length; i++) {
            const children = list[i].children || [];
            const idx = children.findIndex((c) => c.id === id);
            if (idx !== -1) {
                if (parent) {
                    const parentChildren = parent.children || [];
                    const pIdx = parentChildren.findIndex(
                        (c) => c.id === list[i].id,
                    );
                    parentChildren.splice(pIdx + 1, 0, targetNode!);
                    list[i].children = children.filter((c) => c.id !== id);
                    return list;
                } else {
                    const rootIdx = cleanTree.findIndex(
                        (n) => n.id === list[i].id,
                    );
                    cleanTree.splice(rootIdx + 1, 0, targetNode!);
                    list[i].children = children.filter((c) => c.id !== id);
                    return cleanTree;
                }
            }
            if (list[i].children) {
                const updated = insertSibling(list[i].children || [], list[i]);
                if (updated !== list[i].children) {
                    list[i].children = updated;
                    return list;
                }
            }
        }
        return list;
    };

    return insertSibling(cleanTree);
};

const makeMainNode = (nodes: Feature[], id: number): Feature[] => {
    let targetNode: Feature | null = null;

    const findAndRemove = (list: Feature[]): Feature[] => {
        return list
            .filter((node) => {
                if (node.id === id) {
                    targetNode = node;
                    return false;
                }
                return true;
            })
            .map((node) => {
                if (node.children) {
                    return {
                        ...node,
                        children: findAndRemove(node.children),
                    };
                }
                return node;
            });
    };

    const cleanTree = findAndRemove(nodes);
    if (!targetNode) return nodes;

    return [...cleanTree, { ...(targetNode as Feature), children: [] }];
};

const moveNodeUp = (nodes: Feature[], id: number): Feature[] => {
    const list = [...nodes];
    const idx = list.findIndex((n) => n.id === id);
    if (idx > 0) {
        const temp = list[idx];
        list[idx] = list[idx - 1];
        list[idx - 1] = temp;
        return list;
    }
    return list.map((node) => {
        if (node.children) {
            return {
                ...node,
                children: moveNodeUp(node.children, id),
            };
        }
        return node;
    });
};

const moveNodeDown = (nodes: Feature[], id: number): Feature[] => {
    const list = [...nodes];
    const idx = list.findIndex((n) => n.id === id);
    if (idx !== -1 && idx < list.length - 1) {
        const temp = list[idx];
        list[idx] = list[idx + 1];
        list[idx + 1] = temp;
        return list;
    }
    return list.map((node) => {
        if (node.children) {
            return {
                ...node,
                children: moveNodeDown(node.children, id),
            };
        }
        return node;
    });
};

const isDescendant = (
    nodes: Feature[],
    parentId: number,
    childId: number,
): boolean => {
    const findNode = (list: Feature[]): Feature | null => {
        for (const node of list) {
            if (node.id === parentId) return node;
            if (node.children) {
                const found = findNode(node.children);
                if (found) return found;
            }
        }
        return null;
    };

    const parentNode = findNode(nodes);
    if (!parentNode) return false;

    const checkChild = (node: Feature): boolean => {
        if (node.id === childId) return true;
        if (node.children) {
            return node.children.some(checkChild);
        }
        return false;
    };

    return parentNode.children?.some(checkChild) || false;
};

const moveNode = (
    nodes: Feature[],
    draggedId: number,
    targetId: number,
): Feature[] => {
    let draggedNode: Feature | null = null;

    const removeNode = (list: Feature[]): Feature[] => {
        return list
            .filter((node) => {
                if (node.id === draggedId) {
                    draggedNode = node;
                    return false;
                }
                return true;
            })
            .map((node) => {
                if (node.children) {
                    return {
                        ...node,
                        children: removeNode(node.children),
                    };
                }
                return node;
            });
    };

    const cleanTree = removeNode(nodes);
    if (!draggedNode) return nodes;

    const insertNode = (list: Feature[]): Feature[] => {
        return list.map((node) => {
            if (node.id === targetId) {
                return {
                    ...node,
                    children: [...(node.children || []), draggedNode!],
                };
            }
            if (node.children) {
                return {
                    ...node,
                    children: insertNode(node.children),
                };
            }
            return node;
        });
    };

    return insertNode(cleanTree);
};

const moveNodeSibling = (
    nodes: Feature[],
    draggedId: number,
    targetId: number,
    position: "before" | "after",
): Feature[] => {
    let draggedNode: Feature | null = null;

    const removeNode = (list: Feature[]): Feature[] => {
        return list
            .filter((node) => {
                if (node.id === draggedId) {
                    draggedNode = node;
                    return false;
                }
                return true;
            })
            .map((node) => {
                if (node.children) {
                    return {
                        ...node,
                        children: removeNode(node.children),
                    };
                }
                return node;
            });
    };

    const cleanTree = removeNode(nodes);
    if (!draggedNode) return nodes;

    const insertSibling = (list: Feature[]): Feature[] => {
        const idx = list.findIndex((n) => n.id === targetId);
        if (idx !== -1) {
            const copy = [...list];
            const insertIdx = position === "before" ? idx : idx + 1;
            copy.splice(insertIdx, 0, draggedNode!);
            return copy;
        }
        return list.map((node) => {
            if (node.children) {
                return {
                    ...node,
                    children: insertSibling(node.children),
                };
            }
            return node;
        });
    };

    return insertSibling(cleanTree);
};

function calculateFeatureTreeTotal(nodes: Feature[]): number {
    let total = 0;
    for (const node of nodes) {
        if (node.children && node.children.length > 0) {
            const childrenTotal = calculateFeatureTreeTotal(node.children);
            if (childrenTotal > 0) {
                total += childrenTotal;
            } else if (node.price) {
                const p = parseFloat(String(node.price).replace(/[^0-9.]/g, ""));
                if (!isNaN(p)) total += p;
            }
        } else if (node.price) {
            const p = parseFloat(String(node.price).replace(/[^0-9.]/g, ""));
            if (!isNaN(p)) total += p;
        }
    }
    return total;
}function extractNameRoutePrice(rawText: string): { name: string; route: string; price: string } {
    let text = rawText.trim().replace(/^[-*•◦▪+]\s*/, '').trim();
    let route = '';
    let price = '';

    // Extract price from end: e.g. " - 3000" or " - ৳3,000" or " - 10000"
    const priceMatch = text.match(/\s*-\s*([৳$]?\d[\d,.]*)$/);
    if (priceMatch) {
        price = priceMatch[1].replace(/[^0-9.]/g, '');
        text = text.substring(0, priceMatch.index).trim();
    }

    // Extract route from parentheses at end: e.g. " (/services/...)" or " (http...)"
    const routeMatch = text.match(/\s*\(([^)]+)\)$/);
    if (routeMatch) {
        const potentialRoute = routeMatch[1].trim();
        if (potentialRoute.startsWith('/') || potentialRoute.startsWith('http')) {
            route = potentialRoute;
            text = text.substring(0, routeMatch.index).trim();
        }
    }

    return {
        name: text,
        route,
        price,
    };
}

function convertJsonToFeature(rawObj: any): Feature | null {
    if (!rawObj || typeof rawObj !== "object") return null;

    let name = String(rawObj.name || rawObj.title || rawObj.label || rawObj.featureName || "").trim();
    if (!name) return null;

    let route = rawObj.route || rawObj.path || rawObj.url || "";
    let price = rawObj.price !== undefined ? String(rawObj.price) : "";

    if ((name.includes("(") && name.includes(")")) || name.includes(" - ")) {
        const extracted = extractNameRoutePrice(name);
        name = extracted.name;
        if (!route && extracted.route) route = extracted.route;
        if (!price && extracted.price) price = extracted.price;
    }

    const rawChildren = Array.isArray(rawObj.children)
        ? rawObj.children
        : Array.isArray(rawObj.subFeatures)
        ? rawObj.subFeatures
        : Array.isArray(rawObj.items)
        ? rawObj.items
        : [];

    const children: Feature[] = [];
    rawChildren.forEach((child: any) => {
        const converted = convertJsonToFeature(child);
        if (converted) children.push(converted);
    });

    return {
        id: generateUniqueFeatureId(),
        name,
        route: String(route),
        price: String(price),
        children: children.length > 0 ? children : undefined,
    };
}

function parseBulkFeatures(text: string): Feature[] {
    if (!text || text.trim() === "") return [];

    const trimmed = text.trim();

    // 1. Try JSON parsing (handles standard JSON, arrays, single objects, or code-block wrapped JSON)
    let jsonStr = trimmed;
    if (trimmed.startsWith("```")) {
        jsonStr = trimmed.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    }

    if (jsonStr.startsWith("[") || jsonStr.startsWith("{")) {
        try {
            const parsed = JSON.parse(jsonStr);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            const result: Feature[] = [];

            items.forEach((rawItem) => {
                const feature = convertJsonToFeature(rawItem);
                if (feature) {
                    result.push(feature);
                }
            });

            if (result.length > 0) {
                return result;
            }
        } catch {
            // If JSON parse fails, fallback to line-by-line text parsing
        }
    }

    // 2. Fallback to Indented Line / Plain Text Parser
    const lines = text.split("\n").filter((line) => line.trim() !== "");
    const result: Feature[] = [];
    const stack: { level: number; feature: Feature }[] = [];

    lines.forEach((line) => {
        const match = line.match(/^(\s*)/);
        const indentStr = match ? match[0] : "";
        const level = indentStr.replace(/\t/g, "    ").length;

        const parsed = extractNameRoutePrice(line);

        const newFeature: Feature = {
            id: generateUniqueFeatureId(),
            name: parsed.name,
            route: parsed.route,
            price: parsed.price,
            children: [],
        };

        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
            stack.pop();
        }

        if (stack.length === 0) {
            result.push(newFeature);
        } else {
            const parent = stack[stack.length - 1].feature;
            if (!parent.children) parent.children = [];
            parent.children.push(newFeature);
        }
        stack.push({ level, feature: newFeature });
    });

    return result;
}

// Convert nested feature array to flat array of indented strings
function flattenFeatureTree(features: Feature[], level = 0, isMarketing = false): string[] {
    let result: string[] = [];
    for (const f of features) {
        const indent = "  ".repeat(level);
        let text = f.name;
        if (f.route && !isMarketing) {
            text += ` (${f.route})`;
        }
        if (f.price) {
            text += ` - ${f.price}`;
        }
        result.push(indent + text);
        if (f.children && f.children.length > 0) {
            result.push(...flattenFeatureTree(f.children, level + 1, isMarketing));
        }
    }
    return result;
}

// --- Context for Dynamic State Management ---

type QuotationContextType = {
    selectedServices: string[];
    setSelectedServices: React.Dispatch<React.SetStateAction<string[]>>;
    selectedClient: string;
    setSelectedClient: (client: string) => void;
    selectedCurrency: string;
    setSelectedCurrency: (currency: string) => void;
    projectTitle: string;
    setProjectTitle: (title: string) => void;

    features: Feature[];
    setFeatures: React.Dispatch<React.SetStateAction<Feature[]>>;
    marketingFeatures: Feature[];
    setMarketingFeatures: React.Dispatch<React.SetStateAction<Feature[]>>;

    webDevPricing: PricingItem[];
    photoEditingQty: number;
    setPhotoEditingQty: (qty: number) => void;
    photoEditingRate: number;
    setPhotoEditingRate: (rate: number) => void;
    videoEditingQty: number;
    setVideoEditingQty: (qty: number) => void;
    videoEditingRate: number;
    setVideoEditingRate: (rate: number) => void;
    videoEditingUnit: "video" | "second" | "10-seconds";
    setVideoEditingUnit: (unit: "video" | "second" | "10-seconds") => void;
    videoEditingPricing: PricingItem[];
    marketingPricing: PricingItem[];
    marketingAdBudget: number;
    setMarketingAdBudget: (budget: number) => void;

    addFeature: (service: "web-dev" | "marketing", parentId?: number) => void;
    updateFeature: (
        service: "web-dev" | "marketing",
        id: number,
        updates: Partial<Feature>,
    ) => void;
    deleteFeature: (service: "web-dev" | "marketing", id: number) => void;
    duplicateFeature: (service: "web-dev" | "marketing", id: number) => void;
    indentFeature: (service: "web-dev" | "marketing", id: number) => void;
    outdentFeature: (service: "web-dev" | "marketing", id: number) => void;
    makeMainFeature: (service: "web-dev" | "marketing", id: number) => void;
    moveFeatureUp: (service: "web-dev" | "marketing", id: number) => void;
    moveFeatureDown: (service: "web-dev" | "marketing", id: number) => void;
    bulkPasteFeatures: (service: "web-dev" | "marketing", text: string, parentId?: number) => void;

    draggedId: number | null;
    setDraggedId: (id: number | null) => void;
    moveFeatureDnd: (
        service: "web-dev" | "marketing",
        draggedId: number,
        targetId: number,
        position: "before" | "after" | "inside",
    ) => void;

    addPricingItem: (
        service: "web-dev" | "video-editing" | "marketing",
    ) => void;
    updatePricingItem: (
        service: "web-dev" | "video-editing" | "marketing",
        id: number,
        updates: Partial<PricingItem>,
    ) => void;
    deletePricingItem: (
        service: "web-dev" | "video-editing" | "marketing",
        id: number,
    ) => void;

    draggedServiceIndex: number | null;
    setDraggedServiceIndex: (index: number | null) => void;
    reorderServices: (
        draggedIndex: number,
        targetIndex: number,
        position: "before" | "after",
    ) => void;

    draggedPricingIndex: number | null;
    setDraggedPricingIndex: (index: number | null) => void;
    reorderPricingItems: (
        service: "web-dev" | "video-editing" | "marketing",
        draggedIndex: number,
        targetIndex: number,
        position: "before" | "after",
    ) => void;

    notIncludedItems: string[];
    setNotIncludedItems: React.Dispatch<React.SetStateAction<string[]>>;
    clientRequirements: string[];
    setClientRequirements: React.Dispatch<React.SetStateAction<string[]>>;
    paymentMilestones: any[];
    setPaymentMilestones: React.Dispatch<React.SetStateAction<any[]>>;
    paymentPreset: "50-50" | "30-40-30" | "100-upfront" | "custom";
    setPaymentPreset: React.Dispatch<React.SetStateAction<"50-50" | "30-40-30" | "100-upfront" | "custom">>;

    discountPercentage: number;
    setDiscountPercentage: React.Dispatch<React.SetStateAction<number>>;
    taxPercentage: number;
    setTaxPercentage: React.Dispatch<React.SetStateAction<number>>;
};

const QuotationContext = createContext<QuotationContextType | undefined>(
    undefined,
);

export function useQuotation() {
    const context = useContext(QuotationContext);
    if (!context)
        throw new Error("useQuotation must be used within a QuotationProvider");
    return context;
}

// --- Component Definition ---

function QuotationDatePicker({
    value,
    onChange,
    placeholder = "Pick a date",
}: {
    value: string;
    onChange: (dateStr: string) => void;
    placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const dateObj = React.useMemo(() => {
        if (!value) return undefined;
        const [y, m, d] = value.split("-").map(Number);
        if (y && m && d) return new Date(y, m - 1, d);
        return new Date(value);
    }, [value]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "w-full justify-between text-left font-normal bg-background h-10 px-3 border-input",
                        !value && "text-muted-foreground"
                    )}
                >
                    <span className="flex items-center gap-2 truncate text-sm">
                        <IconCalendar className="size-4 text-muted-foreground shrink-0" />
                        {dateObj ? format(dateObj, "PPP") : placeholder}
                    </span>
                    <IconChevronDown className="size-4 text-muted-foreground opacity-50 shrink-0" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={dateObj}
                    onSelect={(date) => {
                        if (date) {
                            onChange(format(date, "yyyy-MM-dd"));
                        } else {
                            onChange("");
                        }
                        setOpen(false);
                    }}
                    defaultMonth={dateObj}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    );
}

export default function QuotationBuilder({
    initialData,
    pageTitle,
    pageSubtitle,
    backUrl,
}: {
    initialData?: QuotationData;
    pageTitle?: string;
    pageSubtitle?: string;
    backUrl?: string;
}) {
    const router = useRouter();
    const { data: clientsData, isLoading: clientsLoading } = useGetClientsQuery({});
    const [createQuotation, { isLoading: isCreating }] = useCreateQuotationMutation();
    const [updateQuotation, { isLoading: isUpdating }] = useUpdateQuotationMutation();

    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [selectedClient, setSelectedClient] = useState("");
    const [clientSnapshot, setClientSnapshot] = useState<any>({
        contactName: "",
        companyName: "",
        address: "",
        email: "",
        phone: "",
    });
    const [selectedCurrency, setSelectedCurrency] = useState("Bangladeshi Taka (BDT)");
    const [projectTitle, setProjectTitle] = useState("");
    const [quotationDate, setQuotationDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [validUntilDate, setValidUntilDate] = useState(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    const [overviewText, setOverviewText] = useState(`Dear Valued Client,

Thank you for giving WebBriks the opportunity to submit this proposal for your upcoming project. We are thrilled at the prospect of partnering with your business to deliver exceptional digital solutions tailored to your goals.

This quotation outlines the project scope, technical deliverables, pricing structure, and execution milestones designed specifically for your requirements. Our team is dedicated to providing cutting-edge design, robust development, and seamless execution to ensure maximum return on your investment.

Please review the details below. Should you have any questions or require custom modifications, feel free to reach out to us. We look forward to collaborating with you!`);
    const [features, setFeatures] = useState<Feature[]>([]);
    const [marketingFeatures, setMarketingFeatures] = useState<Feature[]>([]);
    const [webDevPricing, setWebDevPricing] = useState<PricingItem[]>([]);
    const [marketingPricing, setMarketingPricing] = useState<PricingItem[]>([]);
    const [marketingAdBudget, setMarketingAdBudget] = useState<number>(0);
    const [photoEditingQty, setPhotoEditingQty] = useState<number>(0);
    const [photoEditingRate, setPhotoEditingRate] = useState<number>(0);
    const [videoEditingQty, setVideoEditingQty] = useState<number>(0);
    const [videoEditingRate, setVideoEditingRate] = useState<number>(0);
    const [videoEditingUnit, setVideoEditingUnit] = useState<"video" | "second" | "10-seconds">("video");
    const [notIncludedItems, setNotIncludedItems] = useState<string[]>([]);
    const [clientRequirements, setClientRequirements] = useState<string[]>([]);
    const [paymentPreset, setPaymentPreset] = useState<"50-50" | "30-40-30" | "100-upfront" | "custom">("50-50");
    const [paymentMilestones, setPaymentMilestones] = useState<any[]>([
        { label: "50% Upfront Deposit (Project Kickoff)", percentage: 50 },
        { label: "50% Final Delivery & Handover", percentage: 50 },
    ]);
    const [discountPercentage, setDiscountPercentage] = useState<number>(0);
    const [taxPercentage, setTaxPercentage] = useState<number>(0);

    const [draggedId, setDraggedId] = useState<number | null>(null);
    const [draggedServiceIndex, setDraggedServiceIndex] = useState<number | null>(null);
    const [draggedPricingIndex, setDraggedPricingIndex] = useState<number | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const hasLoadedRef = useRef(false);

    // Map database currency symbols to readable text
    useEffect(() => {
        if (initialData && !hasLoadedRef.current) {
            hasLoadedRef.current = true;

            if (initialData.currency === "$") {
                setSelectedCurrency("US Dollar (USD)");
            } else {
                setSelectedCurrency("Bangladeshi Taka (BDT)");
            }

            const rawClientId = typeof initialData.clientId === 'object'
                ? (initialData.clientId as any)?._id
                : initialData.clientId;
            setSelectedClient(rawClientId || "");

            if (initialData.client) {
                setClientSnapshot(initialData.client);
            }

            if (initialData.details) {
                setProjectTitle(initialData.details.title || "");
                if (initialData.details.date) {
                    setQuotationDate(new Date(initialData.details.date).toISOString().split("T")[0]);
                }
                if (initialData.details.validUntil) {
                    setValidUntilDate(new Date(initialData.details.validUntil).toISOString().split("T")[0]);
                }
            }

            setOverviewText(initialData.overview || `Dear Valued Client,

Thank you for giving WebBriks the opportunity to submit this proposal for your upcoming project. We are thrilled at the prospect of partnering with your business to deliver exceptional digital solutions tailored to your goals.

This quotation outlines the project scope, technical deliverables, pricing structure, and execution milestones designed specifically for your requirements. Our team is dedicated to providing cutting-edge design, robust development, and seamless execution to ensure maximum return on your investment.

Please review the details below. Should you have any questions or require custom modifications, feel free to reach out to us. We look forward to collaborating with you!`);
            if (initialData.notIncluded && Array.isArray(initialData.notIncluded) && initialData.notIncluded.length > 0) {
                setNotIncludedItems(initialData.notIncluded);
            }
            if (initialData.clientRequirements && Array.isArray(initialData.clientRequirements) && initialData.clientRequirements.length > 0) {
                setClientRequirements(initialData.clientRequirements);
            }
            if (initialData.paymentMilestones && Array.isArray(initialData.paymentMilestones) && initialData.paymentMilestones.length > 0) {
                setPaymentMilestones(initialData.paymentMilestones);
                const ms = initialData.paymentMilestones;
                if (ms.length === 2 && Number(ms[0]?.percentage) === 50 && Number(ms[1]?.percentage) === 50) {
                    setPaymentPreset("50-50");
                } else if (ms.length === 3 && Number(ms[0]?.percentage) === 30 && Number(ms[1]?.percentage) === 40 && Number(ms[2]?.percentage) === 30) {
                    setPaymentPreset("30-40-30");
                } else if (ms.length === 1 && Number(ms[0]?.percentage) === 100) {
                    setPaymentPreset("100-upfront");
                } else {
                    setPaymentPreset("custom");
                }
            } else {
                setPaymentPreset("50-50");
                setPaymentMilestones([
                    { label: "50% Upfront Deposit (Project Kickoff)", percentage: 50 },
                    { label: "50% Final Delivery & Handover", percentage: 50 },
                ]);
            }

            if (initialData.services && initialData.services[0]) {
                if (initialData.services[0].discount !== undefined) {
                    setDiscountPercentage(Number(initialData.services[0].discount) || 0);
                }
                if (initialData.services[0].taxRate !== undefined) {
                    setTaxPercentage(Number(initialData.services[0].taxRate) || 0);
                }
            }

            const activeServices: string[] = [];
            const servicesList = initialData.services || [];

            for (const service of servicesList) {
                if (service.category === "web-development") {
                    activeServices.push("Web Design & Development");
                    if (service.scopeItems && service.scopeItems.length > 0) {
                        setFeatures(parseBulkFeatures(service.scopeItems.join("\n")));
                    }
                    if (service.lineItems) {
                        setWebDevPricing(service.lineItems.map((item: any, index: number) => ({
                            id: index + 1,
                            name: item.title,
                            description: item.description || "",
                            price: item.price,
                            billingType: item.billingCycle,
                        })));
                    }
                } else if (service.category === "photo-editing") {
                    activeServices.push("Photo Editing");
                    const item = service.lineItems?.[0];
                    if (item) {
                        setPhotoEditingQty(item.quantity || 1);
                        setPhotoEditingRate(item.price || 0);
                    }
                } else if (service.category === "video-editing") {
                    activeServices.push("Video Editing");
                    const item = service.lineItems?.[0];
                    if (item) {
                        setVideoEditingQty(item.quantity || 1);
                        setVideoEditingRate(item.price || 0);
                        const cycle = item.billingCycle;
                        setVideoEditingUnit(
                            cycle === "per-second"
                                ? "second"
                                : cycle === "per-10s"
                                ? "10-seconds"
                                : "video"
                        );
                    }
                } else if (service.category === "marketing") {
                    activeServices.push("Marketing");
                    if (service.scopeItems && service.scopeItems.length > 0) {
                        setMarketingFeatures(parseBulkFeatures(service.scopeItems.join("\n")));
                    }
                    if (service.lineItems) {
                        const budgetItem = service.lineItems.find((item: any) => item.title === "Monthly Advertising Budget");
                        if (budgetItem) {
                            setMarketingAdBudget(budgetItem.price || 0);
                        }
                        const regularItems = service.lineItems.filter((item: any) => item.title !== "Monthly Advertising Budget");
                        setMarketingPricing(regularItems.map((item: any, index: number) => ({
                            id: index + 1,
                            name: item.title,
                            description: item.description || "",
                            price: item.price,
                            billingType: item.billingCycle,
                        })));
                    }
                }
            }
            if (activeServices.length > 0) {
                setSelectedServices(activeServices);
            }
        }
    }, [initialData]);

    const addFeature = (service: "web-dev" | "marketing", parentId?: number) => {
        const newFeature: Feature = {
            id: generateUniqueFeatureId(),
            name: "New Feature",
            route: "",
            price: "",
        };
        const setter = service === "marketing" ? setMarketingFeatures : setFeatures;
        setter((prev) => addNode(prev, parentId, newFeature));
    };

    const updateFeature = (
        service: "web-dev" | "marketing",
        id: number,
        updates: Partial<Feature>,
    ) => {
        const setter = service === "marketing" ? setMarketingFeatures : setFeatures;
        setter((prev) => updateNode(prev, id, updates));
    };

    const deleteFeature = (service: "web-dev" | "marketing", id: number) => {
        const setter = service === "marketing" ? setMarketingFeatures : setFeatures;
        setter((prev) => deleteNode(prev, id));
    };

    const duplicateFeature = (service: "web-dev" | "marketing", id: number) => {
        const setter = service === "marketing" ? setMarketingFeatures : setFeatures;
        setter((prev) => duplicateNode(prev, id));
        toast.success("Feature duplicated!");
    };

    const indentFeature = (service: "web-dev" | "marketing", id: number) => {
        const setter = service === "marketing" ? setMarketingFeatures : setFeatures;
        setter((prev) => indentNode(prev, id));
    };

    const outdentFeature = (service: "web-dev" | "marketing", id: number) => {
        const setter = service === "marketing" ? setMarketingFeatures : setFeatures;
        setter((prev) => outdentNode(prev, id));
    };

    const makeMainFeature = (service: "web-dev" | "marketing", id: number) => {
        const setter = service === "marketing" ? setMarketingFeatures : setFeatures;
        setter((prev) => makeMainNode(prev, id));
    };

    const moveFeatureUp = (service: "web-dev" | "marketing", id: number) => {
        const setter = service === "marketing" ? setMarketingFeatures : setFeatures;
        setter((prev) => moveNodeUp(prev, id));
    };

    const moveFeatureDown = (service: "web-dev" | "marketing", id: number) => {
        const setter = service === "marketing" ? setMarketingFeatures : setFeatures;
        setter((prev) => moveNodeDown(prev, id));
    };

    const bulkPasteFeatures = (
        service: "web-dev" | "marketing",
        text: string,
        parentId?: number,
    ) => {
        const newFeatures = parseBulkFeatures(text);
        if (newFeatures.length === 0) {
            toast.error("No valid features found in pasted text/JSON!");
            return;
        }
        const setter = service === "marketing" ? setMarketingFeatures : setFeatures;
        setter((prev) => {
            const { updatedNodes, addedCount, duplicateCount } = addNodesWithDuplicateCheck(
                prev,
                parentId,
                newFeatures,
            );
            if (addedCount > 0 && duplicateCount > 0) {
                toast.success(`${addedCount} feature(s) imported (${duplicateCount} duplicate(s) skipped).`);
            } else if (addedCount > 0) {
                toast.success(`${addedCount} feature(s) imported successfully!`);
            } else if (duplicateCount > 0) {
                toast.warning(`All ${duplicateCount} feature(s) already exist in this list!`);
            }
            return updatedNodes;
        });
    };

    const moveFeatureDnd = (
        service: "web-dev" | "marketing",
        draggedId: number,
        targetId: number,
        position: "before" | "after" | "inside",
    ) => {
        const setter = service === "marketing" ? setMarketingFeatures : setFeatures;
        if (position === "inside") {
            setter((prev) => moveNode(prev, draggedId, targetId));
        } else {
            setter((prev) =>
                moveNodeSibling(prev, draggedId, targetId, position),
            );
        }
    };

    const addPricingItem = (
        service: "web-dev" | "video-editing" | "marketing",
    ) => {
        const newItem: PricingItem = {
            id: Date.now(),
            name: "",
            description: "",
            price: 0,
            billingType: "fixed",
        };
        if (service === "web-dev")
            setWebDevPricing((prev) => [...prev, newItem]);
        else if (service === "marketing")
            setMarketingPricing((prev) => [...prev, newItem]);
    };

    const updatePricingItem = (
        service: "web-dev" | "video-editing" | "marketing",
        id: number,
        updates: Partial<PricingItem>,
    ) => {
        const setter = service === "web-dev" ? setWebDevPricing : setMarketingPricing;
        setter((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        );
    };

    const deletePricingItem = (
        service: "web-dev" | "video-editing" | "marketing",
        id: number,
    ) => {
        const setter = service === "web-dev" ? setWebDevPricing : setMarketingPricing;
        setter((prev) => prev.filter((item) => item.id !== id));
    };

    const reorderServices = (
        draggedIndex: number,
        targetIndex: number,
        position: "before" | "after",
    ) => {
        if (draggedIndex === targetIndex) return;
        setSelectedServices((prev) => {
            const list = prev.filter((_, idx) => idx !== draggedIndex);
            const itemToInsert = prev[draggedIndex];
            const targetItem = prev[targetIndex];
            const insertIndex = list.indexOf(targetItem);
            if (insertIndex === -1) return prev;

            const finalIndex =
                position === "before" ? insertIndex : insertIndex + 1;
            list.splice(finalIndex, 0, itemToInsert);
            return list;
        });
    };

    const reorderPricingItems = (
        service: "web-dev" | "video-editing" | "marketing",
        draggedIndex: number,
        targetIndex: number,
        position: "before" | "after",
    ) => {
        const setter = service === "web-dev" ? setWebDevPricing : setMarketingPricing;
        setter((prev) => {
            if (draggedIndex === targetIndex) return prev;
            const list = prev.filter((_, idx) => idx !== draggedIndex);
            const itemToInsert = prev[draggedIndex];
            const targetItem = prev[targetIndex];
            const insertIndex = list.indexOf(targetItem);
            if (insertIndex === -1) return prev;

            const finalIndex =
                position === "before" ? insertIndex : insertIndex + 1;
            list.splice(finalIndex, 0, itemToInsert);
            return list;
        });
    };

    // --- Save Logic ---

    const quotationValidationSchema = z.object({
        selectedClient: z.string().min(1, "Please select a client"),
        projectTitle: z.string().min(1, "Project Title is required"),
        selectedCurrency: z.string().min(1, "Please select a currency"),
        quotationDate: z.string().min(1, "Quotation Date is required"),
        validUntilDate: z.string().min(1, "Valid Until Date is required"),
        selectedServices: z.array(z.string()).min(1, "Please select at least one active service"),
    });

    const handleSaveDraft = async () => {
        const validation = quotationValidationSchema.safeParse({
            selectedClient,
            projectTitle,
            selectedCurrency,
            quotationDate,
            validUntilDate,
            selectedServices,
        });

        if (!validation.success) {
            const firstError = validation.error.issues[0]?.message || "Please fill in all required fields";
            toast.error(firstError);
            return;
        }

        const flattenedWebDev = flattenFeatureTree(features, 0, false);
        const flattenedMarketing = flattenFeatureTree(marketingFeatures, 0, true);

        const services: any[] = [];

        if (selectedServices.includes("Web Design & Development")) {
            const featuresTotal = calculateFeatureTreeTotal(features);
            const lineItems = webDevPricing.map(i => ({
                title: i.name,
                description: i.description,
                price: i.price,
                billingCycle: i.billingType === "fixed" ? "one-time" : "monthly" as any,
            }));

            services.push({
                category: "web-development",
                scopeDescription: "Standard web design and development specifications.",
                scopeItems: flattenedWebDev,
                lineItems,
                basePrice: featuresTotal,
                discount: discountPercentage,
                taxRate: taxPercentage,
            });
        }

        if (selectedServices.includes("Photo Editing")) {
            services.push({
                category: "photo-editing",
                scopeDescription: "Photo editing services.",
                scopeItems: [],
                lineItems: [{
                    title: "Photo Editing Services",
                    price: photoEditingRate,
                    billingCycle: "per-image",
                    quantity: photoEditingQty,
                    description: "Standard photo editing rate",
                }],
            });
        }

        if (selectedServices.includes("Video Editing")) {
            const billingCycle = videoEditingUnit === "video"
                ? "per-video"
                : videoEditingUnit === "second"
                ? "per-second"
                : "per-10s";

            services.push({
                category: "video-editing",
                scopeDescription: "Video post-production and editing services.",
                scopeItems: [],
                lineItems: [{
                    title: "Video Editing Services",
                    price: videoEditingRate,
                    billingCycle: billingCycle,
                    quantity: videoEditingQty,
                    description: "Standard video editing rate",
                }],
            });
        }

        if (selectedServices.includes("Marketing")) {
            const lineItems: any[] = marketingPricing.map(i => ({
                title: i.name,
                description: i.description,
                price: i.price,
                billingCycle: i.billingType === "fixed" ? "one-time" : "monthly",
            }));

            if (marketingAdBudget > 0) {
                lineItems.push({
                    title: "Monthly Advertising Budget",
                    price: marketingAdBudget,
                    billingCycle: "monthly",
                    quantity: 1,
                    description: "Client paid advertising campaign budget",
                });
            }

            services.push({
                category: "marketing",
                scopeDescription: "Digital marketing and advertising campaign services.",
                scopeItems: flattenedMarketing,
                lineItems: lineItems,
            });
        }

        const payload = {
            serviceType: "web-development" as const,
            clientId: selectedClient,
            currency: selectedCurrency === "US Dollar (USD)" ? "$" : "৳",
            company: initialData?.company || {
                name: "WebBriks",
                address: "115 Senpara Parbata, Mirpur, Dhaka 1216, Bangladesh.",
                email: "info@webbriks.com",
                phone: "+8801977201923",
                website: "www.webbriks.com",
                logo: "/assets/image/logo.svg",
            },
            client: clientSnapshot,
            details: {
                title: projectTitle || "Untitled Project",
                date: new Date(quotationDate).toISOString(),
                validUntil: new Date(validUntilDate).toISOString(),
            },
            overview: overviewText,
            services: services,
            notIncluded: notIncludedItems,
            clientRequirements: clientRequirements,
            paymentMilestones: paymentMilestones,
            status: initialData?.status || "draft",
        };

        try {
            if (initialData?._id) {
                const res = await updateQuotation({ id: initialData._id, ...payload }).unwrap();
                toast.success("🎉 Quotation updated successfully!");
                router.push(`/quotations/${res._id}`);
            } else {
                const res = await createQuotation(payload).unwrap();
                toast.success("🎉 Quotation created successfully!");
                router.push(`/quotations/${res._id}`);
            }
        } catch (err: any) {
            toast.error(err?.data?.message || "Failed to save quotation.");
        }
    };

    // --- Export PDF ---

    const handleExportPDF = async () => {
        if (!initialData?._id) {
            toast.error("Please save the quotation first before exporting PDF!");
            return;
        }
        setIsExporting(true);
        try {
            const pdfApiUrl = publicApiUrl(`/api/quotations/${initialData._id}/pdf/puppeteer`);
            const res = await fetch(pdfApiUrl, {
                credentials: "include",
                mode: "cors",
            });
            if (!res.ok) throw new Error("Export failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `quotation-${initialData.quotationNumber || initialData._id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success("🎉 PDF exported successfully!");
        } catch (err) {
            toast.error("Failed to export PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <QuotationContext.Provider
            value={{
                selectedServices,
                setSelectedServices,
                selectedClient,
                setSelectedClient,
                selectedCurrency,
                setSelectedCurrency,
                projectTitle,
                setProjectTitle,
                features,
                setFeatures,
                marketingFeatures,
                setMarketingFeatures,
                webDevPricing,
                photoEditingQty,
                setPhotoEditingQty,
                photoEditingRate,
                setPhotoEditingRate,
                videoEditingQty,
                setVideoEditingQty,
                videoEditingRate,
                setVideoEditingRate,
                videoEditingUnit,
                setVideoEditingUnit,
                videoEditingPricing: [],
                marketingPricing,
                marketingAdBudget,
                setMarketingAdBudget,
                addFeature,
                updateFeature,
                deleteFeature,
                duplicateFeature,
                indentFeature,
                outdentFeature,
                makeMainFeature,
                moveFeatureUp,
                moveFeatureDown,
                bulkPasteFeatures,
                draggedId,
                setDraggedId,
                moveFeatureDnd,
                addPricingItem,
                updatePricingItem,
                deletePricingItem,
                draggedServiceIndex,
                setDraggedServiceIndex,
                reorderServices,
                draggedPricingIndex,
                setDraggedPricingIndex,
                reorderPricingItems,
                notIncludedItems,
                setNotIncludedItems,
                clientRequirements,
                setClientRequirements,
                paymentMilestones,
                setPaymentMilestones,
                paymentPreset,
                setPaymentPreset,
                discountPercentage,
                setDiscountPercentage,
                taxPercentage,
                setTaxPercentage,
            }}
        >
            <div className="flex flex-col gap-4 p-0 md:gap-6 md:p-0 font-sans">
                {backUrl && (
                    <div className="flex items-center gap-3 py-1">
                        <Button
                            size="icon"
                            variant="secondary"
                            onClick={() => router.push(backUrl)}
                        >
                            <IconArrowLeft />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">{pageTitle || "Quotation Studio"}</h1>
                            <p className="text-xs text-muted-foreground">
                                {initialData?.quotationNumber
                                    ? `Quotation ID: ${initialData.quotationNumber}`
                                    : "Drafting new quotation"}
                            </p>
                        </div>
                    </div>
                )}

                {/* Form */}
                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] font-sans">
                    <div className="min-w-0 space-y-6">
                        {/* Quotation Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Quotation Information</CardTitle>
                                <CardDescription>Basic client and project details.</CardDescription>
                            </CardHeader>
                            <Separator />
                            <CardContent className="grid gap-6 p-6 md:grid-cols-2 lg:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Client <span className="text-destructive">*</span></Label>
                                    <ShadcnSelect
                                        value={selectedClient}
                                        onValueChange={(val) => {
                                            const c = clientsData?.clients?.find((x: Client) => x._id === val);
                                            if (c) {
                                                setSelectedClient(val);
                                                const clientName = c.name || "Valued Client";
                                                setClientSnapshot({
                                                    contactName: clientName,
                                                    companyName: c.name || "",
                                                    email: c.emails?.[0] || "",
                                                    phone: c.phone || "",
                                                    address: c.address || c.officeAddress || "",
                                                });
                                                setOverviewText((prev) => {
                                                    if (prev && /^Dear [^,\n]+,/.test(prev)) {
                                                        return prev.replace(/^Dear [^,\n]+,(\s*)?/, `Dear ${clientName},\n\n`);
                                                    }
                                                    return prev;
                                                });
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="w-full h-10 bg-background border-input font-medium">
                                            <SelectValue placeholder={clientsLoading ? 'Loading clients...' : 'Select a Client'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {clientsData?.clients?.map((c: Client) => (
                                                <SelectItem key={c._id} value={c._id || ""}>
                                                    {c.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </ShadcnSelect>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="project-title">Project Title <span className="text-destructive">*</span></Label>
                                    <Input
                                        id="project-title"
                                        placeholder="Enter project title"
                                        value={projectTitle}
                                        onChange={(e) => setProjectTitle(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Currency <span className="text-destructive">*</span></Label>
                                    <ShadcnSelect
                                        value={selectedCurrency}
                                        onValueChange={(val) => setSelectedCurrency(val)}
                                    >
                                        <SelectTrigger className="w-full h-10 bg-background border-input font-medium">
                                            <SelectValue placeholder="Select Currency" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {currencies.map((currency) => (
                                                <SelectItem key={currency} value={currency}>
                                                    {currency}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </ShadcnSelect>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="quotation-date">Quotation Date <span className="text-destructive">*</span></Label>
                                    <QuotationDatePicker
                                        value={quotationDate}
                                        onChange={(dateStr) => setQuotationDate(dateStr)}
                                        placeholder="Pick quotation date"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="valid-until">Valid Until <span className="text-destructive">*</span></Label>
                                    <QuotationDatePicker
                                        value={validUntilDate}
                                        onChange={(dateStr) => setValidUntilDate(dateStr)}
                                        placeholder="Pick valid until date"
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                                    <Label htmlFor="overview">
                                        Overview / Introduction <span className="text-muted-foreground font-normal text-xs ml-1">(Optional)</span>
                                    </Label>
                                    <Textarea
                                        id="overview"
                                        placeholder="Add summary overview of quotation..."
                                        value={overviewText}
                                        onChange={(e) => setOverviewText(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Services Included Toggles */}
                        <Card className="border shadow-xs">
                            <CardHeader className="pb-3">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-lg font-bold">Services Included</CardTitle>
                                        <CardDescription className="text-xs">
                                            Select the service categories to include in this quotation.
                                        </CardDescription>
                                    </div>
                                    {selectedServices.length > 0 && (
                                        <Badge variant="secondary" className="w-fit font-semibold text-xs px-3 py-1 bg-primary/10 text-primary border-primary/20">
                                            {selectedServices.length} {selectedServices.length === 1 ? "Service" : "Services"} Selected
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <Separator />
                            <CardContent className="p-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {servicesList.map((serviceName) => {
                                        const checked = selectedServices.includes(serviceName);
                                        const meta = serviceMetaData[serviceName];
                                        const IconComponent = meta?.icon || IconLayout;

                                        return (
                                            <div
                                                key={serviceName}
                                                onClick={() => {
                                                    setSelectedServices((current) =>
                                                        current.includes(serviceName)
                                                            ? current.filter((item) => item !== serviceName)
                                                            : [...current, serviceName],
                                                    );
                                                }}
                                                className={cn(
                                                    "group relative flex items-start gap-3.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer select-none",
                                                    checked
                                                        ? "border-primary bg-primary/[0.04] shadow-xs ring-1 ring-primary/20"
                                                        : "border-border/60 bg-card hover:border-primary/40 hover:bg-accent/30"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "flex size-10 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                                                        checked
                                                            ? "bg-primary text-primary-foreground shadow-xs"
                                                            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                                                    )}
                                                >
                                                    <IconComponent className="size-5" />
                                                </div>
                                                <div className="flex-1 min-w-0 pr-6">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={cn(
                                                            "font-semibold text-sm transition-colors",
                                                            checked ? "text-foreground font-bold" : "text-foreground/80 group-hover:text-foreground"
                                                        )}>
                                                            {serviceName}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                                        {meta?.description}
                                                    </p>
                                                </div>
                                                <div className="absolute top-4 right-4">
                                                    <div
                                                        className={cn(
                                                            "flex size-5 items-center justify-center rounded-full border transition-all duration-200",
                                                            checked
                                                                ? "border-primary bg-primary text-primary-foreground scale-100 shadow-xs"
                                                                : "border-muted-foreground/30 bg-background group-hover:border-primary/50"
                                                        )}
                                                    >
                                                        {checked && <IconCheck className="size-3.5 stroke-[3]" />}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Drag and Drop Service Cards */}
                        <div className="space-y-4">
                            {selectedServices.map((serviceName, index) => (
                                <DraggableServiceCard
                                    key={serviceName}
                                    serviceName={serviceName}
                                    index={index}
                                    isDraggable={false}
                                    setIsDraggable={() => {}}
                                />
                            ))}
                        </div>

                        {/* Exclusions & Terms Sections */}
                        <div className="space-y-6 pt-2">
                            <NotIncludedSection />
                            <ClientRequirementsSection />
                            <PaymentTermsSection />
                        </div>
                    </div>

                    {/* Sidebar Sticky Quotation Summary */}
                    <div className="sticky top-6 self-start space-y-6">
                        <QuotationSummary
                            handleSaveDraft={handleSaveDraft}
                            handleExportPDF={handleExportPDF}
                            isCreating={isCreating}
                            isUpdating={isUpdating}
                            isExporting={isExporting}
                            initialData={initialData}
                        />
                    </div>
                </div>
            </div>
        </QuotationContext.Provider>
    );
}

// --- Inner Components ---

function DraggableServiceCard({
    serviceName,
    index,
}: {
    serviceName: string;
    index: number;
    isDraggable: boolean;
    setIsDraggable: (val: boolean) => void;
}) {
    const { draggedServiceIndex, setDraggedServiceIndex, reorderServices } = useQuotation();
    const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);
    const [localIsDraggable, setLocalIsDraggable] = useState(false);

    const handleDragStart = (e: React.DragEvent) => {
        setDraggedServiceIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedServiceIndex === null || draggedServiceIndex === index) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeY = (e.clientY - rect.top) / rect.height;
        setDropPosition(relativeY < 0.5 ? "before" : "after");
    };

    const handleDragLeave = () => {
        setDropPosition(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedServiceIndex !== null && draggedServiceIndex !== index && dropPosition) {
            reorderServices(draggedServiceIndex, index, dropPosition);
        }
        setDraggedServiceIndex(null);
        setDropPosition(null);
    };

    const handleDragEnd = () => {
        setDraggedServiceIndex(null);
        setDropPosition(null);
    };

    let cardContent = null;
    if (serviceName.startsWith("Web Design & Development")) {
        cardContent = (
            <WebDevelopmentService
                serviceName={serviceName}
                onGripEnter={() => setLocalIsDraggable(true)}
                onGripLeave={() => setLocalIsDraggable(false)}
            />
        );
    } else if (serviceName.startsWith("Photo Editing")) {
        cardContent = (
            <PhotoEditingService
                serviceName={serviceName}
                onGripEnter={() => setLocalIsDraggable(true)}
                onGripLeave={() => setLocalIsDraggable(false)}
            />
        );
    } else if (serviceName.startsWith("Video Editing")) {
        cardContent = (
            <VideoEditingService
                serviceName={serviceName}
                onGripEnter={() => setLocalIsDraggable(true)}
                onGripLeave={() => setLocalIsDraggable(false)}
            />
        );
    } else if (serviceName.startsWith("Marketing")) {
        cardContent = (
            <MarketingService
                serviceName={serviceName}
                onGripEnter={() => setLocalIsDraggable(true)}
                onGripLeave={() => setLocalIsDraggable(false)}
            />
        );
    }

    return (
        <div
            draggable={localIsDraggable}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            className={`transition-all duration-200 ${draggedServiceIndex === index ? "opacity-30" : ""}`}
        >
            {dropPosition === "before" && (
                <div className="h-1.5 w-full bg-primary rounded-full my-2 animate-pulse" />
            )}
            {cardContent}
            {dropPosition === "after" && (
                <div className="h-1.5 w-full bg-primary rounded-full my-2 animate-pulse" />
            )}
        </div>
    );
}

function WebDevelopmentService({
    serviceName,
    onGripEnter,
    onGripLeave,
}: {
    serviceName: string;
    onGripEnter?: () => void;
    onGripLeave?: () => void;
}) {
    const {
        features,
        setFeatures,
        setSelectedServices,
        webDevPricing,
        addPricingItem,
        addFeature,
        selectedCurrency,
    } = useQuotation();
    const [isOpen, setIsOpen] = useState(true);

    const currencySymbol = getCurrencySymbol(selectedCurrency);
    const featuresFixedTotal = calculateFeatureTreeTotal(features);
    const subtotalFixed = featuresFixedTotal + webDevPricing
        .filter((i) => i.billingType === "fixed")
        .reduce((acc, i) => acc + i.price, 0);
    const subtotalMonthly = webDevPricing
        .filter((i) => i.billingType === "monthly")
        .reduce((acc, i) => acc + i.price, 0);

    const handleCopyWebDevAIStructure = () => {
        const promptStructure = `Please generate Web Design & Development features in the exact model structure below:

[
  {
    "name": "Feature or Module Name",
    "route": "/route-path",
    "price": "10000",
    "children": [
      {
        "name": "Sub-Feature Name",
        "route": "/route-path/sub-path",
        "price": "5000"
      }
    ]
  }
]

Requirements for AI:
1. Return valid JSON matching the Feature tree structure (name, route, price, children).
2. "name" (string): Human-readable name of the web module/feature.
3. "route" (string, optional): Next.js page route.
4. "price" (string, optional): Estimated cost for this feature.
5. "children" (array, optional): Nested sub-features or sub-modules.`;

        navigator.clipboard.writeText(promptStructure);
        toast.success("Web Dev AI model structure copied to clipboard!");
    };

    const handleDuplicateWebDev = () => {
        if (features.length === 0) {
            toast.error("No features to duplicate!");
            return;
        }
        const cloned = features.map(cloneFeatureWithNewIds);
        setFeatures((prev) => [...prev, ...cloned]);
        toast.success("Web Dev features duplicated!");
    };

    const handleRemoveWebDev = () => {
        setSelectedServices((current) => current.filter((item) => item !== "Web Design & Development"));
        toast.success("Web Design & Development service removed!");
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="cursor-grab"
                                onMouseEnter={onGripEnter}
                                onMouseLeave={onGripLeave}
                            >
                                <IconGripVertical />
                            </Button>
                            <div>
                                <CardTitle>{serviceName}</CardTitle>
                                <CardDescription className="mt-1">
                                    Define the web deliverables and project scoping.
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold mr-2">
                                {subtotalFixed > 0 &&
                                    `${currencySymbol}${subtotalFixed.toLocaleString("en-IN")}`}
                                {subtotalFixed > 0 && subtotalMonthly > 0 && " + "}
                                {subtotalMonthly > 0 &&
                                    `${currencySymbol}${subtotalMonthly.toLocaleString("en-IN")}/mo`}
                                {subtotalFixed === 0 && subtotalMonthly === 0 && `${currencySymbol}0`}
                            </span>

                            {/* Service Header Action Buttons: 1. Copy, 2. Duplicate, 3. Remove */}
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                title="Copy AI Model Structure"
                                onClick={handleCopyWebDevAIStructure}
                            >
                                <IconCopy className="size-3.5" />
                                <span>Copy</span>
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                title="Duplicate Service"
                                onClick={handleDuplicateWebDev}
                            >
                                <IconCopyCheck className="size-3.5" />
                                <span>Duplicate</span>
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-xs text-destructive border-destructive/20 hover:bg-destructive/10"
                                title="Remove Service"
                                onClick={handleRemoveWebDev}
                            >
                                <IconTrash className="size-3.5" />
                                <span>Remove</span>
                            </Button>

                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    {isOpen ? (
                                        <IconChevronDown className="h-4 w-4" />
                                    ) : (
                                        <IconChevronRight className="h-4 w-4" />
                                    )}
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                    </div>
                </CardHeader>
                {isOpen && <Separator />}

                <CollapsibleContent>
                    <CardContent className="space-y-4 p-6">
                        {/* Features scoped tree */}
                        <Card className="shadow-none">
                            <CardHeader>
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-base">Features &amp; Scope</CardTitle>
                                        <CardDescription>Scoping details with routes and base costs.</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <BulkPasteDialog service="web-dev" />
                                        <Button
                                            size="sm"
                                            onClick={() => addFeature("web-dev")}
                                        >
                                            <IconPlus className="size-4" />
                                            Add Feature
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <Separator />
                            <CardContent>
                                <div className="space-y-1">
                                    {features.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">No features added yet.</p>
                                    ) : (
                                        features.map((feature) => (
                                            <FeatureItem
                                                key={feature.id}
                                                feature={feature}
                                                service="web-dev"
                                            />
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Pricing */}
                        <Card className="shadow-none">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">Project Pricing</CardTitle>
                                        <CardDescription>Setup costs and licensing milestones.</CardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => addPricingItem("web-dev")}
                                    >
                                        <IconPlus className="size-4 mr-1.5" />
                                        Add Pricing Item
                                    </Button>
                                </div>
                            </CardHeader>
                            <Separator />
                            <CardContent className="space-y-3">
                                {webDevPricing.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">No pricing items added yet.</p>
                                ) : (
                                    webDevPricing.map((item, pricingIdx) => (
                                        <PricingRow
                                            key={item.id}
                                            item={item}
                                            service="web-dev"
                                            index={pricingIdx}
                                        />
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

function PhotoEditingService({
    serviceName,
    onGripEnter,
    onGripLeave,
}: {
    serviceName: string;
    onGripEnter?: () => void;
    onGripLeave?: () => void;
}) {
    const {
        photoEditingQty,
        setPhotoEditingQty,
        photoEditingRate,
        setPhotoEditingRate,
        selectedCurrency,
        setSelectedServices,
    } = useQuotation();
    const [isOpen, setIsOpen] = useState(true);

    const currencySymbol = getCurrencySymbol(selectedCurrency);
    const total = photoEditingQty * photoEditingRate;

    const handleRemovePhotoEditing = () => {
        setSelectedServices((current) => current.filter((item) => item !== "Photo Editing"));
        toast.success("Photo Editing service removed!");
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="cursor-grab"
                                onMouseEnter={onGripEnter}
                                onMouseLeave={onGripLeave}
                            >
                                <IconGripVertical />
                            </Button>
                            <div>
                                <CardTitle>{serviceName}</CardTitle>
                                <CardDescription className="mt-1">
                                    {photoEditingQty} image{photoEditingQty !== 1 ? "s" : ""} · Quantity based pricing ({currencySymbol}
                                    {photoEditingRate}/image)
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold mr-2">
                                {currencySymbol}
                                {total.toLocaleString("en-IN")}
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={handleRemovePhotoEditing}
                                title="Remove Service"
                            >
                                <IconTrash className="size-3.5" />
                                Remove
                            </Button>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    {isOpen ? (
                                        <IconChevronDown className="h-4 w-4" />
                                    ) : (
                                        <IconChevronRight className="h-4 w-4" />
                                    )}
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                    </div>
                </CardHeader>
                {isOpen && <Separator />}
                <CollapsibleContent>
                    <CardContent className="p-6 grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="photo-qty">Number of Images</Label>
                            <Input
                                id="photo-qty"
                                type="number"
                                placeholder="0"
                                value={photoEditingQty === 0 ? "" : photoEditingQty}
                                onChange={(e) => setPhotoEditingQty(e.target.value === "" ? 0 : Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="photo-rate">Rate per Image ({currencySymbol})</Label>
                            <Input
                                id="photo-rate"
                                type="number"
                                placeholder="0"
                                value={photoEditingRate === 0 ? "" : photoEditingRate}
                                onChange={(e) => setPhotoEditingRate(e.target.value === "" ? 0 : Number(e.target.value))}
                            />
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

function VideoEditingService({
    serviceName,
    onGripEnter,
    onGripLeave,
}: {
    serviceName: string;
    onGripEnter?: () => void;
    onGripLeave?: () => void;
}) {
    const {
        videoEditingQty,
        setVideoEditingQty,
        videoEditingRate,
        setVideoEditingRate,
        videoEditingUnit,
        setVideoEditingUnit,
        selectedCurrency,
        setSelectedServices,
    } = useQuotation();
    const [isOpen, setIsOpen] = useState(true);

    const currencySymbol = getCurrencySymbol(selectedCurrency);
    const total = videoEditingQty * videoEditingRate;

    const quantityLabel =
        videoEditingUnit === "video"
            ? "Number of Videos"
            : videoEditingUnit === "second"
            ? "Duration (in Seconds)"
            : "Quantity (10-sec blocks)";

    const unitSingular =
        videoEditingUnit === "video"
            ? "video"
            : videoEditingUnit === "second"
            ? "sec"
            : "10s";

    const headerSummary =
        videoEditingQty === 0
            ? "Custom duration or unit-based video pricing"
            : videoEditingUnit === "video"
            ? `${videoEditingQty} Video${videoEditingQty !== 1 ? "s" : ""} · ${currencySymbol}${videoEditingRate.toLocaleString("en-IN")}/video`
            : videoEditingUnit === "second"
            ? `${videoEditingQty} Second${videoEditingQty !== 1 ? "s" : ""} · ${currencySymbol}${videoEditingRate.toLocaleString("en-IN")}/sec`
            : `${videoEditingQty} × 10-sec block${videoEditingQty !== 1 ? "s" : ""} · ${currencySymbol}${videoEditingRate.toLocaleString("en-IN")}/10s`;

    const handleRemoveVideoEditing = () => {
        setSelectedServices((current) => current.filter((item) => item !== "Video Editing"));
        toast.success("Video Editing service removed!");
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="cursor-grab"
                                onMouseEnter={onGripEnter}
                                onMouseLeave={onGripLeave}
                            >
                                <IconGripVertical />
                            </Button>
                            <div>
                                <CardTitle>{serviceName}</CardTitle>
                                <CardDescription className="mt-1">
                                    {headerSummary}
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold mr-2">
                                {currencySymbol}
                                {total.toLocaleString("en-IN")}
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={handleRemoveVideoEditing}
                                title="Remove Service"
                            >
                                <IconTrash className="size-3.5" />
                                Remove
                            </Button>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    {isOpen ? (
                                        <IconChevronDown className="h-4 w-4" />
                                    ) : (
                                        <IconChevronRight className="h-4 w-4" />
                                    )}
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                    </div>
                </CardHeader>
                {isOpen && <Separator />}
                <CollapsibleContent>
                    <CardContent className="p-6 grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                            <Label>Pricing Unit</Label>
                            <ShadcnSelect
                                value={videoEditingUnit}
                                onValueChange={(val) =>
                                    setVideoEditingUnit(
                                        val as "video" | "second" | "10-seconds"
                                    )
                                }
                            >
                                <SelectTrigger className="w-full h-10 bg-background border-input font-medium">
                                    <SelectValue placeholder="Select Unit" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="video">Per Video</SelectItem>
                                    <SelectItem value="second">Per Second</SelectItem>
                                    <SelectItem value="10-seconds">Per 10 Seconds</SelectItem>
                                </SelectContent>
                            </ShadcnSelect>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="video-qty">{quantityLabel}</Label>
                            <Input
                                id="video-qty"
                                type="number"
                                placeholder="0"
                                value={videoEditingQty === 0 ? "" : videoEditingQty}
                                onChange={(e) => setVideoEditingQty(e.target.value === "" ? 0 : Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="video-rate">Rate ({currencySymbol})</Label>
                            <Input
                                id="video-rate"
                                type="number"
                                placeholder="0"
                                value={videoEditingRate === 0 ? "" : videoEditingRate}
                                onChange={(e) => setVideoEditingRate(e.target.value === "" ? 0 : Number(e.target.value))}
                            />
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

function MarketingService({
    serviceName,
    onGripEnter,
    onGripLeave,
}: {
    serviceName: string;
    onGripEnter?: () => void;
    onGripLeave?: () => void;
}) {
    const {
        marketingFeatures,
        setMarketingFeatures,
        marketingPricing,
        addPricingItem,
        addFeature,
        marketingAdBudget,
        setMarketingAdBudget,
        selectedCurrency,
        setSelectedServices,
    } = useQuotation();
    const [isOpen, setIsOpen] = useState(true);

    const currencySymbol = getCurrencySymbol(selectedCurrency);

    const marketingFeaturesTotal = calculateFeatureTreeTotal(marketingFeatures);

    const subtotalFixed =
        marketingFeaturesTotal +
        marketingPricing
            .filter((i) => i.billingType === "fixed")
            .reduce((acc, i) => acc + i.price, 0);
    const subtotalMonthly = marketingPricing
        .filter((i) => i.billingType === "monthly")
        .reduce((acc, i) => acc + i.price, 0);

    const handleCopyMarketingStructure = () => {
        const promptStructure = `Provide marketing campaign scope data in JSON array format:
[
  {
    "name": "Social Media Marketing",
    "route": "/campaigns/social-media",
    "price": "15000",
    "children": [
      {
        "name": "Facebook & Instagram Ads",
        "route": "/campaigns/social-media/fb-ig",
        "price": "8000"
      }
    ]
  }
]

Requirements for AI:
1. Return valid JSON matching the Campaign Scope tree structure (name, route, price, children).
2. "name" (string): Human-readable name of the marketing scope item.
3. "route" (string, optional): Relevant URL or route path.
4. "price" (string, optional): Estimated cost for this scope item.
5. "children" (array, optional): Nested sub-deliverables or campaign tasks.`;

        navigator.clipboard.writeText(promptStructure);
        toast.success("Marketing AI model structure copied to clipboard!");
    };

    const handleDuplicateMarketing = () => {
        if (marketingFeatures.length === 0) {
            toast.error("No marketing campaign items to duplicate!");
            return;
        }
        const cloned = marketingFeatures.map(cloneFeatureWithNewIds);
        setMarketingFeatures((prev) => [...prev, ...cloned]);
        toast.success("Marketing campaign items duplicated!");
    };

    const handleRemoveMarketing = () => {
        setSelectedServices((current) => current.filter((item) => item !== "Marketing & Growth"));
        toast.success("Marketing & Growth service removed!");
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="cursor-grab"
                                onMouseEnter={onGripEnter}
                                onMouseLeave={onGripLeave}
                            >
                                <IconGripVertical />
                            </Button>

                            <div>
                                <CardTitle>{serviceName}</CardTitle>
                                <CardDescription className="mt-1">
                                    Digital marketing campaigns, SEO, and ad management.
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold mr-2">
                                {subtotalFixed > 0 &&
                                    `${currencySymbol}${subtotalFixed.toLocaleString("en-IN")}`}
                                {subtotalFixed > 0 &&
                                    subtotalMonthly > 0 &&
                                    " + "}
                                {subtotalMonthly > 0 &&
                                    `${currencySymbol}${subtotalMonthly.toLocaleString("en-IN")}/mo`}
                                {subtotalFixed === 0 &&
                                    subtotalMonthly === 0 &&
                                    `${currencySymbol}0`}
                            </span>

                            {/* Service Header Action Buttons: 1. Copy, 2. Duplicate, 3. Remove */}
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                onClick={handleCopyMarketingStructure}
                                title="Copy AI Prompt Structure"
                            >
                                <IconCopy className="size-3.5" />
                                Copy
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                onClick={handleDuplicateMarketing}
                                title="Duplicate Features"
                            >
                                <IconCopy className="size-3.5" />
                                Duplicate
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={handleRemoveMarketing}
                                title="Remove Service"
                            >
                                <IconTrash className="size-3.5" />
                                Remove
                            </Button>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    {isOpen ? (
                                        <IconChevronDown className="h-4 w-4" />
                                    ) : (
                                        <IconChevronRight className="h-4 w-4" />
                                    )}
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                    </div>
                </CardHeader>
                {isOpen && <Separator />}

                <CollapsibleContent>
                    <CardContent className="space-y-4 p-6">
                        {/* Feature Tree */}
                        <Card className="shadow-none">
                            <CardHeader>
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-base">
                                            Campaign Scope &amp; Deliverables
                                        </CardTitle>
                                        <CardDescription>
                                            Define the complete marketing campaign feature hierarchy.
                                        </CardDescription>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <BulkPasteDialog service="marketing" />
                                        <Button
                                            size="sm"
                                            onClick={() => addFeature("marketing")}
                                        >
                                            <IconPlus className="size-4" />
                                            Add Campaign Item
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <Separator />
                            <CardContent>
                                <div className="space-y-1">
                                    {marketingFeatures.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            No campaign features added yet.
                                        </p>
                                    ) : (
                                        marketingFeatures.map((feature) => (
                                            <FeatureItem
                                                key={feature.id}
                                                feature={feature}
                                                service="marketing"
                                            />
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Pricing */}
                        <Card className="shadow-none">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">
                                            Project &amp; Retainer Pricing
                                        </CardTitle>
                                        <CardDescription>
                                            Fixed or recurring marketing setup fees.
                                        </CardDescription>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            addPricingItem("marketing")
                                        }
                                    >
                                        <IconPlus className="size-4 mr-1" />
                                        Add Pricing Item
                                    </Button>
                                </div>
                            </CardHeader>
                            <Separator />
                            <CardContent className="space-y-3">
                                {marketingPricing.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No pricing items added yet.
                                    </p>
                                ) : (
                                    marketingPricing.map((item, pricingIdx) => (
                                        <PricingRow
                                            key={item.id}
                                            item={item}
                                            service="marketing"
                                            index={pricingIdx}
                                        />
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* Ad Budget Card */}
                        <Card className="shadow-none">
                            <CardContent className="p-6 grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>
                                        Monthly Advertising Budget ({currencySymbol})
                                    </Label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={marketingAdBudget === 0 ? "" : marketingAdBudget}
                                        onChange={(e) =>
                                            setMarketingAdBudget(
                                                e.target.value === "" ? 0 : Number(e.target.value),
                                            )
                                        }
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

// Collapsible helper
import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "@/components/ui/collapsible";

function FeatureItem({
    feature,
    level = 0,
    service = "web-dev",
}: {
    feature: Feature;
    level?: number;
    service?: "web-dev" | "marketing";
}) {
    const {
        features,
        marketingFeatures,
        addFeature,
        updateFeature,
        deleteFeature,
        duplicateFeature,
        indentFeature,
        outdentFeature,
        makeMainFeature,
        moveFeatureUp,
        moveFeatureDown,
        draggedId,
        setDraggedId,
        moveFeatureDnd,
        selectedCurrency,
    } = useQuotation();

    const featuresList = service === "marketing" ? marketingFeatures : features;
    const currencySymbol = getCurrencySymbol(selectedCurrency);

    const [open, setOpen] = useState(true);
    const [isEditing, setIsEditing] = useState(feature.name === "New Feature" || !feature.name);
    const [editName, setEditName] = useState(feature.name);
    const [editRoute, setEditRoute] = useState(feature.route || "");
    const [editPrice, setEditPrice] = useState(feature.price || "");

    const [dropPosition, setDropPosition] = useState<
        "before" | "after" | "inside" | null
    >(null);

    const hasChildren = feature.children && feature.children.length > 0;

    const handleSave = () => {
        updateFeature(service, feature.id, {
            name: editName,
            route: editRoute,
            price: editPrice,
        });
        setIsEditing(false);
    };

    const handleDragStart = (e: React.DragEvent) => {
        e.stopPropagation();
        setDraggedId(feature.id);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedId === null || draggedId === feature.id) return;
        if (isDescendant(featuresList, draggedId, feature.id)) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const relativeY = (e.clientY - rect.top) / rect.height;

        if (relativeY < 0.25) {
            setDropPosition("before");
        } else if (relativeY > 0.75) {
            setDropPosition("after");
        } else {
            setDropPosition("inside");
        }
    };

    const handleDragLeave = () => {
        setDropPosition(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedId !== null && draggedId !== feature.id && dropPosition) {
            moveFeatureDnd(service, draggedId, feature.id, dropPosition);
        }
        setDraggedId(null);
        setDropPosition(null);
    };

    const handleDragEnd = () => {
        setDraggedId(null);
        setDropPosition(null);
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            className={`group rounded-md transition-colors duration-150 ${draggedId === feature.id ? "opacity-40" : ""} ${dropPosition === "inside" ? "bg-primary/10 border border-primary/20" : ""}`}
        >
            {dropPosition === "before" && (
                <div className="h-0.5 w-full bg-primary rounded my-0.5 animate-pulse ml-2" />
            )}

            <div
                className="flex min-h-10 items-center gap-2 rounded-md px-2 hover:bg-muted/50"
                style={{
                    marginLeft: `${Math.min(level, 5) * 24}px`,
                }}
            >
                {isEditing ? (
                    <div
                        className="flex flex-col gap-3 p-3 border rounded-lg bg-muted/20 w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={cn("grid gap-2", service === "marketing" ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Feature Name <span className="text-destructive">*</span></Label>
                                <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="h-8 text-sm font-medium w-full bg-background"
                                    placeholder="Feature name"
                                    autoFocus
                                />
                            </div>
                            {service !== "marketing" && (
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold">
                                        Route <span className="text-muted-foreground font-normal text-[11px] ml-1">(Optional)</span>
                                    </Label>
                                    <Input
                                        value={editRoute}
                                        onChange={(e) => setEditRoute(e.target.value)}
                                        className="h-8 text-xs w-full bg-background"
                                        placeholder="/route"
                                    />
                                </div>
                            )}
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">
                                    Price ({currencySymbol}) <span className="text-muted-foreground font-normal text-[11px] ml-1">(Optional)</span>
                                </Label>
                                <Input
                                    value={editPrice === "0" ? "" : editPrice}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setEditPrice(val.length > 1 && val.startsWith("0") ? val.replace(/^0+/, "") : val);
                                    }}
                                    className="h-8 text-xs w-full bg-background"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button size="sm" className="h-8" onClick={handleSave}>Save</Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8"
                                onClick={() => {
                                    if (feature.name === "New Feature" && editName === "New Feature") {
                                        deleteFeature(service, feature.id);
                                    } else {
                                        setIsEditing(false);
                                    }
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <IconGripVertical className="size-4 shrink-0 text-muted-foreground cursor-grab" />
                        {hasChildren ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setOpen(!open);
                                }}
                            >
                                {open ? <IconChevronDown className="size-4" /> : <IconChevronRight className="size-4" />}
                            </Button>
                        ) : (
                            <div className="w-7" />
                        )}

                        {hasChildren ? (
                            <IconFolder className="size-4 shrink-0 text-amber-500" />
                        ) : (
                            <IconFile className="size-4 shrink-0 text-slate-400" />
                        )}

                        <div className="flex min-w-0 flex-1 flex-col py-1 justify-center pr-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-foreground leading-snug">
                                    {feature.name}
                                </span>
                                {feature.price && Number(feature.price) > 0 && (
                                    <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full shrink-0 border border-primary/20 whitespace-nowrap">
                                        {currencySymbol}
                                        {isNaN(Number(feature.price)) ? feature.price : Number(feature.price).toLocaleString("en-IN")}
                                    </span>
                                )}
                            </div>
                            {feature.route && service !== "marketing" && (
                                <span
                                    className="text-[11px] font-mono text-muted-foreground/80 truncate max-w-full block mt-1 bg-muted/40 px-2 py-0.5 rounded border border-border/40 w-fit"
                                    title={feature.route}
                                >
                                    {feature.route}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
                            {hasChildren && !open && (
                                <Badge variant="secondary">{feature.children?.length}</Badge>
                            )}

                            <div className="flex items-center gap-0.5">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                title="Add Subfeature"
                                onClick={() => addFeature(service, feature.id)}
                            >
                                <IconPlus className="size-4 text-primary" />
                            </Button>
                            <BulkPasteDialog
                                service={service}
                                parentId={feature.id}
                                buttonText="Bulk Paste Subfeatures"
                                buttonSize="icon"
                                buttonVariant="ghost"
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                title="Edit"
                                onClick={() => {
                                    setEditName(feature.name);
                                    setEditRoute(feature.route || "");
                                    setEditPrice(feature.price || "");
                                    setIsEditing(true);
                                }}
                            >
                                <IconPencil className="size-4" />
                            </Button>

                            {level > 0 && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-8"
                                    title="Outdent"
                                    onClick={() => outdentFeature(service, feature.id)}
                                >
                                    <IconIndentDecrease className="size-4" />
                                </Button>
                            )}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                title="Indent"
                                onClick={() => indentFeature(service, feature.id)}
                            >
                                <IconIndentIncrease className="size-4" />
                            </Button>

                            {level > 0 && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-8"
                                    title="Make Main"
                                    onClick={() => makeMainFeature(service, feature.id)}
                                >
                                    <IconStar className="size-4 text-amber-500" />
                                </Button>
                            )}

                            <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                title="Move Up"
                                onClick={() => moveFeatureUp(service, feature.id)}
                            >
                                <IconArrowUp className="size-4" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                title="Move Down"
                                onClick={() => moveFeatureDown(service, feature.id)}
                            >
                                <IconArrowDown className="size-4" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 hover:bg-destructive/10 hover:text-destructive"
                                title="Delete"
                                onClick={() => deleteFeature(service, feature.id)}
                            >
                                <IconTrash className="size-4" />
                            </Button>
                        </div>
                        </div>
                    </>
                )}
            </div>

            {dropPosition === "after" && (
                <div className="h-0.5 w-full bg-primary rounded my-0.5 animate-pulse ml-2" />
            )}

            {hasChildren && open && (
                <div className="relative">
                    {feature.children?.map((child) => (
                        <FeatureItem
                            key={child.id}
                            feature={child}
                            level={level + 1}
                            service={service}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function PricingRow({
    item,
    service,
    index,
}: {
    item: PricingItem;
    service: "web-dev" | "video-editing" | "marketing";
    index: number;
}) {
    const {
        updatePricingItem,
        deletePricingItem,
        draggedPricingIndex,
        setDraggedPricingIndex,
        reorderPricingItems,
        selectedCurrency,
    } = useQuotation();

    const [isEditing, setIsEditing] = useState(!item.name || item.name === "New Pricing Item" || item.price === 0);
    const [editName, setEditName] = useState(item.name);
    const [editDesc, setEditDesc] = useState(item.description);
    const [editPrice, setEditPrice] = useState(item.price);
    const [editBilling, setEditBilling] = useState<"fixed" | "monthly" | "yearly">(item.billingType || "fixed");

    const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);

    const currencySymbol = getCurrencySymbol(selectedCurrency);

    const handleSave = () => {
        updatePricingItem(service, item.id, {
            name: editName,
            description: editDesc,
            price: Number(editPrice) || 0,
            billingType: editBilling,
        });
        setIsEditing(false);
    };

    const handleDragStart = (e: React.DragEvent) => {
        setDraggedPricingIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedPricingIndex === null || draggedPricingIndex === index) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeY = (e.clientY - rect.top) / rect.height;
        setDropPosition(relativeY < 0.5 ? "before" : "after");
    };

    const handleDragLeave = () => {
        setDropPosition(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedPricingIndex !== null && draggedPricingIndex !== index && dropPosition) {
            reorderPricingItems(service, draggedPricingIndex, index, dropPosition);
        }
        setDraggedPricingIndex(null);
        setDropPosition(null);
    };

    return (
        <div
            draggable={!isEditing}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`group rounded-lg border transition-colors ${draggedPricingIndex === index ? "opacity-30" : ""} ${isEditing ? "bg-muted/10" : "bg-card hover:bg-muted/10"}`}
        >
            {dropPosition === "before" && (
                <div className="h-1 w-full bg-primary rounded my-1 animate-pulse" />
            )}

            {isEditing ? (
                <div className="p-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Item Name <span className="text-destructive">*</span></Label>
                            <Input
                                placeholder="Enter item name..."
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-9"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Billing Type <span className="text-destructive">*</span></Label>
                            <ShadcnSelect
                                value={editBilling}
                                onValueChange={(val) => setEditBilling(val as "fixed" | "monthly" | "yearly")}
                            >
                                <SelectTrigger className="h-9 w-full bg-background border-input font-medium text-xs">
                                    <SelectValue placeholder="Select billing type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fixed">Fixed / One-Time</SelectItem>
                                    <SelectItem value="monthly">Monthly Retainer</SelectItem>
                                    <SelectItem value="yearly">Yearly Retainer</SelectItem>
                                </SelectContent>
                            </ShadcnSelect>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Price ({currencySymbol}) <span className="text-destructive">*</span></Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={editPrice === 0 ? "" : editPrice}
                                onChange={(e) => setEditPrice(e.target.value === "" ? 0 : Number(e.target.value))}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1 sm:col-span-2 md:col-span-4">
                            <Label className="text-xs font-semibold">
                                Description <span className="text-muted-foreground font-normal text-[11px] ml-1">(Optional)</span>
                            </Label>
                            <Input
                                placeholder="Enter description..."
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                className="h-9"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={handleSave}>Save</Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                if (!item.name && !editName) {
                                    deletePricingItem(service, item.id);
                                } else {
                                    setIsEditing(false);
                                }
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3 p-4">
                    <IconGripVertical className="size-4 shrink-0 text-muted-foreground cursor-grab" />
                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold">{item.name}</h4>
                        {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        )}
                    </div>

                    <Badge variant={item.billingType === "monthly" || item.billingType === "yearly" ? "secondary" : "outline"}>
                        {item.billingType === "monthly"
                            ? "Monthly"
                            : item.billingType === "yearly"
                            ? "Yearly"
                            : "One-Time"}
                    </Badge>
                    <span className="text-sm font-medium">
                        {currencySymbol}
                        {item.price.toLocaleString("en-IN")}
                    </span>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            title="Edit Item"
                            onClick={() => setIsEditing(true)}
                        >
                            <IconPencil className="size-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Delete Item"
                            onClick={() => deletePricingItem(service, item.id)}
                        >
                            <IconTrash className="size-4" />
                        </Button>
                    </div>
                </div>
            )}

            {dropPosition === "after" && (
                <div className="h-1 w-full bg-primary rounded my-1 animate-pulse" />
            )}
        </div>
    );
}

function BulkPasteDialog({
    service = "web-dev",
    parentId,
    buttonText = "Bulk Paste",
    buttonVariant = "outline",
    buttonSize = "sm",
}: {
    service?: "web-dev" | "marketing";
    parentId?: number;
    buttonText?: string;
    buttonVariant?: "outline" | "ghost" | "default" | "secondary";
    buttonSize?: "sm" | "icon" | "default";
}) {
    const { bulkPasteFeatures } = useQuotation();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");

    const handleImport = () => {
        if (!text.trim()) {
            toast.error("Please paste JSON or text features first!");
            return;
        }
        bulkPasteFeatures(service, text, parentId);
        setText("");
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {buttonSize === "icon" ? (
                    <Button variant={buttonVariant} size="icon" className="size-8" title={buttonText}>
                        <IconCopy className="size-4 text-primary" />
                    </Button>
                ) : (
                    <Button variant={buttonVariant} size={buttonSize}>
                        <IconCopy className="size-4 mr-1.5" />
                        {buttonText}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>
                        {parentId ? "Bulk Paste Subfeatures (JSON or Text)" : "Bulk Paste Features (JSON or Text)"}
                    </DialogTitle>
                    <DialogDescription>
                        Paste JSON generated by AI or indented text lines. Both JSON tree arrays and indented lists will be automatically parsed with full routes and pricing. Duplicate entries will be automatically filtered.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <textarea
                        className="w-full h-72 p-3 font-mono text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
                        placeholder={`Paste JSON array here, e.g.:\n[\n  {\n    "name": "UI/UX Design",\n    "route": "/services/ui-ux",\n    "price": "15000",\n    "children": [\n      { "name": "Homepage Design", "price": "5000" }\n    ]\n  }\n]\n\nOR plain text:\nHomepage\n  Hero Section\n  Features Grid`}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <Button onClick={handleImport}>Import Features</Button>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function SummaryRow({
    label,
    value,
    sub = false,
}: {
    label: string;
    value: React.ReactNode;
    sub?: boolean;
}) {
    return (
        <div className={`flex items-start justify-between gap-4 ${sub ? "pl-4 text-xs text-muted-foreground" : "text-sm font-medium"}`}>
            <span>{label}</span>
            <span className="text-right shrink-0">{value}</span>
        </div>
    );
}

function QuotationSummary({
    handleSaveDraft,
    handleExportPDF,
    isCreating,
    isUpdating,
    isExporting,
    initialData,
}: {
    handleSaveDraft: () => void;
    handleExportPDF: () => void;
    isCreating: boolean;
    isUpdating: boolean;
    isExporting: boolean;
    initialData?: any;
}) {
    const {
        features,
        marketingFeatures,
        selectedServices,
        webDevPricing,
        photoEditingQty,
        photoEditingRate,
        videoEditingQty,
        videoEditingRate,
        marketingPricing,
        marketingAdBudget,
        selectedCurrency,
        discountPercentage,
        setDiscountPercentage,
        taxPercentage,
        setTaxPercentage,
    } = useQuotation();

    const currencySymbol = getCurrencySymbol(selectedCurrency);

    const showWebDev = selectedServices.includes("Web Design & Development");
    const showPhoto = selectedServices.includes("Photo Editing");
    const showVideo = selectedServices.includes("Video Editing");
    const showMarketing = selectedServices.includes("Marketing");

    const webDevFeaturesTotal = showWebDev ? calculateFeatureTreeTotal(features) : 0;
    const marketingFeaturesTotal = showMarketing ? calculateFeatureTreeTotal(marketingFeatures) : 0;

    const webDevFixed = showWebDev
        ? webDevFeaturesTotal + webDevPricing
              .filter((i) => i.billingType === "fixed")
              .reduce((acc, i) => acc + i.price, 0)
        : 0;
    const webDevMonthly = showWebDev
        ? webDevPricing
              .filter((i) => i.billingType === "monthly")
              .reduce((acc, i) => acc + i.price, 0)
        : 0;

    const photoTotal = showPhoto ? photoEditingQty * photoEditingRate : 0;

    const videoFixed = showVideo ? videoEditingQty * videoEditingRate : 0;
    const videoMonthly = 0;

    const marketingFixed = showMarketing
        ? marketingFeaturesTotal + marketingPricing
              .filter((i) => i.billingType === "fixed")
              .reduce((acc, i) => acc + i.price, 0)
        : 0;
    const marketingMonthly = showMarketing
        ? marketingPricing
              .filter((i) => i.billingType === "monthly")
              .reduce((acc, i) => acc + i.price, 0)
        : 0;

    const totalOneTime = webDevFixed + photoTotal + videoFixed + marketingFixed;
    const totalRecurring = webDevMonthly + videoMonthly + marketingMonthly;

    const discountAmount = (totalOneTime * (discountPercentage || 0)) / 100;
    const subtotalAfterDiscount = totalOneTime - discountAmount;
    const taxAmount = (subtotalAfterDiscount * (taxPercentage || 0)) / 100;
    const grandTotalOneTime = subtotalAfterDiscount + taxAmount;

    return (
        <Card className="shadow-md border border-border/80">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold">Quotation Summary</CardTitle>
                    <Badge variant="secondary" className="font-semibold">{selectedCurrency}</Badge>
                </div>
                <CardDescription className="text-xs">Overview of quotation costs.</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-4 p-5 font-sans">
                <div className="space-y-2.5">
                    {showWebDev && (webDevFixed > 0 || webDevMonthly > 0) && (
                        <SummaryRow
                            label="Web Development"
                            value={
                                <>
                                    {webDevFixed > 0 && `${currencySymbol}${webDevFixed.toLocaleString("en-IN")}`}
                                    {webDevFixed > 0 && webDevMonthly > 0 && " + "}
                                    {webDevMonthly > 0 && `${currencySymbol}${webDevMonthly.toLocaleString("en-IN")}/mo`}
                                </>
                            }
                        />
                    )}
                    {showPhoto && photoTotal > 0 && (
                        <SummaryRow
                            label="Photo Editing"
                            value={`${currencySymbol}${photoTotal.toLocaleString("en-IN")}`}
                        />
                    )}
                    {showVideo && videoFixed > 0 && (
                        <SummaryRow
                            label="Video Editing"
                            value={`${currencySymbol}${videoFixed.toLocaleString("en-IN")}`}
                        />
                    )}
                    {showMarketing && (marketingFixed > 0 || marketingMonthly > 0) && (
                        <SummaryRow
                            label="Marketing"
                            value={
                                <>
                                    {marketingFixed > 0 && `${currencySymbol}${marketingFixed.toLocaleString("en-IN")}`}
                                    {marketingFixed > 0 && marketingMonthly > 0 && " + "}
                                    {marketingMonthly > 0 && `${currencySymbol}${marketingMonthly.toLocaleString("en-IN")}/mo`}
                                </>
                            }
                        />
                    )}
                </div>

                <Separator />

                <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-sm font-semibold">
                        <span>Total Setup / One-time</span>
                        <span className="text-[#4E12D4] font-bold font-mono">
                            {currencySymbol}
                            {totalOneTime.toLocaleString("en-IN")}
                        </span>
                    </div>

                    {totalRecurring > 0 && (
                        <div className="flex justify-between items-center text-sm font-semibold">
                            <span>Total Recurring / Mo</span>
                            <span className="text-purple-600 font-bold font-mono">
                                {currencySymbol}
                                {totalRecurring.toLocaleString("en-IN")}
                                /mo
                            </span>
                        </div>
                    )}

                    {/* Discount & VAT / Tax Input Controls */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashed">
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-semibold flex items-center justify-between">
                                <span>Discount (%)</span>
                                {discountPercentage > 0 && (
                                    <span className="text-[10px] font-bold text-rose-500 font-mono">
                                        -{currencySymbol}{discountAmount.toLocaleString("en-IN")}
                                    </span>
                                )}
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={discountPercentage === 0 ? "" : discountPercentage}
                                onChange={(e) => {
                                    const val = Number(e.target.value) || 0;
                                    setDiscountPercentage(Math.min(100, Math.max(0, val)));
                                }}
                                placeholder="0%"
                                className="h-8 text-xs bg-background font-mono font-bold"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-semibold flex items-center justify-between">
                                <span>VAT / Tax (%)</span>
                                {taxPercentage > 0 && (
                                    <span className="text-[10px] font-bold text-indigo-500 font-mono">
                                        +{currencySymbol}{taxAmount.toLocaleString("en-IN")}
                                    </span>
                                )}
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={taxPercentage === 0 ? "" : taxPercentage}
                                onChange={(e) => {
                                    const val = Number(e.target.value) || 0;
                                    setTaxPercentage(Math.min(100, Math.max(0, val)));
                                }}
                                placeholder="0%"
                                className="h-8 text-xs bg-background font-mono font-bold"
                            />
                        </div>
                    </div>

                    {(discountPercentage > 0 || taxPercentage > 0) && (
                        <div className="flex justify-between items-center text-sm font-extrabold border-t pt-2 mt-1">
                            <span>Grand Total (Initial)</span>
                            <span className="text-primary font-mono text-base font-bold">
                                {currencySymbol}
                                {grandTotalOneTime.toLocaleString("en-IN")}
                            </span>
                        </div>
                    )}

                    {showMarketing && marketingAdBudget > 0 && (
                        <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground border-t border-dashed pt-2 mt-2">
                            <span>Marketing Ad Budget (Ad Spend)</span>
                            <span className="font-mono">
                                {currencySymbol}
                                {marketingAdBudget}
                                /mo
                            </span>
                        </div>
                    )}
                </div>

                <Separator />

                {/* Action Buttons inside Sticky Pricing Card */}
                <div className="flex flex-col gap-2.5 pt-1">
                    <Button
                        size="lg"
                        className="w-full font-bold h-11"
                        onClick={handleSaveDraft}
                        disabled={isCreating || isUpdating}
                    >
                        <IconDeviceFloppy className="h-5 w-5" />
                        {isCreating || isUpdating
                            ? "Saving..."
                            : initialData?._id
                            ? "Update Quotation"
                            : "Save Draft"}
                    </Button>
                    {initialData?._id && (
                        <Button
                            size="lg"
                            className="w-full font-bold h-11 bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                            onClick={handleExportPDF}
                            disabled={isExporting}
                            title="Export to PDF"
                        >
                            <IconDownload className="h-5 w-5" />
                            {isExporting ? "Exporting..." : "Export PDF"}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function NotIncludedSection() {
    const { notIncludedItems, setNotIncludedItems } = useQuotation();
    const [isAdding, setIsAdding] = useState(false);
    const [newItemText, setNewItemText] = useState("");
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkText, setBulkText] = useState("");

    const handleAddItem = () => {
        if (!newItemText.trim()) return;
        setNotIncludedItems((prev) => [...prev, newItemText.trim()]);
        setNewItemText("");
        setIsAdding(false);
    };

    const handleBulkImport = () => {
        if (!bulkText.trim()) return;
        const lines = bulkText
            .split("\n")
            .map((l) => l.trim().replace(/^[-*•◦▪+]\s*/, ""))
            .filter(Boolean);
        if (lines.length > 0) {
            setNotIncludedItems((prev) => [...prev, ...lines]);
            toast.success(`Imported ${lines.length} items!`);
        }
        setBulkText("");
        setIsBulkOpen(false);
    };

    const handleDeleteItem = (index: number) => {
        setNotIncludedItems((prev) => prev.filter((_, i) => i !== index));
    };

    return (
        <Card className="border shadow-xs">
            <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold">✕</span>
                            Not Included in Price
                        </CardTitle>
                        <CardDescription className="text-xs">
                            List services, licensing fees, or third-party costs excluded from this quotation.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-medium">
                                    <IconCopy className="size-3.5" />
                                    Bulk Paste
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Bulk Paste Exclusions</DialogTitle>
                                    <DialogDescription className="text-xs">
                                        Paste multiple items (one per line). Bullets and hyphens will be cleaned automatically.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-3 pt-2">
                                    <Textarea
                                        placeholder="Domain Registration & Premium Web Hosting&#10;Paid Ad Spend for Facebook / Google&#10;Third-party Paid API Licenses"
                                        value={bulkText}
                                        onChange={(e) => setBulkText(e.target.value)}
                                        rows={6}
                                        className="font-mono text-xs"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
                                        <Button size="sm" onClick={handleBulkImport}>Import Items</Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                        <Button
                            size="sm"
                            className="h-8 text-xs gap-1.5 font-semibold"
                            onClick={() => setIsAdding(true)}
                        >
                            <IconPlus className="size-3.5" />
                            Add Item
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-3">
                {notIncludedItems.length === 0 && !isAdding && (
                    <div className="p-6 text-center border-2 border-dashed rounded-xl bg-muted/20">
                        <p className="text-xs text-muted-foreground font-medium">No excluded items specified. Click "+ Add Item" or "Bulk Paste" above.</p>
                    </div>
                )}

                <div className="space-y-2">
                    {notIncludedItems.map((item, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors text-sm"
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-mono font-bold text-muted-foreground">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                <span className="font-medium text-foreground text-xs leading-relaxed truncate">{item}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => handleDeleteItem(index)}
                            >
                                <IconTrash className="size-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>

                {isAdding && (
                    <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/20">
                        <Input
                            placeholder="e.g. Domain Registration & Web Hosting"
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddItem();
                                if (e.key === "Escape") setIsAdding(false);
                            }}
                            className="h-8 text-xs bg-background"
                            autoFocus
                        />
                        <Button size="sm" className="h-8 text-xs shrink-0" onClick={handleAddItem}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs shrink-0" onClick={() => setIsAdding(false)}>Cancel</Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ClientRequirementsSection() {
    const { clientRequirements, setClientRequirements } = useQuotation();
    const [isAdding, setIsAdding] = useState(false);
    const [newItemText, setNewItemText] = useState("");
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkText, setBulkText] = useState("");

    const handleAddItem = () => {
        if (!newItemText.trim()) return;
        setClientRequirements((prev) => [...prev, newItemText.trim()]);
        setNewItemText("");
        setIsAdding(false);
    };

    const handleBulkImport = () => {
        if (!bulkText.trim()) return;
        const lines = bulkText
            .split("\n")
            .map((l) => l.trim().replace(/^[-*•◦▪+]\s*/, ""))
            .filter(Boolean);
        if (lines.length > 0) {
            setClientRequirements((prev) => [...prev, ...lines]);
            toast.success(`Imported ${lines.length} requirements!`);
        }
        setBulkText("");
        setIsBulkOpen(false);
    };

    const handleDeleteItem = (index: number) => {
        setClientRequirements((prev) => prev.filter((_, i) => i !== index));
    };

    return (
        <Card className="border shadow-xs">
            <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 text-xs font-bold">✓</span>
                            Client Needs to Provide
                        </CardTitle>
                        <CardDescription className="text-xs">
                            List prerequisites, credentials, access, or content expected from the client.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-medium">
                                    <IconCopy className="size-3.5" />
                                    Bulk Paste
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Bulk Paste Client Prerequisites</DialogTitle>
                                    <DialogDescription className="text-xs">
                                        Paste multiple requirements (one per line). Bullets and hyphens will be cleaned automatically.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-3 pt-2">
                                    <Textarea
                                        placeholder="High-resolution Brand Logo & Palette&#10;Hosting & Domain Credentials&#10;Final Approved Text Copy & Product Photos"
                                        value={bulkText}
                                        onChange={(e) => setBulkText(e.target.value)}
                                        rows={6}
                                        className="font-mono text-xs"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
                                        <Button size="sm" onClick={handleBulkImport}>Import Requirements</Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                        <Button
                            size="sm"
                            className="h-8 text-xs gap-1.5 font-semibold"
                            onClick={() => setIsAdding(true)}
                        >
                            <IconPlus className="size-3.5" />
                            Add Requirement
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-3">
                {clientRequirements.length === 0 && !isAdding && (
                    <div className="p-6 text-center border-2 border-dashed rounded-xl bg-muted/20">
                        <p className="text-xs text-muted-foreground font-medium">No client requirements specified. Click "+ Add Requirement" or "Bulk Paste" above.</p>
                    </div>
                )}

                <div className="space-y-2">
                    {clientRequirements.map((item, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors text-sm"
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-mono font-bold text-muted-foreground">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                <span className="font-medium text-foreground text-xs leading-relaxed truncate">{item}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => handleDeleteItem(index)}
                            >
                                <IconTrash className="size-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>

                {isAdding && (
                    <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/20">
                        <Input
                            placeholder="e.g. Hosting Admin Credentials"
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddItem();
                                if (e.key === "Escape") setIsAdding(false);
                            }}
                            className="h-8 text-xs bg-background"
                            autoFocus
                        />
                        <Button size="sm" className="h-8 text-xs shrink-0" onClick={handleAddItem}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs shrink-0" onClick={() => setIsAdding(false)}>Cancel</Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function PaymentTermsSection() {
    const { paymentMilestones, setPaymentMilestones, paymentPreset, setPaymentPreset } = useQuotation();

    const handleSelectPreset = (preset: "50-50" | "30-40-30" | "100-upfront" | "custom") => {
        setPaymentPreset(preset);
        if (preset === "50-50") {
            setPaymentMilestones([
                { label: "50% Upfront Deposit (Project Kickoff)", percentage: 50 },
                { label: "50% Final Delivery & Handover", percentage: 50 },
            ]);
        } else if (preset === "30-40-30") {
            setPaymentMilestones([
                { label: "30% Upfront Deposit (Project Kickoff)", percentage: 30 },
                { label: "40% Midway Progress Milestone", percentage: 40 },
                { label: "30% Final Delivery & Handover", percentage: 30 },
            ]);
        } else if (preset === "100-upfront") {
            setPaymentMilestones([
                { label: "100% Upfront Payment on Project Kickoff", percentage: 100 },
            ]);
        }
    };

    const handleAddCustomMilestone = () => {
        setPaymentMilestones((prev) => [
            ...prev,
            { label: `Milestone #${prev.length + 1}`, percentage: 0 },
        ]);
    };

    const handleUpdateMilestone = (index: number, updates: Partial<{ label: string; percentage: number }>) => {
        setPaymentMilestones((prev) =>
            prev.map((m, i) => (i === index ? { ...m, ...updates } : m))
        );
    };

    const handleDeleteMilestone = (index: number) => {
        setPaymentMilestones((prev) => prev.filter((_, i) => i !== index));
    };

    const totalPercentage = paymentMilestones.reduce((sum, m) => sum + (Number(m.percentage) || 0), 0);

    return (
        <Card className="border shadow-xs">
            <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 text-xs font-bold">◆</span>
                            Payment Terms & Milestones
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Select a payment schedule preset or build a custom milestone breakdown.
                        </CardDescription>
                    </div>
                    {paymentPreset === "custom" && (
                        <Badge
                            variant="secondary"
                            className={cn(
                                "w-fit font-mono font-bold text-xs px-3 py-1 border",
                                totalPercentage === 100
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                    : "bg-rose-500/10 text-rose-600 border-rose-500/30"
                            )}
                        >
                            Total: {totalPercentage}%
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-5">
                {/* Presets Button Group */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button
                        type="button"
                        onClick={() => handleSelectPreset("50-50")}
                        className={cn(
                            "relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer text-center select-none",
                            paymentPreset === "50-50"
                                ? "border-primary bg-primary/5 text-primary shadow-xs font-bold ring-1 ring-primary/20"
                                : "border-border hover:border-primary/40 bg-card text-muted-foreground"
                        )}
                    >
                        {paymentPreset === "50-50" && (
                            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <IconCheck className="size-2.5 stroke-[3]" />
                            </span>
                        )}
                        <span className="text-sm font-extrabold font-mono">50 / 50</span>
                        <span className="text-[11px] font-medium opacity-80 mt-0.5">Two Milestones</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSelectPreset("30-40-30")}
                        className={cn(
                            "relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer text-center select-none",
                            paymentPreset === "30-40-30"
                                ? "border-primary bg-primary/5 text-primary shadow-xs font-bold ring-1 ring-primary/20"
                                : "border-border hover:border-primary/40 bg-card text-muted-foreground"
                        )}
                    >
                        {paymentPreset === "30-40-30" && (
                            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <IconCheck className="size-2.5 stroke-[3]" />
                            </span>
                        )}
                        <span className="text-sm font-extrabold font-mono">30 / 40 / 30</span>
                        <span className="text-[11px] font-medium opacity-80 mt-0.5">Three Milestones</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSelectPreset("100-upfront")}
                        className={cn(
                            "relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer text-center select-none",
                            paymentPreset === "100-upfront"
                                ? "border-primary bg-primary/5 text-primary shadow-xs font-bold ring-1 ring-primary/20"
                                : "border-border hover:border-primary/40 bg-card text-muted-foreground"
                        )}
                    >
                        {paymentPreset === "100-upfront" && (
                            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <IconCheck className="size-2.5 stroke-[3]" />
                            </span>
                        )}
                        <span className="text-sm font-extrabold font-mono">100%</span>
                        <span className="text-[11px] font-medium opacity-80 mt-0.5">Upfront Payment</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSelectPreset("custom")}
                        className={cn(
                            "relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer text-center select-none",
                            paymentPreset === "custom"
                                ? "border-primary bg-primary/5 text-primary shadow-xs font-bold ring-1 ring-primary/20"
                                : "border-border hover:border-primary/40 bg-card text-muted-foreground"
                        )}
                    >
                        {paymentPreset === "custom" && (
                            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <IconCheck className="size-2.5 stroke-[3]" />
                            </span>
                        )}
                        <span className="text-sm font-extrabold font-mono">Custom</span>
                        <span className="text-[11px] font-medium opacity-80 mt-0.5">User Defined</span>
                    </button>
                </div>

                {/* Milestones List */}
                <div className="space-y-2 pt-1">
                    {paymentMilestones.map((m, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card text-sm"
                        >
                            {paymentPreset === "custom" ? (
                                <div className="flex items-center gap-2 flex-1">
                                    <Input
                                        value={m.label}
                                        onChange={(e) => handleUpdateMilestone(index, { label: e.target.value })}
                                        className="h-8 text-xs font-medium flex-1 bg-background"
                                        placeholder="Milestone description"
                                    />
                                    <div className="flex items-center gap-1 shrink-0 w-24">
                                        <Input
                                            type="number"
                                            value={m.percentage}
                                            onChange={(e) => handleUpdateMilestone(index, { percentage: Number(e.target.value) || 0 })}
                                            className="h-8 text-xs font-mono font-bold text-center bg-background"
                                            placeholder="%"
                                            min={0}
                                            max={100}
                                        />
                                        <span className="text-xs font-bold text-muted-foreground">%</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                                        onClick={() => handleDeleteMilestone(index)}
                                    >
                                        <IconTrash className="size-3.5" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-6 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 text-xs font-bold">
                                            {index + 1}
                                        </span>
                                        <span className="font-semibold text-foreground text-xs">{m.label}</span>
                                    </div>
                                    <Badge variant="outline" className="font-mono font-bold text-xs bg-muted/40 px-3 py-1">
                                        {m.percentage}%
                                    </Badge>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {paymentPreset === "custom" && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-8 border-dashed gap-1.5 font-medium"
                        onClick={handleAddCustomMilestone}
                    >
                        <IconPlus className="size-3.5" />
                        Add Custom Milestone
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
