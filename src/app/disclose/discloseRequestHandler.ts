import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { render } from '@gemeentenijmegen/webapp';
import * as issueTemplate from './templates/disclose.mustache';
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
    await session.init();

    if (getResult) {
      return this.handleDisclosureResultRequest(session);
    }
    return this.handleStartDisclosureRequest(session);

  }

  private async handleStartDisclosureRequest(session: Session) {

    // 3. start yivi session
    let base64YiviSession = undefined;
    let error = undefined;
    try {
      const disclosureSession = await yivi.startDisclosureSession(
        [ // And
          [ // Or
            [ // List of attributes
              'irma-demo.gemeente.personalData.BSN',
            ],
          ],
        ],
      );
      if (disclosureSession.error) {
        throw new Error(`Error response from yivi api client: ${disclosureSession.error}`);
      }
      base64YiviSession = Buffer.from(JSON.stringify(disclosureSession), 'utf-8').toString('base64');
    } catch (err) {
      console.error(err);
      error = 'Er is iets fout gegaan bij het inladen van de medewerkersgegevens in de Yivi app. Probeer het later opnieuw.';
    }

    // 4. Show page and render QR code
    const data = {
      title: 'Disclosure',
      shownav: false,
      error: error,
      yiviServer: `https://${yivi.getHost()}`,
      yiviFullSession: base64YiviSession,
    };

    // render page
    const html = await render(data, issueTemplate.default);
    return Response.html(html, 200, session.getCookie());

  }

  private async handleDisclosureResultRequest(session: Session) {

    //yivi.getSessionResult();
    // TODO render result

    // 4. Show page and render QR code
    const data = {
      title: 'Resultaat',
      shownav: true,
      // name: name,
      // error: error,
      yiviServer: `https://${yivi.getHost()}`,
      // yiviFullSession: base64YiviSession,
    };

    // render page
    const html = await render(data, issueTemplate.default);
    return Response.html(html, 200, session.getCookie());
  }
}
