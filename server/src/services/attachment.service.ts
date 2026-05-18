import { generatePresignedUploadUrl } from './s3-upload.service.js';
import { AppError } from '../utils/AppError.js';

const ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validates file parameters and generates a pre-signed S3 upload URL.
 */
export async function requestPresignedUrl({
    fileName,
    fileType,
    fileSize,
    folder,
    referenceId,
}: {
    fileName: string;
    fileType: string;
    fileSize: number;
    folder: 'tickets' | 'chats';
    referenceId: string;
}): Promise<{ uploadUrl: string; fileUrl: string; fileKey: string }> {
    if (!ALLOWED_MIME_TYPES.has(fileType)) {
        throw new AppError('File type not supported. Please upload an image, document, spreadsheet or PDF.', 400);
    }

    if (fileSize > MAX_FILE_SIZE) {
        throw new AppError('File size exceeds the 10MB limit.', 400);
    }

    return await generatePresignedUploadUrl({
        fileName,
        fileType,
        folder,
        referenceId,
    });
}

export default {
    requestPresignedUrl,
};
