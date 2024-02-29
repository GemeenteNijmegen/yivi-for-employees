import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { render } from '@gemeentenijmegen/webapp';
import * as issueTemplate from './templates/issue.mustache';
import { YiviApi, YiviCard } from '../util/YiviApi';

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

    // 1a. Collect info from session
    const name = session.getValue('name');
    const email = session.getValue('email');
    // const groups = JSON.parse(session.getValue('groups'));


    // 1b. Colelct info from other sources (microsoft graph / HR system) (optional)
    // TODO look into this


    // 2. Construct yivi cards
    const now = new Date();
    const in4Months = Math.floor(new Date().setMonth(now.getMonth() + 4) / 1000);
    const card: YiviCard = {
      demoReference: '',
      reference: '',
      expiration: in4Months,
      attributes: {
        email: email,
        werktBijGemeenteNijmegen: 'ja',
      },
    };


    // 3. Start session on yivi issue server
    let yiviSession = undefined;
    try {
      const yivi = new YiviApi();
      yiviSession = await yivi.startIssueSession([card]);

    } catch (error) {
      console.error(error);
    }


    // 4. Show page and render QR code
    const data = {
      title: 'Uitgifte',
      shownav: true,
      name: name,
      error: yiviSession === undefined,
      // TODO add session ptr data here
    };

    // render page
    const html = await render(data, issueTemplate.default);
    return Response.html(html, 200, session.getCookie());
  }
}
