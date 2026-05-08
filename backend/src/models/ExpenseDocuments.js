/**
 * ExpenseDocuments Model
 * 
 * Data access layer for ExpenseDocuments DynamoDB table.
 * Manages document attachments for expenses (receipts, invoices, etc.).
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = TABLES.EXPENSE_DOCUMENTS;

/**
 * Get document by ID
 * @param {string} documentId - Document ID
 * @returns {Promise<Object>} Document record
 */
export const getDocumentById = async (documentId) => {
  const result = await dynamoDB.get({
    TableName: TABLE_NAME,
    Key: { documentId },
  }).promise();

  return result.Item || null;
};

/**
 * Get documents by expense ID
 * @param {string} expenseId - Expense ID
 * @returns {Promise<Array>} Array of document records
 */
export const getDocumentsByExpenseId = async (expenseId) => {
  const result = await dynamoDB.scan({
    TableName: TABLE_NAME,
    FilterExpression: '#expenseId = :expenseId',
    ExpressionAttributeNames: {
      '#expenseId': 'expenseId',
    },
    ExpressionAttributeValues: {
      ':expenseId': expenseId,
    },
  }).promise();

  return result.Items || [];
};

/**
 * Create new document record
 * @param {Object} documentData - Document data (expenseId, fileUrl, fileName, etc.)
 * @returns {Promise<Object>} Created document record
 */
export const createDocument = async (documentData) => {
  const item = {
    documentId: `DOC#${uuidv4()}`,
    expenseId: documentData.expenseId,
    fileName: documentData.fileName,
    fileUrl: documentData.fileUrl,
    created_by_employee_code: documentData.created_by_employee_code || '',
    created_by_name: documentData.created_by_name || '',
    created_by_role: documentData.created_by_role || '',
    created_by_user_id: documentData.created_by_user_id || '',
    created_by_first_name: documentData.created_by_first_name || '',
    created_by_last_name: documentData.created_by_last_name || '',
    created_by: documentData.created_by || '',
    uploadedAt: new Date().toISOString(),
  };

  await dynamoDB.put({
    TableName: TABLE_NAME,
    Item: item,
  }).promise();

  return item;
};

/**
 * Delete document
 * @param {string} documentId - Document ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteDocument = async (documentId) => {
  await dynamoDB.delete({
    TableName: TABLE_NAME,
    Key: { documentId },
  }).promise();

  return {
    success: true,
    message: 'Document deleted successfully',
  };
};


