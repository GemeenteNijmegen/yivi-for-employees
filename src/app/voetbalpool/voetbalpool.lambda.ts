import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const db = new DynamoDBClient({});

export async function handler(event: APIGatewayProxyEventV2): Promise<ApiGatewayV2Response> {
  try {

    const body = event.body;
    if (!body) {
      throw new HttpError(400, 'No body');
    }
    if (body.length > 400) {
      throw new HttpError(400, 'Too big');
    }

    const obj = JSON.parse(body);
    if (!obj || !obj.email) {
      throw new HttpError(400, 'Invalid body');
    }

    if (!process.env.FOR_ORGANIZATION) {
      validateForNijmegen(obj);
    } else if (process.env.FOR_ORGANIZATION == 'HAN') {
      await validateForHan(obj);
    }


    const check = await db.send(new GetItemCommand({
      Key: { pk: { S: obj.email } },
      TableName: process.env.USER_TABLE_NAME,
    }));

    if (check.Item) { // Al ingevuld
      throw new HttpError(409, 'Je hebt de voetbalpool al ingevuld');
    }

    await db.send(new PutItemCommand({
      TableName: process.env.USER_TABLE_NAME,
      Item: {
        pk: { S: obj.email },
        request: { S: JSON.stringify(obj) },
      },
    }));


    return Response.json({
      message: 'ok',
    });

  } catch (err) {
    console.error(err);
    if (err instanceof HttpError) {
      return Response.error(err.status, err.message);
    }
    return Response.error(500);
  }
};

function validateForNijmegen(obj: any) {
  if (!obj.email.endsWith('@nijmegen.nl')) {
    throw new HttpError(400, 'Not nijmegen');
  }
}

const JWKS = createRemoteJWKSet(new URL('https://ssi.oauth.ver.id/jwks.json'));

async function validateForHan(obj: any) {
  const token = obj.token;
  if (!token) {
    throw new HttpError(400, 'Missing JWT');
  }

  const { payload } = await jwtVerify(token, JWKS);

  if ((payload as any).email != obj.email) {
    throw new Error('Emails do not match');
  }
}


class HttpError extends Error {
  status = 200;
  constructor(status: number, message?: string) {
    super(message);
    this.status = status;
  }
}