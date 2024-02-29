import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { DiscloseRequestHandler } from './discloseRequestHandler';

const dynamoDBClient = new DynamoDBClient({});
const requestHandler = new DiscloseRequestHandler(dynamoDBClient);

function parseEvent(event: APIGatewayProxyEventV2) {
  return {
    cookies: event?.cookies?.join(';') ?? '',
    result: event?.queryStringParameters?.result,
  };
}

export async function handler (event: any, _context: any):Promise<ApiGatewayV2Response> {
  try {
    const params = parseEvent(event);
    return await requestHandler.handleRequest(params.cookies, params.result !== undefined);
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};
