import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = TABLES.NOTIFICATIONS;

export const createNotification = async (data) => {
  const item = {
    notificationId: `NOTIF#${uuidv4()}`,
    employeeCode: data.employeeCode,
    title: data.title || '',
    message: data.message || '',
    type: data.type || 'INFO',
    isRead: false,
    createdAt: new Date().toISOString(),
    metadata: data.metadata || {},
  };

  await dynamoDB.put({
    TableName: TABLE_NAME,
    Item: item,
  }).promise();

  return item;
};

export const getNotificationsByEmployeeCode = async (employeeCode) => {
  const result = await dynamoDB.scan({
    TableName: TABLE_NAME,
    FilterExpression: '#employeeCode = :employeeCode',
    ExpressionAttributeNames: {
      '#employeeCode': 'employeeCode',
    },
    ExpressionAttributeValues: {
      ':employeeCode': employeeCode,
    },
  }).promise();
  return result.Items || [];
};

