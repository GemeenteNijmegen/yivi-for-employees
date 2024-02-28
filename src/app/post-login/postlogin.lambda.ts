import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { PostLoginRequestHandler } from './postLoginRequestHandler';

const apiClient = new ApiClient();
const dynamoDBClient = new DynamoDBClient({});
const requestHandler = new PostLoginRequestHandler(dynamoDBClient, apiClient);

function parseEvent(event: APIGatewayProxyEventV2) {
  return {
    cookies: event?.cookies?.join(';') ?? '',
  };
}

export async function handler (event: any, _context: any):Promise<ApiGatewayV2Response> {
  try {
    const params = parseEvent(event);
    return await requestHandler.handleRequest(params.cookies);

  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};
