#!/usr/bin/env node
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
const tableName =
  process.env.DYNAMODB_TABLE_SALES_PLANNER_EVENTS ||
  process.env.DYNAMODB_TABLE_PLANNER_EVENTS ||
  'planner_events';

const doc = new AWS.DynamoDB.DocumentClient({ region });

const result = await doc.scan({ TableName: tableName }).promise();
const rows = (result.Items || [])
  .filter((row) => !row.is_deleted)
  .map((row) => ({
    eventId: row.eventId,
    visitDate: row.visitDate,
    status: row.status,
    nextAction: row.nextAction,
    newVisitDate: row.newVisitDate,
    parentEventId: row.parentEventId || null,
    organizationName: row.organizationName,
    contactFullName: row.contactFullName,
  }))
  .sort((a, b) => String(a.visitDate || '').localeCompare(String(b.visitDate || '')));

console.log(JSON.stringify(rows, null, 2));

