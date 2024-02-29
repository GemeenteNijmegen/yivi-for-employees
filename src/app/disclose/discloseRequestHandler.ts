import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { render } from '@gemeentenijmegen/webapp';
import * as dislosureTemplate from './templates/disclose.mustache';
import { YiviApi } from '../util/YiviApi';

const yivi = new YiviApi();
const init = yivi.init();

export class DiscloseRequestHandler {
  private dynamoDBClient: DynamoDBClient;
  constructor(dynamoDBClient: DynamoDBClient) {
    this.dynamoDBClient = dynamoDBClient;
  }

  async handleRequest(cookies: string, getResult: boolean) {
    // Make sure we are initalized
    await init;

    // Check if we have a session
    let session = new Session(cookies, this.dynamoDBClient, {
      ttlInMinutes: parseInt(process.env.SESSION_TTL_MIN ?? '15'),
    });
    const hasSession = await session.init();

    if (getResult && hasSession !== false) {
      return this.handleDisclosureResultRequest(session);
    }

    return this.handleStartDisclosureRequest(session);
  }

  private async handleStartDisclosureRequest(session: Session) {

    // 1. start yivi session
    let base64YiviSession = undefined;
    let requestorToken = undefined;
    let error = undefined;
    try {
      const disclosureSession = await yivi.startDisclosureSession(
        [ // And
          [ // Or
            [ // List of attributes
              'irma-demo.gemeente.personalData.bsn',
            ],
          ],
        ],
      );
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
    try {
      await session.createSession({
        token: { S: requestorToken },
      });
    } catch (err: any) {
      console.error(err);
      error = 'Er is iets fout gegaan bij het checken van de medewerkersgegevens via de Yivi app. Probeer het later opnieuw.';
    }

    // 3. Show page and render QR code
    const data = {
      title: 'Check',
      shownav: false,
      error: error,
      yiviServer: `https://${yivi.getHost()}`,
      yiviFullSession: base64YiviSession,
    };

    // render page
    const html = await render(data, dislosureTemplate.default);
    return Response.html(html, 200, session.getCookie());

    // 3. User will be redirected to this page with the ?result flag by the frontend

  }

  private async handleDisclosureResultRequest(session: Session) {

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

      const disclosedAttributeBsn = response.disclosed[0][0];
      result = {
        attr: disclosedAttributeBsn.id,
        value: disclosedAttributeBsn.rawvalue,
      };

    } catch (err) {
      console.error(err);
      error = 'Er is iets fout gegaan bij het checken van de medewerkersgegevens via de Yivi app. Probeer het later opnieuw.';
    }

    // 4. Show page and render QR code
    const data = {
      title: 'Check',
      shownav: false,
      yiviServer: `https://${yivi.getHost()}`,
      result: result,
      error: error,
    };

    // render page
    const html = await render(data, dislosureTemplate.default);
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