import AWS from 'aws-sdk';
import multer from 'multer';
import multerS3 from 'multer-s3';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Dedicated S3 config for User Management uploads.
 * Set AWS_S3_USER_MANAGEMENT_BUCKET_NAME to use a separate bucket; otherwise falls back to AWS_S3_BUCKET_NAME (same credentials, distinct key prefix).
 */
const bucket =
  process.env.AWS_S3_USER_MANAGEMENT_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME;

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const docExt = /^(pdf|doc|docx)$/i;
const experienceExt = /^(pdf|jpe?g|png|xls|xlsx|doc|docx)$/i;
const photoExt = /^(jpe?g|png)$/i;

function extensionOf(filename) {
  const base = (filename || '').split('.').pop();
  return base || '';
}

export function userManagementFileFilter(req, file, cb) {
  const ext = extensionOf(file.originalname);
  if (file.fieldname === 'documents' && docExt.test(ext)) {
    return cb(null, true);
  }
  if (file.fieldname === 'pastExperience' && experienceExt.test(ext)) {
    return cb(null, true);
  }
  if (file.fieldname === 'profilePhoto' && photoExt.test(ext)) {
    return cb(null, true);
  }
  cb(new Error(`Invalid file type for ${file.fieldname}. Check allowed extensions.`));
}

export const uploadUserManagementFiles = multer({
  storage: multerS3({
    s3,
    bucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key(req, file, cb) {
      const safeName = String(file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      const folder =
        file.fieldname === 'documents'
          ? 'documents'
          : file.fieldname === 'pastExperience'
            ? 'experience'
            : 'profile-photos';
      cb(null, `user-management/${folder}/${Date.now()}-${safeName}`);
    },
  }),
  fileFilter: userManagementFileFilter,
});
