import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

const client = new DynamoDBClient({});

export async function handler (event: APIGatewayProxyEventV2, _context: any) :Promise<ApiGatewayV2Response> {
  try {

    const body = event.body;
    if (!body) {
      return Response.error(400, 'No body');
    }

    const obj = JSON.parse(body);
    if (!obj || !obj.email) {
      return Response.error(400, 'Invalid body');
    }

    if (!obj.email.endsWith('@nijmegen.nl')) {
      return Response.error(400, 'Not nijmegen');
    }

    const check = await client.send(new GetItemCommand({
      Key: { pk: { S: obj.email } },
      TableName: process.env.USER_TABLE_NAME,
    }));

    if (!check.Item) {
      await client.send(new PutItemCommand({
        TableName: process.env.USER_TABLE_NAME,
        Item: {
          pk: { S: obj.email },
          request: { S: JSON.stringify(obj) },
        },
      }));
    }

    return Response.json({
      message: 'ok',
    });

  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};

