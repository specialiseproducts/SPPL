import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

export function getSignedFileUrl(key) {
  const cleanedKey = String(key || '').replace(/^\/+/, '');
  if (!cleanedKey) {
    throw new Error('key is required');
  }

  const bucket = cleanedKey.startsWith('expenses/')
    ? process.env.AWS_S3_BUCKET_NAME
    : process.env.AWS_S3_USER_MANAGEMENT_BUCKET_NAME ||
      process.env.AWS_S3_BUCKET_NAME;

  if (!bucket) {
    throw new Error('S3 bucket is not configured');
  }

  return s3.getSignedUrl('getObject', {
    Bucket: bucket,
    Key: cleanedKey,
    Expires: 60 * 5,
  });
}

