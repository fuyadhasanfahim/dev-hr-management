"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useGetLeadByIdQuery,
  useAddLeadActivityMutation,
  useConvertLeadToClientMutation,
} from "@/redux/features/lead/leadApi";
import { useGetLeadSettingsQuery } from "@/redux/features/lead/leadSettingApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Mail,
  Phone,
  Globe,
  User,
  MessageSquarePlus,
  ArrowRightCircle,
  Activity,
  Loader,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export default function LeadDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: leadData, isLoading, isFetching } = useGetLeadByIdQuery(id);
  const { data: settingsData } = useGetLeadSettingsQuery(undefined);
  const [addActivity, { isLoading: isAddingActivity }] = useAddLeadActivityMutation();
  const [convertLead, { isLoading: isConverting }] = useConvertLeadToClientMutation();

  const statuses = useMemo(
    () => settingsData?.data?.filter((s: any) => s.type === "STATUS") || [],
    [settingsData]
  );
  const actionTypes = useMemo(
    () => settingsData?.data?.filter((s: any) => s.type === "ACTION_TYPE") || [],
    [settingsData]
  );

  const lead = leadData?.data?.lead;
  const activities = leadData?.data?.activities || [];

  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activityNote, setActivityNote] = useState("");
  const [newStatus, setNewStatus] = useState("none");
  const [nextActionType, setNextActionType] = useState("none");
  const [nextActionDate, setNextActionDate] = useState<Date | undefined>(undefined);

  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [clientId, setClientId] = useState("");

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold text-slate-700">Lead not found</h2>
        <Button onClick={() => router.push("/leads")} variant="outline">
          Back to Leads
        </Button>
      </div>
    );
  }

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        activityType: "NOTE_ADDED",
        notes: activityNote,
      };

      if (newStatus !== "none" && newStatus !== lead.status?._id) {
        payload.newStatus = newStatus;
        payload.activityType = "STATUS_CHANGE";
      }

      if (nextActionType !== "none") {
        payload.nextActionType = nextActionType;
        payload.activityType = "FOLLOW_UP_SET";
      }

      if (nextActionDate) {
        payload.nextActionDate = nextActionDate.toISOString();
      }

      await addActivity({ id: lead._id, data: payload }).unwrap();
      toast.success("Activity logged successfully");
      setIsActivityOpen(false);
      setActivityNote("");
      setNewStatus("none");
      setNextActionType("none");
      setNextActionDate(undefined);
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to log activity");
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error("Client ID is required to convert");
      return;
    }
    try {
      const clientData = {
        clientId: clientId,
        name: lead.name || "Unknown",
        emails: lead.email ? [lead.email] : ["temp@temp.com"],
        phone: lead.phone,
        status: "active",
      };
      await convertLead({ id: lead._id, clientData }).unwrap();
      toast.success("Lead converted to Client successfully!");
      setIsConvertOpen(false);
      router.push("/clients");
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to convert lead");
    }
  };

  return (
    <div className="w-full space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/leads")}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {lead.name || lead.phone}
            </h1>
            {lead.status && (
              <Badge
                variant="outline"
                style={{
                  backgroundColor: lead.status.color ? `${lead.status.color}20` : undefined,
                  color: lead.status.color || undefined,
                  borderColor: lead.status.color ? `${lead.status.color}50` : undefined,
                }}
              >
                {lead.status.name}
              </Badge>
            )}
            {lead.isConverted && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                Converted
              </Badge>
            )}
            {isFetching && <Loader className="h-4 w-4 animate-spin text-teal-600" />}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Added on {format(new Date(lead.createdAt), "MMM dd, yyyy")}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            onClick={() => setIsActivityOpen(true)}
            variant="outline"
            className="border-slate-200"
          >
            <MessageSquarePlus className="h-4 w-4 text-blue-600" />
            Log Activity
          </Button>
          {!lead.isConverted && (
            <Button
              onClick={() => setIsConvertOpen(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              <ArrowRightCircle className="h-4 w-4" />
              Convert to Client
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground/90">
                <User className="h-4 w-4 text-muted-foreground" />
                Contact Info
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground/60 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">{lead.phone}</p>
                  <p className="text-muted-foreground">Phone</p>
                </div>
              </div>
              {lead.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground/60 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">{lead.email}</p>
                    <p className="text-muted-foreground">Email</p>
                  </div>
                </div>
              )}
              {lead.website && (
                <div className="flex items-start gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground/60 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">
                      <a
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-600 hover:underline"
                      >
                        {lead.website}
                      </a>
                    </p>
                    <p className="text-muted-foreground">Website</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground/90">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Lead Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground mb-1">Priority</p>
                  <Badge variant="secondary">{lead.priority || "Medium"}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Source</p>
                  <span className="font-medium">{lead.source?.name || "N/A"}</span>
                </div>
              </div>
              {lead.nextActionDate && (
                <div className="pt-3 border-t border-border">
                  <p className="text-muted-foreground flex items-center gap-1.5 mb-1">
                    <Calendar className="h-3.5 w-3.5" /> Next Action
                  </p>
                  <p className="font-medium text-foreground">
                    {lead.nextActionType?.name} on{" "}
                    {format(new Date(lead.nextActionDate), "MMM dd, yyyy")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="shadow-sm h-full">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold text-foreground/90">
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {activities.map((act: any, idx: number) => (
                  <div
                    key={act._id}
                    className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted text-muted-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      {act.activityType === "CREATED" ? (
                        <User className="h-4 w-4 text-teal-600" />
                      ) : act.activityType === "STATUS_CHANGE" ? (
                        <Activity className="h-4 w-4 text-blue-600" />
                      ) : act.activityType === "CONVERTED" ? (
                        <UserCheck className="h-4 w-4 text-amber-600" />
                      ) : (
                        <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card p-4 rounded-xl border border-border shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-foreground/90 text-sm capitalize">
                          {act.activityType.replace(/_/g, " ").toLowerCase()}
                        </span>
                        <span className="text-xs text-muted-foreground/80 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(act.createdAt), "MMM dd, hh:mm a")}
                        </span>
                      </div>
                      
                      {act.previousStatus && act.newStatus && (
                        <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                          Status changed: 
                          <Badge variant="secondary" className="text-xs">{act.previousStatus.name}</Badge> 
                          <ArrowRightCircle className="h-3 w-3 text-slate-400" /> 
                          <Badge variant="outline" className="text-xs">{act.newStatus.name}</Badge>
                        </div>
                      )}

                      {act.notes && (
                        <p className="text-sm text-foreground/80 bg-muted/50 p-2.5 rounded-lg border border-border">
                          {act.notes}
                        </p>
                      )}

                      {act.nextActionType && act.nextActionDate && (
                        <p className="text-xs text-teal-700 mt-2 flex items-center gap-1 bg-teal-50 inline-flex px-2 py-1 rounded">
                          <Calendar className="h-3 w-3" />
                          Set {act.nextActionType.name} for {format(new Date(act.nextActionDate), "MMM dd, yyyy")}
                        </p>
                      )}

                      <div className="text-xs text-muted-foreground mt-2 text-right">
                        by {act.createdBy?.firstName} {act.createdBy?.lastName}
                      </div>
                    </div>
                  </div>
                ))}

                {activities.length === 0 && (
                  <div className="text-center text-muted-foreground py-10">
                    No activities recorded yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Activity Modal */}
      <Dialog open={isActivityOpen} onOpenChange={setIsActivityOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
            <DialogDescription>
              Record a note, update the status, or schedule a follow-up.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddActivity} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                required
                value={activityNote}
                onChange={(e) => setActivityNote(e.target.value)}
                placeholder="What happened? E.g., Had a great call..."
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Update Status (Optional)</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Current Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Don't Change</SelectItem>
                    {statuses.map((s: any) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Next Action (Optional)</Label>
                <Select value={nextActionType} onValueChange={setNextActionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {actionTypes.map((a: any) => (
                      <SelectItem key={a._id} value={a._id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {nextActionType !== "none" && (
              <div className="space-y-2 flex flex-col">
                <Label>Next Action Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background border-border",
                        !nextActionDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="h-4 w-4" />
                      {nextActionDate ? format(nextActionDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={nextActionDate}
                      onSelect={setNextActionDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsActivityOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isAddingActivity}>
                {isAddingActivity && <Loader className="h-4 w-4 animate-spin" />}
                Log Activity
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Convert to Client Modal */}
      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Convert to Client</DialogTitle>
            <DialogDescription>
              Assign a unique Client ID to convert this prospect into a full client profile.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConvert} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Assign Client ID</Label>
              <Input
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g., CLT-1001"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsConvertOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isConverting} className="bg-teal-600 hover:bg-teal-700">
                {isConverting && <Loader className="h-4 w-4 animate-spin" />}
                Convert Lead
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
