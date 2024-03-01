import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { render } from '@gemeentenijmegen/webapp';
import * as issueTemplate from './templates/issue.mustache';
import { YiviApi, YiviCard } from '../util/YiviApi';

const yivi = new YiviApi();
const init = yivi.init();

export class HomeRequestHandler {
  private dynamoDBClient: DynamoDBClient;
  constructor(dynamoDBClient: DynamoDBClient) {
    this.dynamoDBClient = dynamoDBClient;
  }

  async handleRequest(cookies: string) {
    let session = new Session(cookies, this.dynamoDBClient, {
      ttlInMinutes: parseInt(process.env.SESSION_TTL_MIN ?? '15'),
    });
    await session.init();
    if (session.isLoggedIn() == true) {
      return this.handleLoggedinRequest(session);
    }
    return Response.redirect('/login');
  }

  private async handleLoggedinRequest(session: Session) {

    // Make sure we are initalized
    await init;

    // 1a. Collect info from session
    const name = session.getValue('name');
    const email = session.getValue('email');
    const worksForGemeenteNijmegen = email.endsWith('@nijmegen.nl');
    // const groups = JSON.parse(session.getValue('groups'));
    // const worksForGemeenteNijmegen = groups.includes(process.env.GN_EMPLOYEE_AD_GROUP_UUID) ? 'ja' : 'nee';

    // 1b. Colelct info from other sources (microsoft graph / HR system) (optional)
    // TODO look into this


    // 2. Construct yivi cards
    const now = new Date();
    const in4Months = Math.floor(new Date().setMonth(now.getMonth() + 4) / 1000);
    const card: YiviCard = {
      demoReference: 'irma-demo.nijmegen.employeeData',
      reference: 'pbdf.nijmegen.employeeData',
      expiration: in4Months,
      attributes: {
        email: email,
        worksForGemeenteNijmegen: worksForGemeenteNijmegen,
      },
    };


    // 3. Start session on yivi issue server
    let base64YiviSession = undefined;
    let error = undefined;
    try {
      const yiviSession = await yivi.startIssueSession([card]);
      if (yiviSession.error) {
        throw new Error(`Error response from yivi api client: ${yiviSession.error}`);
      }
      base64YiviSession = Buffer.from(JSON.stringify(yiviSession), 'utf-8').toString('base64');
    } catch (err) {
      console.error(err);
      error = 'Er is iets fout gegaan bij het inladen van de medewerkersgegevens in de Yivi app. Probeer het later opnieuw.';
    }


    // 4. Show page and render QR code
    const data = {
      title: 'Uitgifte',
      shownav: true,
      name: name,
      error: error,
      yiviServer: `https://${yivi.getHost()}`,
      yiviFullSession: base64YiviSession,
    };

    // render page
    const html = await render(data, issueTemplate.default);
    return Response.html(html, 200, session.getCookie());
  }
}
