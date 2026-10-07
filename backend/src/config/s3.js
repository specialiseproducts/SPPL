import AWS from 'aws-sdk';
import multer from 'multer';
import multerS3 from 'multer-s3';
import dotenv from 'dotenv';

dotenv.config();

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const EXPENSE_DOC_EXT = /\.(doc|docx|pdf|jpg|jpeg|png|xls|xlsx)$/i;
const DAILY_PLANNER_DOC_EXT = /\.(doc|docx|pdf|jpg|jpeg|png|xls|xlsx|ppt|pptx)$/i;

function expenseSupportingDocFilter(req, file, cb) {
  const name = String(file?.originalname || '');
  if (!EXPENSE_DOC_EXT.test(name)) {
    const err = new Error(
      'Invalid file type. Allowed: DOC, DOCX, PDF, JPG, JPEG, PNG, XLS, XLSX'
    );
    err.statusCode = 400;
    return cb(err);
  }
  cb(null, true);
}

function dailyPlannerDocFilter(req, file, cb) {
  const name = String(file?.originalname || '');
  if (!DAILY_PLANNER_DOC_EXT.test(name)) {
    const err = new Error(
      'Invalid file type. Allowed: DOC, DOCX, PDF, JPG, JPEG, PNG, XLS, XLSX, PPT, PPTX',
    );
    err.statusCode = 400;
    return cb(err);
  }
  cb(null, true);
}

export const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const fileName = `expenses/${Date.now()}-${file.originalname}`;
      cb(null, fileName);
    },
  }),
  fileFilter: expenseSupportingDocFilter,
});

/** Daily Planner task document upload (images, PDF, Office, PowerPoint). */
export const uploadDailyPlannerDocument = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const safeName = String(file.originalname || 'document').replace(/[^\w.\-()+ ]+/g, '_');
      const fileName = `daily-planner/${Date.now()}-${safeName}`;
      cb(null, fileName);
    },
  }),
  fileFilter: dailyPlannerDocFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});