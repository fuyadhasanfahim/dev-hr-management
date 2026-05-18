import { useState, useCallback } from 'react';
import { useSupportStore } from '../store/useSupportStore';
import { toast } from 'sonner';

interface S3UploadResult {
    url: string;
    fileName: string;
    fileType: string;
    fileSize: number;
}

export function useS3Upload() {
    const { token } = useSupportStore();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

    const uploadFile = useCallback(async (file: File, referenceId?: string): Promise<S3UploadResult> => {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. Request PUT pre-signed URL from API
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const response = await fetch('/api/support/presigned-url', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        folder: 'support',
                        referenceId,
                    }),
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(errText || 'Failed to request upload signature.');
                }

                const { data } = await response.json();
                const { uploadUrl, downloadUrl } = data;

                // 2. Perform direct browser-to-S3 upload with XMLHttpRequest to track progress
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', uploadUrl, true);
                xhr.setRequestHeader('Content-Type', file.type);

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const progress = Math.round((event.loaded / event.total) * 100);
                        setUploadProgress((prev) => ({
                            ...prev,
                            [file.name]: progress,
                        }));
                    }
                };

                xhr.onload = () => {
                    if (xhr.status === 200) {
                        resolve({
                            url: downloadUrl,
                            fileName: file.name,
                            fileType: file.type,
                            fileSize: file.size,
                        });
                    } else {
                        reject(new Error(`S3 upload failed with status ${xhr.status}`));
                    }
                };

                xhr.onerror = () => {
                    reject(new Error('S3 upload network error.'));
                };

                xhr.send(file);
            } catch (err: any) {
                toast.error(`Upload error: ${err.message || 'Network failure'}`);
                reject(err);
            }
        });
    }, [token]);

    const uploadMultipleFiles = useCallback(async (files: FileList | File[], referenceId?: string): Promise<S3UploadResult[]> => {
        setIsUploading(true);
        const fileList = Array.from(files);
        const results: S3UploadResult[] = [];

        try {
            for (const file of fileList) {
                setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));
                const res = await uploadFile(file, referenceId);
                results.push(res);
            }
            return results;
        } finally {
            setIsUploading(false);
            setUploadProgress({});
        }
    }, [uploadFile]);

    return {
        isUploading,
        uploadProgress,
        uploadMultipleFiles,
        uploadFile,
    };
}
