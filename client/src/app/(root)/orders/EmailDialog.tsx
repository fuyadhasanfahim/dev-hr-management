import React, { useState, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import { IOrder, OrderStatus } from "@/types/order.type";
import { useGetClientEmailsQuery } from "@/redux/features/client/clientApi";
import { MultiSelect } from "@/components/ui/multi-select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: IOrder | null;
    status: OrderStatus;
    onSend: (message: string, downloadLink?: string, selectedEmails?: string[]) => void;
    isLoading?: boolean;
}

interface ClientEmail {
    label: string;
    email: string;
    type: string;
}

const defaultTemplates: Partial<Record<OrderStatus, string>> = {
    active:
        "Hi {clientName},\n\nWe have received your upfront payment, and your project '{orderName}' is now ACTIVE!\n\nOur team has started working on your requirements. We will keep you updated on the progress.\n\nBest regards,\nWeb Briks Team",
    in_progress:
        "Hi {clientName},\n\nWe wanted to let you know that your order '{orderName}' is now IN PROGRESS.\n\nOur designers and developers are currently working on the implementation. You can expect further updates soon.\n\nBest regards,\nWeb Briks Team",
    quality_check:
        "Hi {clientName},\n\nYour order '{orderName}' has moved to the QUALITY CHECK stage.\n\nWe are currently reviewing the work to ensure it meets our high standards before delivering it to you.\n\nBest regards,\nWeb Briks Team",
    revision:
        "Hi {clientName},\n\nWe have started working on the REVISIONS for your order '{orderName}'.\n\nWe will notify you once the requested changes have been implemented and are ready for another review.\n\nBest regards,\nWeb Briks Team",
    pending_delivery:
        "Hi {clientName},\n\nYour order '{orderName}' is ready for delivery!\n\nYou can review the project deliverables using the link below:\n{downloadLink}\n\nPlease complete the scheduled 30% delivery payment to unlock and access your final files.\n\nBest regards,\nWeb Briks Team",
    pending_final:
        "Hi {clientName},\n\nWe are reaching the final stages of your project '{orderName}'.\n\nPlease complete the final 20% payment to close the project and receive all final assets and documentation.\n\nBest regards,\nWeb Briks Team",
    cancelled:
        "Hi {clientName},\n\nUnfortunately, your order '{orderName}' has been cancelled.\n\nOur team has stopped work on this order. If you have any questions or feel this is a mistake, please reach out to us by replying to this email.\n\nBest regards,\nWeb Briks Team",
    completed:
        "Hi {clientName},\n\nYour order '{orderName}' has been marked as completed successfully!\n\nWe have finished processing your requests. Please review the result at your convenience.\n\nBest regards,\nWeb Briks Team",
    delivered:
        "Hi {clientName},\n\nGood news! Your order '{orderName}' has been finally delivered!\n\nYou can download and view your completed files using the link below:\n{downloadLink}\n\nLet us know if you have any questions.\n\nBest regards,\nWeb Briks Team",
};

export const EmailDialog: React.FC<EmailDialogProps> = ({
    open,
    onOpenChange,
    order,
    status,
    onSend,
    isLoading,
}) => {
    const [message, setMessage] = useState("");
    const [downloadLink, setDownloadLink] = useState("");
    const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
    const [prevOrderAndStatus, setPrevOrderAndStatus] = useState<{ id: string; status: OrderStatus } | null>(null);

    const client = order?.clientId && typeof order.clientId === "object" ? order.clientId : null;
    const clientId = client?._id || (typeof order?.clientId === "string" ? order.clientId : undefined);
    const { data: emailsData, isLoading: isLoadingEmails } = useGetClientEmailsQuery(clientId!, {
        skip: !clientId || !open,
    });

    const emailOptions = useMemo(() => {
        if (!emailsData) return [];
        return (emailsData as ClientEmail[]).map((item) => ({
            label: `${item.label} (${item.email}) - ${item.type}`,
            value: item.email,
        }));
    }, [emailsData]);

    if (open && order && status && (order._id !== prevOrderAndStatus?.id || status !== prevOrderAndStatus?.status)) {
        setPrevOrderAndStatus({ id: order._id, status });
        
        const tmpl = defaultTemplates[status] || `Status updated to ${status}.`;
        const msg = tmpl
            .replace("{clientName}", client?.name || "Client")
            .replace("{orderName}", order.orderName || "Order");

        setMessage(msg);
        setDownloadLink("");
        
        if (client?.emails?.[0]) {
            setSelectedEmails([client.emails[0]]);
        } else {
            setSelectedEmails([]);
        }
    }

    const handleSend = () => {
        let finalMessage = message;
        if (status === 'delivered' || status === 'pending_delivery') {
            finalMessage = finalMessage.replace("{downloadLink}", downloadLink || 'No link provided');
        }
        onSend(finalMessage, downloadLink, selectedEmails);
    };

    if (!order) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] border-slate-500/20 backdrop-blur-xl bg-card/95">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-primary" />
                        Send Email Notification
                    </DialogTitle>
                    <DialogDescription>
                        Customise the email that will be sent to <strong>{client?.name || "Client"}</strong> regarding the order status changing to <strong>{status}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[65vh] pr-4 -mr-4">
                    <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="recipientEmails">Recipient Emails (Multi-select)</Label>
                        {isLoadingEmails ? (
                            <div className="h-10 w-full flex items-center justify-center border rounded-md bg-muted/20">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                                <span className="text-xs text-muted-foreground">Loading contact list...</span>
                            </div>
                        ) : (
                            <MultiSelect
                                options={emailOptions}
                                onChange={setSelectedEmails}
                                selected={selectedEmails}
                                placeholder="Select recipients..."
                                className="w-full"
                            />
                        )}
                        <p className="text-[10px] text-muted-foreground">
                            Selecting multiple emails will send the update to all chosen recipients.
                        </p>
                    </div>

                    {(status === "delivered" || status === "pending_delivery") && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                            <Label htmlFor="downloadLink">Project Download Link</Label>
                            <Input
                                id="downloadLink"
                                placeholder="https://..."
                                value={downloadLink}
                                onChange={(e) => setDownloadLink(e.target.value)}
                                className="bg-muted/30 focus-visible:ring-primary/30"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Providing this link allows the client to view the deliverables. They will be prompted to pay the 30% delivery fee to unlock full access.
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="message">Email Message</Label>
                        <Textarea
                            id="message"
                            rows={10}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="font-mono text-xs bg-muted/30 focus-visible:ring-primary/30 resize-none"
                        />
                        <div className="flex justify-between items-center mt-2">
                            <p className="text-[10px] text-muted-foreground italic">
                                {(status === "delivered" || status === "pending_delivery") && "Note: Ensure {downloadLink} remains in the text for auto-replacement."}
                            </p>
                            <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                                {selectedEmails.length} recipient(s) selected
                            </span>
                        </div>
                    </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSend} 
                        disabled={isLoading || (status === 'delivered' && !downloadLink) || selectedEmails.length === 0}
                        className="min-w-[140px]"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Sending...
                            </>
                        ) : "Update Status & Send"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

