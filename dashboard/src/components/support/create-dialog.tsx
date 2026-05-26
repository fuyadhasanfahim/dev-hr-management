import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useS3Upload } from '../../hooks/useS3Upload';
import { useSupportStore } from '../../store/useSupportStore';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, UploadCloud, FileText, CheckCircle2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { AttachmentPreview } from './support-elements';

interface CreateTicketDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function CreateTicketDialog({ open, onOpenChange, onSuccess }: CreateTicketDialogProps) {
    const { token } = useSupportStore();
    const { isUploading, uploadProgress, uploadMultipleFiles } = useS3Upload();

    const [subject, setSubject] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
    const [text, setText] = useState('');
    const [attachments, setAttachments] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // React Dropzone configuration
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: async (acceptedFiles) => {
            if (acceptedFiles.length === 0) return;
            try {
                const results = await uploadMultipleFiles(acceptedFiles);
                setAttachments((prev) => [...prev, ...results]);
                toast.success(`Successfully uploaded ${acceptedFiles.length} file(s) directly to S3.`);
            } catch (err: any) {
                toast.error('Failed to upload some files to S3.');
            }
        },
        maxSize: 10 * 1024 * 1024, // 10MB limit
    });

    const handleRemoveAttachment = (indexToRemove: number) => {
        setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !text.trim()) {
            toast.error('Please enter a ticket subject and description.');
            return;
        }

        setIsSaving(true);
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch('/api/support/tickets', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    subject,
                    text,
                    priority,
                    attachments,
                }),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || 'Failed to submit ticket');
            }

            toast.success('Support ticket submitted successfully!');
            
            // Reset states
            setSubject('');
            setPriority('medium');
            setText('');
            setAttachments([]);
            
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (err: any) {
            toast.error(`Ticket error: ${err.message || 'Server connection failed'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const priorities: Array<{ value: 'low' | 'medium' | 'high' | 'urgent'; label: string; color: string }> = [
        { value: 'low', label: 'Low', color: 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' },
        { value: 'medium', label: 'Medium', color: 'border-sky-500/20 text-sky-600 dark:text-sky-400 bg-sky-500/5' },
        { value: 'high', label: 'High', color: 'border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-500/5' },
        { value: 'urgent', label: 'Urgent', color: 'border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/5 font-semibold animate-pulse' },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-primary" />
                        Create New Support Ticket
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Describe your inquiry or issue below. Attach screenshots, PDFs, or other relevant support files.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {/* SUBJECT */}
                    <div className="space-y-1.5">
                        <Label htmlFor="subject" className="text-xs font-semibold">Ticket Subject</Label>
                        <Input
                            id="subject"
                            placeholder="e.g., Unable to download payroll slips or database query timeout"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            disabled={isSaving || isUploading}
                            className="text-xs"
                            required
                        />
                    </div>

                    {/* URGENCY PRIORITY CHIPS */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold">Priority Urgency</Label>
                        <div className="grid grid-cols-4 gap-2">
                            {priorities.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setPriority(item.value)}
                                    className={`py-2 px-1 text-center rounded-lg border text-xs transition-all cursor-pointer ${
                                        priority === item.value
                                            ? `${item.color} ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900 border-primary font-bold`
                                            : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* TEXTAREA DESCRIPTION */}
                    <div className="space-y-1.5">
                        <Label htmlFor="description" className="text-xs font-semibold">Detailed Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Provide details about your query. Include steps to reproduce if applicable."
                            rows={4}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            disabled={isSaving || isUploading}
                            className="text-xs resize-none"
                            required
                        />
                    </div>

                    {/* AWS S3 DRAG AND DROP AREA */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold">Attachments (S3 File Storage)</Label>
                        
                        <div
                            {...getRootProps()}
                            className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                                isDragActive
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:bg-muted/30 bg-muted/10'
                            }`}
                        >
                            <input {...getInputProps()} />
                            <UploadCloud className="w-6 h-6 text-muted-foreground mx-auto mb-1.5" />
                            <p className="text-xs font-medium text-foreground">
                                {isDragActive ? 'Drop the files here...' : 'Drag & drop support files, or click to browse'}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                Screenshots, Images, PDFs, CVs, or DOCX documents (Up to 10MB each)
                            </p>
                        </div>

                        {/* Real-time upload progress */}
                        {isUploading && (
                            <div className="space-y-2 p-3 bg-muted/40 rounded-lg border">
                                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                    <span>Uploading files directly to AWS S3...</span>
                                </div>
                                {Object.entries(uploadProgress).map(([fileName, progress]) => (
                                    <div key={fileName} className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-muted-foreground truncate">
                                            <span>{fileName}</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <Progress value={progress} className="h-1" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Uploaded attachments preview */}
                        {attachments.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {attachments.map((file, idx) => (
                                    <AttachmentPreview
                                        key={idx}
                                        file={file}
                                        onDelete={() => handleRemoveAttachment(idx)}
                                        className="h-12 w-full py-1 text-xs"
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving || isUploading}
                            className="text-xs cursor-pointer"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving || isUploading || !subject.trim() || !text.trim()}
                            className="text-xs cursor-pointer gap-1.5"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Submitting Ticket...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Submit Ticket
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
