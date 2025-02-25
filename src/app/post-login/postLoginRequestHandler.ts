import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { createHash } from 'crypto';

export class PostLoginRequestHandler {
  private dynamoDBClient: DynamoDBClient;
  constructor(dynamoDBClient: DynamoDBClient) {
    this.dynamoDBClient = dynamoDBClient;
  }

  async handleRequest(cookies: string) {
    let session = new Session(cookies, this.dynamoDBClient, {
      ttlInMinutes: parseInt(process.env.SESSION_TTL_MIN ?? '15'),
    });
    await session.init();
    // User should not be logged in yet and have a status of pre-login (e.g. did the roundtrip to the IDP)
    if (session.isLoggedIn() == false && session.getValue('status') === 'pre-login') {
      return this.handleLoggedinRequest(session);
    }
    return Response.redirect('/login');
  }

  private async handleLoggedinRequest(session: Session) {

    // Get the claims from the session
    const claims = JSON.parse(session.getValue('claims'));
    const profileUsed = session.getValue('profileUsed');
    console.log('profileUsed', profileUsed);
    if (!claims || !profileUsed) {
      return Response.redirect('/login');
    }

    // Try to get the BSN from the claims depending on the profile used.
    console.log('Validating claims...');
    const groups = claims.groups;
    const name = claims.name;
    const email = claims.email;
    if (!groups || !name || !email) {
      return Response.redirect('/login');
    }

    // Do not check if user is employee of nijmegen. The user is in the AD
    // so it might be iRvN, Beuningen or another organization. We will only
    // issue the worksForGemeenteNijmegen=Yes card based on email address.

    // Do some logging for tracking the unique number of authentications later on
    const emailHash = createHash('sha256').update(email).digest('hex');
    console.log('User authenticated: ', emailHash);

    // Create the session and redirect
    try {
      await session.createSession({
        loggedin: { BOOL: true },
        groups: { S: claims.groups },
        name: { S: name },
        email: { S: email },
      });
    } catch (error: any) {
      console.error(error.message);
      return Response.error(500);
    }

    return Response.redirect('/', 302, session.getCookie());
  }

}
