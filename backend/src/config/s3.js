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