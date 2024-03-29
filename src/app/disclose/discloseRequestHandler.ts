import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { render } from '@gemeentenijmegen/webapp';
import { RequestTypeHandler, handlerTypeMap } from './RequestTypeHandler';
import * as dislosureTemplate from './templates/disclose.mustache';
import * as confirmationTemplate from './templates/discloseResultConfirmed.mustache';
import { YiviApi } from '../util/YiviApi';

const yivi = new YiviApi();
const init = yivi.init();

export interface DiscloseRequestHandlerRequest {
  cookies: string;
  action: string;
  type?: string;
}

export class DiscloseRequestHandler {
  private dynamoDBClient: DynamoDBClient;
  constructor(dynamoDBClient: DynamoDBClient) {
    this.dynamoDBClient = dynamoDBClient;
  }

  async handleRequest(params: DiscloseRequestHandlerRequest) {
    // Make sure we are initalized
    await init;

    // Check if we have a session
    let session = new Session(params.cookies, this.dynamoDBClient, {
      ttlInMinutes: parseInt(process.env.SESSION_TTL_MIN ?? '15'),
    });
    const hasSession = await session.init();

    const handler = getHandlerForType(this.dynamoDBClient, params.type);


    if (params.action === 'result' && hasSession !== false) {
      return this.handleDisclosureResultRequest(handler, session);
    } else if (params.action === 'confirm' && hasSession !== false) {
      return this.handleConfirmationRequest(handler, session);
    }
    return this.handleStartDisclosureRequest(handler, session);
  }

  private async handleStartDisclosureRequest(handler: RequestTypeHandler, session: Session) {
    console.log('Handling start disclosure request');
    // 1. start yivi session
    let base64YiviSession = undefined;
    let requestorToken = undefined;
    let error = undefined;
    try {
      const request = handler.getDisclosureRequest();
      const disclosureSession = await yivi.startDisclosureSession(request);
      if (disclosureSession.error) {
        throw new Error(`Error response from yivi api client: ${disclosureSession.error}`);
      }
      requestorToken = disclosureSession.token;
      base64YiviSession = Buffer.from(JSON.stringify(disclosureSession), 'utf-8').toString('base64');
    } catch (err) {
      console.error(err);
      error = 'Er is iets fout gegaan bij het inladen van de medewerkersgegevens in de Yivi app. Probeer het later opnieuw.';
    }

    // 2. Store the requestorToken in the user session
    if (!error) {
      try {
        await session.createSession({
          token: { S: requestorToken },
        });
      } catch (err: any) {
        console.error(err);
        error = 'Er is iets fout gegaan bij het checken van de medewerkersgegevens via de Yivi app. Probeer het later opnieuw.';
      }
    }

    // 3. Show page and render QR code
    const data = {
      title: handler.getTitle(),
      shownav: false,
      error: error,
      yiviServer: `https://${yivi.getHost()}`,
      yiviFullSession: base64YiviSession,
    };

    // render page
    const html = await render(data, dislosureTemplate.default);
    return Response.html(html, 200, session.getCookie());

    // 3. User will be redirected to this page with the ?action=result flag by the frontend

  }

  private async handleDisclosureResultRequest(handler: RequestTypeHandler, session: Session) {
    console.log('Handling disclosure result request');

    // 1. Get requestorToken from user session
    const requestorToken = session.getValue('token');
    if (!requestorToken) {
      return Response.redirect('/disclose');
    }

    // 2. Get the session results from the Yivi server
    let result = undefined;
    let error = undefined;
    try {
      const response = await yivi.getSessionResult(requestorToken);
      validateDisclosureResponse(response);
      result = await handler.handleDisclosureRequest(response, session);
    } catch (err) {
      console.error(err);
      error = 'Er is iets fout gegaan bij het checken van de medewerkersgegevens via de Yivi app. Probeer het later opnieuw.';
    }

    // 4. Show page and render QR code
    const data = {
      title: handler.getTitle(),
      shownav: false,
      result: result,
      error: error,
    };

    // render page
    const template = handler.getResultTemplate();
    const html = await render(data, template);
    return Response.html(html, 200, session.getCookie());

    // 5. If user confirms the user is redirected with the ?action=confirm flag
  }

  private async handleConfirmationRequest(handler: RequestTypeHandler, session: Session) {
    console.log('Handling confirmation request');

    let message = undefined;
    let error = undefined;
    try {
      message = await handler.confirmRequest(session);
    } catch (err) {
      console.error(err);
      error = 'Er ging iets fout bij het opslaan van de gegevens';
    }

    const data = {
      title: handler.getTitle(),
      shownav: false,
      message: message,
      error: error,
    };

    const html = await render(data, confirmationTemplate.default);
    return Response.html(html, 200, session.getCookie());
  }

}


function validateDisclosureResponse(result: any) {
  if (!result || result.error) {
    throw new Error('Error response from yivi api client: result');
  }
  if (!result.proofStatus || result.proofStatus !== 'VALID') {
    throw new Error('Invalid proof received from server');
  }
  if (!result.disclosed) {
    throw new Error('No data is disclosed in the session');
  }
}

function getHandlerForType(client: DynamoDBClient, type?: string) {
  const handler = handlerTypeMap[type ?? 'age'](client);
  return handler;
}
