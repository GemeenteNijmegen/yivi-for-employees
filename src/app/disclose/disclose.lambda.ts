import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { DiscloseRequestHandler, DiscloseRequestHandlerRequest } from './discloseRequestHandler';

const dynamoDBClient = new DynamoDBClient({});
const requestHandler = new DiscloseRequestHandler(dynamoDBClient);

function parseEvent(event: APIGatewayProxyEventV2) : DiscloseRequestHandlerRequest {
  return {
    cookies: event?.cookies?.join(';') ?? '',
    action: event?.queryStringParameters?.action ?? 'start',
    type: event?.queryStringParameters?.type,
  };
}

export async function handler (event: any, _context: any):Promise<ApiGatewayV2Response> {
  try {
    const params = parseEvent(event);
    return await requestHandler.handleRequest(params);
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};
