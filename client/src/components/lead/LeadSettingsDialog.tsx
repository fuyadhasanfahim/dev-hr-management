"use client";

import { useState } from "react";
import {
  useGetLeadSettingsQuery,
  useCreateLeadSettingMutation,
  useDeleteLeadSettingMutation,
} from "@/redux/features/lead/leadSettingApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader, Trash2, Plus, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface LeadSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const predefinedColors = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#64748b", // slate
];

export function LeadSettingsDialog({ open, onOpenChange }: LeadSettingsDialogProps) {
  const { data: settingsData, isLoading } = useGetLeadSettingsQuery(undefined, { skip: !open });
  const [createSetting, { isLoading: isCreating }] = useCreateLeadSettingMutation();
  const [deleteSetting, { isLoading: isDeleting }] = useDeleteLeadSettingMutation();

  const [activeTab, setActiveTab] = useState("STATUS");
  const [newItemName, setNewItemName] = useState("");
  const [selectedColor, setSelectedColor] = useState(predefinedColors[0]);

  const settings = settingsData?.data || [];
  const currentItems = settings.filter((s: any) => s.type === activeTab);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    try {
      const payload = {
        type: activeTab,
        name: newItemName.trim(),
        color: activeTab === "STATUS" ? selectedColor : undefined,
      };
      await createSetting(payload).unwrap();
      setNewItemName("");
      toast.success("Added successfully");
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to add item");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      await deleteSetting(id).unwrap();
      toast.success("Deleted successfully");
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to delete item");
    }
  };

  const getTabDescription = (tab: string) => {
    switch (tab) {
      case "STATUS":
        return "Manage the different stages of your pipeline (e.g., Hot, Warm, Negotiating).";
      case "SOURCE":
        return "Track where your leads are coming from (e.g., Facebook, Referral).";
      case "ACTION_TYPE":
        return "Define the types of follow-up actions (e.g., Call, Meeting, Email).";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-white">
        <DialogHeader>
          <DialogTitle>Lead Settings</DialogTitle>
          <DialogDescription>
            Customize the dropdown options used in the Lead management module.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="STATUS">Statuses</TabsTrigger>
            <TabsTrigger value="SOURCE">Sources</TabsTrigger>
            <TabsTrigger value="ACTION_TYPE">Action Types</TabsTrigger>
          </TabsList>
          
          <div className="mt-4 mb-2 text-sm text-slate-500">
            {getTabDescription(activeTab)}
          </div>

          <div className="space-y-6 mt-4">
            {/* Add New Form */}
            <form onSubmit={handleCreate} className="flex items-end gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex-1 space-y-2">
                <Label>New {activeTab.replace("_", " ").toLowerCase()} name</Label>
                <Input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g., Facebook Ads"
                  className="bg-white"
                />
              </div>
              
              {activeTab === "STATUS" && (
                <div className="space-y-2">
                  <Label>Badge Color</Label>
                  <div className="flex items-center gap-1.5 h-9 px-2 bg-white rounded-md border border-slate-200">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-5 h-5 rounded-full transition-transform ${
                          selectedColor === color ? "scale-110 ring-2 ring-offset-1 ring-slate-400" : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              <Button type="submit" disabled={isCreating || !newItemName.trim()}>
                {isCreating ? <Loader className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </form>

            {/* List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {isLoading ? (
                <div className="flex justify-center p-4">
                  <Loader className="h-6 w-6 animate-spin text-teal-600" />
                </div>
              ) : currentItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No items added yet.
                </div>
              ) : (
                currentItems.map((item: any) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm group hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-slate-300" />
                      {activeTab === "STATUS" ? (
                        <Badge
                          variant="outline"
                          style={{
                            backgroundColor: item.color ? `${item.color}20` : undefined,
                            color: item.color || undefined,
                            borderColor: item.color ? `${item.color}50` : undefined,
                          }}
                        >
                          {item.name}
                        </Badge>
                      ) : (
                        <span className="font-medium text-slate-700">{item.name}</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isDeleting}
                      onClick={() => handleDelete(item._id)}
                      className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Tabs>
        
        <div className="flex justify-end pt-4 border-t border-slate-100 mt-2">
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
