"use client";

import React, { useState, createContext, useContext } from "react";
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
import { Combobox } from "@/components/ui/combobox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// --- Data Constants ---

const clients = [
    "Ethan Carter",
    "Olivia Bennett",
    "Liam Anderson",
    "Sophia Mitchell",
    "Noah Thompson",
];

const currencies = [
    "US Dollar (USD)",
    "Euro (EUR)",
    "British Pound (GBP)",
    "Bangladeshi Taka (BDT)",
];

const services = [
    "Web Design & Development",
    "Marketing",
    "Video Editing",
    "Photo Editing",
];

type Feature = {
    id: number;
    name: string;
    route?: string;
    price?: string;
    children?: Feature[];
};

const initialFeatures: Feature[] = [
    {
        id: 1,
        name: "Admin Dashboard",
        route: "/dashboard",
        price: "30000",
        children: [
            {
                id: 2,
                name: "User Management",
                route: "/dashboard/users",
                price: "10000",
                children: [
                    {
                        id: 3,
                        name: "User List",
                        route: "/dashboard/users",
                    },
                    {
                        id: 4,
                        name: "User Details",
                        route: "/dashboard/users/:id",
                    },
                ],
            },
            {
                id: 5,
                name: "Order Management",
                children: [
                    {
                        id: 6,
                        name: "Order List",
                    },
                    {
                        id: 7,
                        name: "Order Details",
                    },
                ],
            },
        ],
    },
    {
        id: 8,
        name: "Authentication",
        children: [
            {
                id: 9,
                name: "Login",
            },
            {
                id: 10,
                name: "Registration",
            },
        ],
    },
];

const initialMarketingFeatures: Feature[] = [
    {
        id: 101,
        name: "Search Engine Optimization (SEO)",
        children: [
            { id: 102, name: "On-Page SEO Optimization" },
            { id: 103, name: "Off-Page Backlink Building" },
        ],
    },
    {
        id: 104,
        name: "Social Media Marketing (SMM)",
        children: [
            { id: 105, name: "Content Creation & Posting" },
            { id: 106, name: "Paid Ad Campaigns" },
        ],
    },
];

// --- Main Page Component ---

import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "@/components/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";

// --- Helper Functions for Hierarchical Feature Tree ---

const addNode = (
    nodes: Feature[],
    parentId: number | undefined,
    newNode: Feature,
): Feature[] => {
    if (!parentId) {
        return [...nodes, newNode];
    }
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

const findParent = (
    nodes: Feature[],
    id: number,
): { parent: Feature | null; index: number; list: Feature[] } | null => {
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === id) {
            return { parent: null, index: i, list: nodes };
        }
        if (nodes[i].children) {
            const found = findParent(nodes[i].children!, id);
            if (found) {
                if (found.parent === null && found.list === nodes[i].children) {
                    return {
                        parent: nodes[i],
                        index: found.index,
                        list: found.list,
                    };
                }
                return found;
            }
        }
    }
    return null;
};

const makeMainNode = (nodes: Feature[], id: number): Feature[] => {
    const parentInfo = findParent(nodes, id);
    if (!parentInfo) return nodes;
    if (parentInfo.parent === null) return nodes;

    const nodeToPromote = parentInfo.list[parentInfo.index];
    const cleanTree = deleteNode(nodes, id);
    return [...cleanTree, nodeToPromote];
};

const indentNode = (nodes: Feature[], id: number): Feature[] => {
    const parentInfo = findParent(nodes, id);
    if (!parentInfo) return nodes;

    const { index, list } = parentInfo;
    if (index === 0) return nodes;

    const nodeToIndent = list[index];
    const prevSibling = list[index - 1];

    const cleanTree = deleteNode(nodes, id);
    return updateNode(cleanTree, prevSibling.id, {
        children: [...(prevSibling.children || []), nodeToIndent],
    });
};

const insertAfterNode = (
    nodes: Feature[],
    targetId: number,
    nodeToInsert: Feature,
): Feature[] => {
    const index = nodes.findIndex((n) => n.id === targetId);
    if (index !== -1) {
        const copy = [...nodes];
        copy.splice(index + 1, 0, nodeToInsert);
        return copy;
    }
    return nodes.map((node) => {
        if (node.children) {
            return {
                ...node,
                children: insertAfterNode(
                    node.children,
                    targetId,
                    nodeToInsert,
                ),
            };
        }
        return node;
    });
};

const outdentNode = (nodes: Feature[], id: number): Feature[] => {
    const parentInfo = findParent(nodes, id);
    if (!parentInfo || parentInfo.parent === null) return nodes;

    const nodeToOutdent = parentInfo.list[parentInfo.index];
    const parent = parentInfo.parent;

    const cleanTree = deleteNode(nodes, id);
    return insertAfterNode(cleanTree, parent.id, nodeToOutdent);
};

const moveNodeUp = (nodes: Feature[], id: number): Feature[] => {
    const parentInfo = findParent(nodes, id);
    if (!parentInfo) return nodes;

    const { index, list, parent } = parentInfo;
    if (index === 0) return nodes;

    const newList = [...list];
    const temp = newList[index];
    newList[index] = newList[index - 1];
    newList[index - 1] = temp;

    if (parent === null) {
        return newList;
    } else {
        return updateNode(nodes, parent.id, { children: newList });
    }
};

const moveNodeDown = (nodes: Feature[], id: number): Feature[] => {
    const parentInfo = findParent(nodes, id);
    if (!parentInfo) return nodes;

    const { index, list, parent } = parentInfo;
    if (index === list.length - 1) return nodes;

    const newList = [...list];
    const temp = newList[index];
    newList[index] = newList[index + 1];
    newList[index + 1] = temp;

    if (parent === null) {
        return newList;
    } else {
        return updateNode(nodes, parent.id, { children: newList });
    }
};

const findTargetChildren = (
    nodes: Feature[],
    id: number,
): Feature[] | undefined => {
    for (const node of nodes) {
        if (node.id === id) return node.children;
        if (node.children) {
            const res = findTargetChildren(node.children, id);
            if (res !== undefined) return res;
        }
    }
    return undefined;
};

const getCurrencySymbol = (currency: string): string => {
    if (currency.includes("USD")) return "$";
    if (currency.includes("EUR")) return "€";
    if (currency.includes("GBP")) return "£";
    return "৳"; // Default to BDT
};

const isDescendant = (
    nodes: Feature[],
    parentId: number,
    childId: number,
): boolean => {
    const findNode = (list: Feature[]): Feature | null => {
        for (const n of list) {
            if (n.id === parentId) return n;
            if (n.children) {
                const found = findNode(n.children);
                if (found) return found;
            }
        }
        return null;
    };
    const parentNode = findNode(nodes);
    if (!parentNode) return false;

    let found = false;
    const checkChildren = (list: Feature[]) => {
        for (const n of list) {
            if (n.id === childId) {
                found = true;
                break;
            }
            if (n.children) checkChildren(n.children);
        }
    };
    if (parentNode.children) checkChildren(parentNode.children);
    return found;
};

const moveNode = (
    nodes: Feature[],
    draggedId: number,
    targetId: number,
): Feature[] => {
    if (draggedId === targetId) return nodes;

    let draggedNode: Feature | null = null;
    const findNode = (list: Feature[]): void => {
        for (const n of list) {
            if (n.id === draggedId) {
                draggedNode = n;
                break;
            }
            if (n.children) findNode(n.children);
        }
    };
    findNode(nodes);
    if (!draggedNode) return nodes;

    const cleanTree = deleteNode(nodes, draggedId);
    return updateNode(cleanTree, targetId, {
        children: [
            ...(findTargetChildren(cleanTree, targetId) || []),
            draggedNode,
        ],
    });
};

const moveNodeSibling = (
    nodes: Feature[],
    draggedId: number,
    targetId: number,
    position: "before" | "after",
): Feature[] => {
    if (draggedId === targetId) return nodes;

    let draggedNode: Feature | null = null;
    const findNode = (list: Feature[]): void => {
        for (const n of list) {
            if (n.id === draggedId) {
                draggedNode = n;
                break;
            }
            if (n.children) findNode(n.children);
        }
    };
    findNode(nodes);
    if (!draggedNode) return nodes;

    const cleanTree = deleteNode(nodes, draggedId);

    const insertSibling = (list: Feature[]): Feature[] => {
        const index = list.findIndex((n) => n.id === targetId);
        if (index !== -1) {
            const newList = [...list];
            const insertIndex = position === "before" ? index : index + 1;
            newList.splice(insertIndex, 0, draggedNode!);
            return newList;
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

function parseBulkFeatures(text: string): Feature[] {
    const lines = text.split("\n").filter((line) => line.trim() !== "");
    const result: Feature[] = [];
    const stack: { level: number; feature: Feature }[] = [];

    const currentId = Date.now();

    lines.forEach((line, index) => {
        const match = line.match(/^(\s*)/);
        const indentStr = match ? match[0] : "";
        const level = indentStr.replace(/\t/g, "    ").length;

        const name = line.trim().replace(/^[-*•+]\s+/, "");

        const newFeature: Feature = {
            id: currentId + index,
            name: name,
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

// --- Context for Dynamic State Management ---

export type PricingItem = {
    id: number;
    name: string;
    description: string;
    price: number;
    billingType: "fixed" | "monthly";
};

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
    indentFeature: (service: "web-dev" | "marketing", id: number) => void;
    outdentFeature: (service: "web-dev" | "marketing", id: number) => void;
    makeMainFeature: (service: "web-dev" | "marketing", id: number) => void;
    moveFeatureUp: (service: "web-dev" | "marketing", id: number) => void;
    moveFeatureDown: (service: "web-dev" | "marketing", id: number) => void;
    bulkPasteFeatures: (service: "web-dev" | "marketing", text: string) => void;

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

    // Service drag and drop
    draggedServiceIndex: number | null;
    setDraggedServiceIndex: (index: number | null) => void;
    reorderServices: (
        draggedIndex: number,
        targetIndex: number,
        position: "before" | "after",
    ) => void;

    // Pricing drag and drop
    draggedPricingIndex: number | null;
    setDraggedPricingIndex: (index: number | null) => void;
    reorderPricingItems: (
        service: "web-dev" | "video-editing" | "marketing",
        draggedIndex: number,
        targetIndex: number,
        position: "before" | "after",
    ) => void;
};

const QuotationContext = createContext<QuotationContextType | undefined>(
    undefined,
);

export function QuotationProvider({ children }: { children: React.ReactNode }) {
    const [selectedServices, setSelectedServices] = useState<string[]>([
        "Web Design & Development",
        "Photo Editing",
    ]);
    const [selectedClient, setSelectedClient] = useState("");
    const [selectedCurrency, setSelectedCurrency] = useState(
        "Bangladeshi Taka (BDT)",
    );
    const [projectTitle, setProjectTitle] = useState("");

    const [features, setFeatures] = useState<Feature[]>(initialFeatures);
    const [marketingFeatures, setMarketingFeatures] = useState<Feature[]>(initialMarketingFeatures);

    const [webDevPricing, setWebDevPricing] = useState<PricingItem[]>([
        {
            id: 1,
            name: "UI/UX Design",
            description: "Complete product interface design",
            price: 40000,
            billingType: "fixed",
        },
        {
            id: 2,
            name: "Development",
            description: "Frontend and backend implementation",
            price: 110000,
            billingType: "fixed",
        },
    ]);

    const [photoEditingQty, setPhotoEditingQty] = useState<number>(50);
    const [photoEditingRate, setPhotoEditingRate] = useState<number>(300);

    const [videoEditingQty, setVideoEditingQty] = useState<number>(10);
    const [videoEditingRate, setVideoEditingRate] = useState<number>(1000);
    const [videoEditingUnit, setVideoEditingUnit] = useState<"video" | "second" | "10-seconds">("video");

    const [videoEditingPricing, setVideoEditingPricing] = useState<
        PricingItem[]
    >([]);

    const [marketingPricing, setMarketingPricing] = useState<PricingItem[]>([]);
    const [marketingAdBudget, setMarketingAdBudget] = useState<number>(500);

    const [draggedId, setDraggedId] = useState<number | null>(null);
    const [draggedServiceIndex, setDraggedServiceIndex] = useState<
        number | null
    >(null);
    const [draggedPricingIndex, setDraggedPricingIndex] = useState<
        number | null
    >(null);

    const addFeature = (service: "web-dev" | "marketing", parentId?: number) => {
        const newFeature: Feature = {
            id: Date.now(),
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

    const bulkPasteFeatures = (service: "web-dev" | "marketing", text: string) => {
        const newFeatures = parseBulkFeatures(text);
        const setter = service === "marketing" ? setMarketingFeatures : setFeatures;
        setter((prev) => [...prev, ...newFeatures]);
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
            name: "New Pricing Item",
            description: "Description",
            price: 0,
            billingType: "fixed",
        };
        if (service === "web-dev")
            setWebDevPricing((prev) => [...prev, newItem]);
        else if (service === "video-editing")
            setVideoEditingPricing((prev) => [...prev, newItem]);
        else if (service === "marketing")
            setMarketingPricing((prev) => [...prev, newItem]);
    };

    const updatePricingItem = (
        service: "web-dev" | "video-editing" | "marketing",
        id: number,
        updates: Partial<PricingItem>,
    ) => {
        const setter =
            service === "web-dev"
                ? setWebDevPricing
                : service === "video-editing"
                  ? setVideoEditingPricing
                  : setMarketingPricing;
        setter((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, ...updates } : item,
            ),
        );
    };

    const deletePricingItem = (
        service: "web-dev" | "video-editing" | "marketing",
        id: number,
    ) => {
        const setter =
            service === "web-dev"
                ? setWebDevPricing
                : service === "video-editing"
                  ? setVideoEditingPricing
                  : setMarketingPricing;
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
        const setter =
            service === "web-dev"
                ? setWebDevPricing
                : service === "video-editing"
                  ? setVideoEditingPricing
                  : setMarketingPricing;

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
                videoEditingPricing,
                marketingPricing,
                marketingAdBudget,
                setMarketingAdBudget,
                addFeature,
                updateFeature,
                deleteFeature,
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
            }}
        >
            {children}
        </QuotationContext.Provider>
    );
}

export function useQuotation() {
    const context = useContext(QuotationContext);
    if (!context)
        throw new Error("useQuotation must be used within a QuotationProvider");
    return context;
}

// --- Main Page Component ---

export default function NewQuotationPage() {
    return (
        <QuotationProvider>
            <div className="flex flex-col gap-4 p-0 md:gap-6 md:p-0">
                <NewQuotationHeader
                    title="New Quotation"
                    quotationId="QTY-26-230"
                />
                <NewQuotationForm />
            </div>
        </QuotationProvider>
    );
}

// --- Header Component ---

function NewQuotationHeader(props: { title: string; quotationId: string }) {
    return (
        <Card>
            <CardContent className="flex items-center justify-between gap-6 md:gap-10 py-6">
                <div className="flex items-center gap-2 md:gap-4 self-start">
                    <Button size="icon" variant="secondary">
                        <IconArrowLeft />
                    </Button>

                    <div className="flex flex-col items-start gap-1">
                        <CardTitle>{props.title}</CardTitle>
                        <CardDescription>
                            {`Quotation ID: ${props.quotationId}`}
                        </CardDescription>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="lg">
                        Preview
                    </Button>
                    <Button variant="outline" size="lg">
                        Save Draft
                    </Button>
                    <Button size="lg">Export PDF</Button>
                </div>
            </CardContent>
        </Card>
    );
}

// --- Form Component ---

// --- Draggable Service Card Wrapper ---

function DraggableServiceCard({
    serviceName,
    index,
}: {
    serviceName: string;
    index: number;
}) {
    const { draggedServiceIndex, setDraggedServiceIndex, reorderServices } =
        useQuotation();
    const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(
        null,
    );
    const [isDraggable, setIsDraggable] = useState(false);

    const handleDragStart = (e: React.DragEvent) => {
        setDraggedServiceIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedServiceIndex === null || draggedServiceIndex === index)
            return;
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
        if (
            draggedServiceIndex !== null &&
            draggedServiceIndex !== index &&
            dropPosition
        ) {
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
                onGripEnter={() => setIsDraggable(true)}
                onGripLeave={() => setIsDraggable(false)}
            />
        );
    } else if (serviceName.startsWith("Photo Editing")) {
        cardContent = (
            <PhotoEditingService
                serviceName={serviceName}
                onGripEnter={() => setIsDraggable(true)}
                onGripLeave={() => setIsDraggable(false)}
            />
        );
    } else if (serviceName.startsWith("Video Editing")) {
        cardContent = (
            <VideoEditingService
                serviceName={serviceName}
                onGripEnter={() => setIsDraggable(true)}
                onGripLeave={() => setIsDraggable(false)}
            />
        );
    } else if (serviceName.startsWith("Marketing")) {
        cardContent = (
            <MarketingService
                serviceName={serviceName}
                onGripEnter={() => setIsDraggable(true)}
                onGripLeave={() => setIsDraggable(false)}
            />
        );
    }

    return (
        <div
            draggable={isDraggable}
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

// --- Form Component ---

function NewQuotationForm() {
    const {
        selectedServices,
        setSelectedServices,
        selectedClient,
        setSelectedClient,
        selectedCurrency,
        setSelectedCurrency,
        projectTitle,
        setProjectTitle,
    } = useQuotation();

    const toggleService = (service: string) => {
        setSelectedServices((current) =>
            current.includes(service)
                ? current.filter((item) => item !== service)
                : [...current, service],
        );
    };

    return (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-6">
                {/* Quotation Information */}

                <Card>
                    <CardHeader>
                        <CardTitle>Quotation Information</CardTitle>
                        <CardDescription>
                            Basic client and project information.
                        </CardDescription>
                    </CardHeader>

                    <Separator />

                    <CardContent className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label>Client</Label>
                            <Combobox
                                options={clients.map((client) => ({
                                    value: client,
                                    label: client,
                                }))}
                                value={selectedClient}
                                onChange={setSelectedClient}
                                placeholder="Select a client"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="project-title">Project Title</Label>
                            <Input
                                id="project-title"
                                placeholder="Enter project title"
                                value={projectTitle}
                                onChange={(e) =>
                                    setProjectTitle(e.target.value)
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Currency</Label>
                            <Combobox
                                options={currencies.map((currency) => ({
                                    value: currency,
                                    label: currency,
                                }))}
                                value={selectedCurrency}
                                onChange={setSelectedCurrency}
                                placeholder="Select currency"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Services */}

                <Card>
                    <CardHeader>
                        <CardTitle>Services</CardTitle>

                        <CardDescription>
                            Select the services you want to include in this
                            quotation.
                        </CardDescription>
                    </CardHeader>

                    <Separator />

                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        {services.map((service) => (
                            <div
                                key={service}
                                className="flex items-center gap-3 w-full"
                            >
                                <Checkbox
                                    id={service}
                                    checked={selectedServices.includes(service)}
                                    onCheckedChange={() =>
                                        toggleService(service)
                                    }
                                />
                                <Label
                                    htmlFor={service}
                                    className="cursor-pointer"
                                >
                                    {service}
                                </Label>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Selected Services */}

                <div className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold">
                            Quotation Services
                        </h2>

                        <p className="text-sm text-muted-foreground">
                            Configure the scope and pricing for each service.
                        </p>
                    </div>

                    {selectedServices.map((serviceName, index) => (
                        <DraggableServiceCard
                            key={serviceName}
                            serviceName={serviceName}
                            index={index}
                        />
                    ))}
                </div>
            </div>

            {/* Summary */}
            <QuotationSummary />
        </div>
    );
}

// --- Service Block Components ---

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
        webDevPricing,
        addPricingItem,
        addFeature,
        selectedCurrency,
    } = useQuotation();
    const [isOpen, setIsOpen] = useState(true);

    const currencySymbol = getCurrencySymbol(selectedCurrency);

    const subtotalFixed = webDevPricing
        .filter((i) => i.billingType === "fixed")
        .reduce((acc, i) => acc + i.price, 0);
    const subtotalMonthly = webDevPricing
        .filter((i) => i.billingType === "monthly")
        .reduce((acc, i) => acc + i.price, 0);

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
                                    Complete website design and development.
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
                            <ServiceActions serviceName={serviceName} />
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
                    <CardContent className="space-y-4">
                        {/* Feature Tree */}

                        <Card className="shadow-none">
                            <CardHeader>
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-base">
                                            Features & Scope
                                        </CardTitle>

                                        <CardDescription>
                                            Define the complete project feature
                                            hierarchy.
                                        </CardDescription>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <BulkPasteDialog service="web-dev" />

                                        <Button
                                            size="sm"
                                            onClick={() => addFeature("web-dev")}
                                        >
                                            <IconPlus className="size-4 mr-1" />
                                            Add Feature
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            <Separator />

                            <CardContent className="">
                                <div className="space-y-1">
                                    {features.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            No features added yet.
                                        </p>
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
                                        <CardTitle className="text-base">
                                            Project Pricing
                                        </CardTitle>

                                        <CardDescription>
                                            One-time development charges.
                                        </CardDescription>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            addPricingItem("web-dev")
                                        }
                                    >
                                        <IconPlus className="size-4 mr-1" />
                                        Add Item
                                    </Button>
                                </div>
                            </CardHeader>

                            <Separator />

                            <CardContent className="space-y-3">
                                {webDevPricing.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No pricing items added yet.
                                    </p>
                                ) : (
                                    webDevPricing.map((item, pricingIdx) => (
                                        <PricingItemRow
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
    const [isEditing, setIsEditing] = useState(false);
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
                        <div className="grid gap-2 sm:grid-cols-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">
                                    Feature Name
                                </Label>
                                <Input
                                    value={editName}
                                    onChange={(e) =>
                                        setEditName(e.target.value)
                                    }
                                    className="h-8 text-sm font-medium w-full bg-background"
                                    placeholder="Feature name"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">
                                    Route
                                </Label>
                                <Input
                                    value={editRoute}
                                    onChange={(e) =>
                                        setEditRoute(e.target.value)
                                    }
                                    className="h-8 text-xs w-full bg-background"
                                    placeholder="/route"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">
                                    Price ({currencySymbol})
                                </Label>
                                <Input
                                    value={editPrice}
                                    onChange={(e) =>
                                        setEditPrice(e.target.value)
                                    }
                                    className="h-8 text-xs w-full bg-background"
                                    placeholder={`${currencySymbol}Price`}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button
                                size="sm"
                                className="h-8 px-3"
                                onClick={handleSave}
                            >
                                Save
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-3"
                                onClick={() => setIsEditing(false)}
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
                                {open ? (
                                    <IconChevronDown className="size-4" />
                                ) : (
                                    <IconChevronRight className="size-4" />
                                )}
                            </Button>
                        ) : (
                            <div className="w-7" />
                        )}

                        {hasChildren ? (
                            <IconFolder className="size-4 shrink-0 text-amber-500" />
                        ) : (
                            <IconFile className="size-4 shrink-0 text-slate-400" />
                        )}

                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {feature.name}
                        </span>

                        {feature.route && (
                            <span className="hidden text-xs text-muted-foreground md:block">
                                {feature.route}
                            </span>
                        )}

                        {feature.price && (
                            <span className="text-sm font-medium">
                                {currencySymbol}
                                {isNaN(Number(feature.price))
                                    ? feature.price
                                    : Number(feature.price).toLocaleString(
                                          "en-IN",
                                      )}
                            </span>
                        )}

                        {hasChildren && !open && (
                            <Badge variant="secondary">
                                {feature.children?.length}
                            </Badge>
                        )}

                        <div
                            className="hidden group-hover:flex items-center gap-1 pl-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                title="Add Subfeature"
                                onClick={() => addFeature(service, feature.id)}
                            >
                                <IconPlus className="size-4 text-primary" />
                            </Button>

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

function PricingItemRow({
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
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(item.name);
    const [desc, setDesc] = useState(item.description);
    const [price, setPrice] = useState(item.price.toString());
    const [billingType, setBillingType] = useState<"fixed" | "monthly">(
        item.billingType,
    );

    const currencySymbol = getCurrencySymbol(selectedCurrency);

    const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(
        null,
    );
    const [isDraggable, setIsDraggable] = useState(false);

    const handleSave = () => {
        updatePricingItem(service, item.id, {
            name,
            description: desc,
            price: Number(price) || 0,
            billingType,
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
        if (draggedPricingIndex === null || draggedPricingIndex === index)
            return;
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
        if (
            draggedPricingIndex !== null &&
            draggedPricingIndex !== index &&
            dropPosition
        ) {
            reorderPricingItems(
                service,
                draggedPricingIndex,
                index,
                dropPosition,
            );
        }
        setDraggedPricingIndex(null);
        setDropPosition(null);
    };

    const handleDragEnd = () => {
        setDraggedPricingIndex(null);
        setDropPosition(null);
    };

    if (isEditing) {
        return (
            <div className="flex flex-col gap-2 rounded-lg border p-3 bg-muted/20">
                <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                        <Label className="text-xs">Item Name</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Item Name"
                            className="h-8"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            placeholder="Description"
                            className="h-8"
                        />
                    </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 items-end">
                    <div className="space-y-1">
                        <Label className="text-xs">
                            Price ({currencySymbol})
                        </Label>
                        <Input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="Price"
                            className="h-8"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Billing Type</Label>
                        <Combobox
                            options={[
                                { value: "fixed", label: "Fixed (One-time)" },
                                {
                                    value: "monthly",
                                    label: "Monthly Recurring",
                                },
                            ]}
                            value={billingType}
                            onChange={(val) =>
                                setBillingType(val as "fixed" | "monthly")
                            }
                        />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={handleSave} className="h-8">
                            Save
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsEditing(false)}
                            className="h-8"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            className={`transition-all duration-150 ${draggedPricingIndex === index ? "opacity-30" : ""}`}
        >
            {dropPosition === "before" && (
                <div className="h-0.5 w-full bg-primary rounded my-1 animate-pulse" />
            )}

            <div className="flex items-center gap-4 py-2 hover:bg-muted/10 px-2 rounded-md">
                <IconGripVertical
                    className="size-4 text-muted-foreground shrink-0 cursor-grab"
                    onMouseEnter={() => setIsDraggable(true)}
                    onMouseLeave={() => setIsDraggable(false)}
                />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                        {item.description}
                    </p>
                </div>
                <Badge
                    variant={
                        item.billingType === "monthly" ? "secondary" : "outline"
                    }
                >
                    {item.billingType === "monthly" ? "Monthly" : "Fixed"}
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

            {dropPosition === "after" && (
                <div className="h-0.5 w-full bg-primary rounded my-1 animate-pulse" />
            )}
        </div>
    );
}

function BulkPasteDialog({ service = "web-dev" }: { service?: "web-dev" | "marketing" }) {
    const { bulkPasteFeatures } = useQuotation();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");

    const handleImport = () => {
        bulkPasteFeatures(service, text);
        setText("");
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    Bulk Paste
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Bulk Paste Features</DialogTitle>
                    <DialogDescription>
                        Paste a list of features below. Indent items using
                        spaces or tabs to create subfeatures.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <textarea
                        className="w-full h-64 p-3 font-mono text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
                        placeholder={`Homepage
  Hero Section
  Features Grid
About Us
  Our Team
Contact`}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleImport}>Import Features</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ServiceActions({ serviceName }: { serviceName: string }) {
    const { setSelectedServices } = useQuotation();

    const handleDuplicate = () => {
        setSelectedServices((prev) => {
            const index = prev.indexOf(serviceName);
            if (index === -1) return prev;
            const copy = [...prev];
            let baseName = serviceName;
            let counter = 1;
            const match =
                serviceName.match(/(.*) \(Copy \d+\)/) ||
                serviceName.match(/(.*) \(Copy\)/);
            if (match) {
                baseName = match[1];
            }
            let duplicateName = `${baseName} (Copy)`;
            while (copy.includes(duplicateName)) {
                duplicateName = `${baseName} (Copy ${counter})`;
                counter++;
            }
            copy.splice(index + 1, 0, duplicateName);
            return copy;
        });
    };

    const handleRemove = () => {
        setSelectedServices((prev) => prev.filter((s) => s !== serviceName));
    };

    return (
        <div className="flex items-center gap-1">
            <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Duplicate Service"
                onClick={handleDuplicate}
            >
                <IconCopy className="size-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Remove Service"
                onClick={handleRemove}
            >
                <IconTrash className="size-4" />
            </Button>
        </div>
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
    } = useQuotation();
    const [isOpen, setIsOpen] = useState(false);

    const currencySymbol = getCurrencySymbol(selectedCurrency);
    const total = photoEditingQty * photoEditingRate;

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
                                    {photoEditingQty} product images · Quantity
                                    based pricing ({currencySymbol}
                                    {photoEditingRate}/image)
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold mr-2">
                                {currencySymbol}
                                {total.toLocaleString("en-IN")}
                            </span>
                            <ServiceActions serviceName={serviceName} />
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
                            <Label>Quantity of Images</Label>
                            <Input
                                type="number"
                                value={photoEditingQty}
                                onChange={(e) =>
                                    setPhotoEditingQty(
                                        Number(e.target.value) || 0,
                                    )
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Rate per Image ({currencySymbol})</Label>
                            <Input
                                type="number"
                                value={photoEditingRate}
                                onChange={(e) =>
                                    setPhotoEditingRate(
                                        Number(e.target.value) || 0,
                                    )
                                }
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
    } = useQuotation();
    const [isOpen, setIsOpen] = useState(false);

    const currencySymbol = getCurrencySymbol(selectedCurrency);
    const total = videoEditingQty * videoEditingRate;

    const unitLabel =
        videoEditingUnit === "video"
            ? "video"
            : videoEditingUnit === "second"
              ? "second"
              : "10 seconds";

    const unitSingular =
        videoEditingUnit === "video"
            ? "video"
            : videoEditingUnit === "second"
              ? "sec"
              : "10s";

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
                                    {videoEditingQty} {unitLabel}{videoEditingQty !== 1 && videoEditingUnit === "video" ? "s" : ""} · Quantity
                                    based pricing ({currencySymbol}
                                    {videoEditingRate}/{unitSingular})
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold mr-2">
                                {currencySymbol}
                                {total.toLocaleString("en-IN")}
                            </span>
                            <ServiceActions serviceName={serviceName} />
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
                            <select
                                value={videoEditingUnit}
                                onChange={(e) =>
                                    setVideoEditingUnit(
                                        e.target.value as "video" | "second" | "10-seconds"
                                    )
                                }
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="video">Per Video</option>
                                <option value="second">Per Second</option>
                                <option value="10-seconds">Per 10 Seconds</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                                type="number"
                                value={videoEditingQty}
                                onChange={(e) =>
                                    setVideoEditingQty(
                                        Number(e.target.value) || 0,
                                    )
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Rate per {unitSingular} ({currencySymbol})</Label>
                            <Input
                                type="number"
                                value={videoEditingRate}
                                onChange={(e) =>
                                    setVideoEditingRate(
                                        Number(e.target.value) || 0,
                                    )
                                }
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
        marketingPricing,
        addPricingItem,
        addFeature,
        marketingAdBudget,
        setMarketingAdBudget,
        selectedCurrency,
    } = useQuotation();
    const [isOpen, setIsOpen] = useState(true);

    const currencySymbol = getCurrencySymbol(selectedCurrency);

    const subtotalFixed = marketingPricing
        .filter((i) => i.billingType === "fixed")
        .reduce((acc, i) => acc + i.price, 0);
    const subtotalMonthly = marketingPricing
        .filter((i) => i.billingType === "monthly")
        .reduce((acc, i) => acc + i.price, 0);

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
                            <ServiceActions serviceName={serviceName} />
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
                    <CardContent className="space-y-4">
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
                                            <IconPlus className="size-4 mr-1" />
                                            Add Campaign Item
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            <Separator />

                            <CardContent className="">
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
                                        <PricingItemRow
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
                                        value={marketingAdBudget}
                                        onChange={(e) =>
                                            setMarketingAdBudget(
                                                Number(e.target.value) || 0,
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

function SimpleService({
    title,
    description,
    serviceKey,
    onGripEnter,
    onGripLeave,
}: {
    title: string;
    description: string;
    serviceKey: "video-editing" | "marketing";
    onGripEnter?: () => void;
    onGripLeave?: () => void;
}) {
    const {
        videoEditingPricing,
        marketingPricing,
        addPricingItem,
        marketingAdBudget,
        setMarketingAdBudget,
        selectedCurrency,
    } = useQuotation();
    const [isOpen, setIsOpen] = useState(true);

    const currencySymbol = getCurrencySymbol(selectedCurrency);
    const pricingItems =
        serviceKey === "video-editing" ? videoEditingPricing : marketingPricing;
    const subtotalFixed = pricingItems
        .filter((i) => i.billingType === "fixed")
        .reduce((acc, i) => acc + i.price, 0);
    const subtotalMonthly = pricingItems
        .filter((i) => i.billingType === "monthly")
        .reduce((acc, i) => acc + i.price, 0);

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
                                <CardTitle>{title}</CardTitle>
                                <CardDescription className="mt-1">
                                    {description}
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
                            <ServiceActions serviceName={title} />
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
                    <CardContent className="space-y-4">
                        <Card className="shadow-none">
                            <CardHeader className="py-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">
                                            Pricing Items
                                        </CardTitle>
                                        <CardDescription>
                                            Define deliverables and fees.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() =>
                                            addPricingItem(serviceKey)
                                        }
                                    >
                                        <IconPlus className="size-4 mr-1" />
                                        Add Item
                                    </Button>
                                </div>
                            </CardHeader>
                            <Separator />
                            <CardContent className="space-y-3">
                                {pricingItems.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No pricing items added yet.
                                    </p>
                                ) : (
                                    pricingItems.map((item, pricingIdx) => (
                                        <PricingItemRow
                                            key={item.id}
                                            item={item}
                                            service={serviceKey}
                                            index={pricingIdx}
                                        />
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {serviceKey === "marketing" && (
                            <Card className="shadow-none">
                                <CardContent className="p-6 grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>
                                            Monthly Advertising Budget ($)
                                        </Label>
                                        <Input
                                            type="number"
                                            value={marketingAdBudget}
                                            onChange={(e) =>
                                                setMarketingAdBudget(
                                                    Number(e.target.value) || 0,
                                                )
                                            }
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

function QuotationSummary() {
    const {
        selectedServices,
        webDevPricing,
        photoEditingQty,
        photoEditingRate,
        videoEditingQty,
        videoEditingRate,
        videoEditingPricing,
        marketingPricing,
        marketingAdBudget,
        selectedCurrency,
    } = useQuotation();

    const currencySymbol = getCurrencySymbol(selectedCurrency);

    const showWebDev = selectedServices.includes("Web Design & Development");
    const showPhoto = selectedServices.includes("Photo Editing");
    const showVideo = selectedServices.includes("Video Editing");
    const showMarketing = selectedServices.includes("Marketing");

    const webDevFixed = showWebDev
        ? webDevPricing
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
        ? marketingPricing
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

    return (
        <Card className="xl:sticky xl:top-6">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Quotation Summary</CardTitle>
                    <Badge variant="secondary">{selectedCurrency}</Badge>
                </div>
                <CardDescription>Overview of quotation costs.</CardDescription>
            </CardHeader>

            <Separator />

            <CardContent className="space-y-5">
                <div className="space-y-3">
                    {showWebDev && (webDevFixed > 0 || webDevMonthly > 0) && (
                        <SummaryRow
                            label="Web Development"
                            value={
                                <>
                                    {webDevFixed > 0 &&
                                        `${currencySymbol}${webDevFixed.toLocaleString("en-IN")}`}
                                    {webDevFixed > 0 &&
                                        webDevMonthly > 0 &&
                                        " + "}
                                    {webDevMonthly > 0 &&
                                        `${currencySymbol}${webDevMonthly.toLocaleString("en-IN")}/mo`}
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

                    {showVideo && (videoFixed > 0 || videoMonthly > 0) && (
                        <SummaryRow
                            label="Video Editing"
                            value={
                                <>
                                    {videoFixed > 0 &&
                                        `${currencySymbol}${videoFixed.toLocaleString("en-IN")}`}
                                    {videoFixed > 0 &&
                                        videoMonthly > 0 &&
                                        " + "}
                                    {videoMonthly > 0 &&
                                        `${currencySymbol}${videoMonthly.toLocaleString("en-IN")}/mo`}
                                </>
                            }
                        />
                    )}

                    {showMarketing &&
                        (marketingFixed > 0 || marketingMonthly > 0) && (
                            <SummaryRow
                                label="Marketing"
                                value={
                                    <>
                                        {marketingFixed > 0 &&
                                            `${currencySymbol}${marketingFixed.toLocaleString("en-IN")}`}
                                        {marketingFixed > 0 &&
                                            marketingMonthly > 0 &&
                                            " + "}
                                        {marketingMonthly > 0 &&
                                            `${currencySymbol}${marketingMonthly.toLocaleString("en-IN")}/mo`}
                                    </>
                                }
                            />
                        )}
                </div>

                <Separator />

                <SummaryRow
                    label="One-time Cost"
                    value={`${currencySymbol}${totalOneTime.toLocaleString("en-IN")}`}
                    strong
                />

                {totalRecurring > 0 && (
                    <Card className="shadow-none">
                        <CardContent className="flex items-center justify-between py-4">
                            <span className="text-sm text-muted-foreground">
                                Monthly Recurring
                            </span>
                            <span className="font-medium">
                                {currencySymbol}
                                {totalRecurring.toLocaleString("en-IN")}/mo
                            </span>
                        </CardContent>
                    </Card>
                )}

                {showMarketing && marketingAdBudget > 0 && (
                    <div className="rounded-lg border border-dashed p-4">
                        <p className="text-xs font-medium uppercase text-muted-foreground">
                            External Estimated Cost
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                            <span className="text-sm">Advertising Budget</span>
                            <span className="text-sm font-medium">
                                ${marketingAdBudget}/mo
                            </span>
                        </div>
                    </div>
                )}

                <Separator />

                <div>
                    <p className="text-sm text-muted-foreground">
                        Total Project Cost
                    </p>
                    <p className="mt-1 text-2xl font-semibold">
                        {currencySymbol}
                        {totalOneTime.toLocaleString("en-IN")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Excluding recurring and external costs.
                    </p>
                </div>

                <Button className="w-full">
                    <IconFileText className="mr-2 h-4 w-4" />
                    Preview Quotation
                </Button>
            </CardContent>
        </Card>
    );
}

function SummaryRow({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: React.ReactNode;
    strong?: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span
                className={
                    strong
                        ? "text-sm font-medium"
                        : "text-sm text-muted-foreground"
                }
            >
                {label}
            </span>

            <span className="text-sm font-semibold">{value}</span>
        </div>
    );
}
