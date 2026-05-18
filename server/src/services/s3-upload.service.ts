import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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
    const fileExtension = fileName.split('.').pop() || 'bin';
    const uniqueFileName = `${crypto.randomUUID()}.${fileExtension}`;
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

export default {
    generatePresignedUploadUrl,
};
