import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import envConfig from '../config/env.config.js';
import crypto from 'crypto';

const s3Client = new S3Client({
    region: envConfig.aws_region || 'us-east-1',
    credentials: {
        accessKeyId: envConfig.aws_access_key_id || 'dummy',
        secretAccessKey: envConfig.aws_secret_access_key || 'dummy',
    },
});

export interface GeneratePresignedUrlParams {
    fileName: string;
    fileType: string;
    folder: 'tickets' | 'chats';
    referenceId: string;
}

/**
 * Generates a pre-signed URL for direct frontend-to-S3 uploads.
 */
export async function generatePresignedUploadUrl({
    fileName,
    fileType,
    folder,
    referenceId,
}: GeneratePresignedUrlParams): Promise<{ uploadUrl: string; fileUrl: string; fileKey: string }> {
    // The sender's file name stays in the key after the id ("<uuid>__Invoice-March.pdf"), so chats and tickets can show
    // it; the id keeps keys unique and unguessable. Only safe ASCII goes into a key.
    const dot = fileName.lastIndexOf('.');
    const fileExtension = (dot > 0 ? fileName.slice(dot + 1) : 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    const base = (dot > 0 ? fileName.slice(0, dot) : fileName)
        .replace(/[^A-Za-z0-9._ -]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/\.{2,}/g, '.')
        .slice(0, 60);
    const uniqueFileName = `${crypto.randomUUID()}__${base || 'file'}.${fileExtension}`;
    const fileKey = `${folder}/${referenceId}/${uniqueFileName}`;

    const command = new PutObjectCommand({
        Bucket: envConfig.aws_bucket_name || 'dummy-bucket',
        Key: fileKey,
        ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    const fileUrl = `https://${envConfig.aws_bucket_name || 'dummy-bucket'}.s3.${envConfig.aws_region || 'us-east-1'}.amazonaws.com/${fileKey}`;

    return {
        uploadUrl,
        fileUrl,
        fileKey,
    };
}

/**
 * Generates a pre-signed GET URL so the browser can view/download a private S3 object.
 */
export async function generatePresignedViewUrl(fileKey: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: envConfig.aws_bucket_name || 'dummy-bucket',
        Key: fileKey,
    });

    return await getSignedUrl(s3Client, command, { expiresIn: 900 });
}

export default {
    generatePresignedUploadUrl,
    generatePresignedViewUrl,
};
