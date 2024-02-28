import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { render } from '@gemeentenijmegen/webapp';
import * as homeTemplate from './templates/home.mustache';

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

    // TODO implement
    // 1a. Collect info from session
    // 1b. Colelct info from other sources (microsoft graph / HR system)
    // 2. Construct yivi cards
    // 3. Start session on yivi issue server
    // 4. Show page and render QR code

    const naam = session.getValue('username') ?? 'Onbekende gebruiker';
    const data = {
      title: 'Uitgifte',
      shownav: true,
      volledigenaam: naam,
    };

    // render page
    const html = await render(data, homeTemplate.default);
    return Response.html(html, 200, session.getCookie());
  }
}
