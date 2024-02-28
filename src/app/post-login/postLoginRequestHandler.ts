import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';
import { BrpApi } from '../util/BrpApi';

export class PostLoginRequestHandler {
  private dynamoDBClient: DynamoDBClient;
  private apiClient: ApiClient;
  constructor(dynamoDBClient: DynamoDBClient, apiClient: ApiClient) {
    this.dynamoDBClient = dynamoDBClient;
    this.apiClient = apiClient;
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
    if (!claims || ! profileUsed) {
      return Response.redirect('/login');
    }

    // Try to get the BSN from the claims depending on the profile used.
    const bsn = this.bsnFromClaims(claims, profileUsed);
    if (!bsn) {
      return Response.redirect('/login');
    }

    // Call BRP to get the username and store it in the session
    try {
      const username = await this.loggedinUserName(bsn.bsn, this.apiClient);
      await session.createSession({
        loggedin: { BOOL: true },
        bsn: { S: bsn.bsn },
        username: { S: username },
      });
    } catch (error: any) {
      console.error(error.message);
      return Response.error(500);
    }

    return Response.redirect('/', 302, session.getCookie());
  }


  async loggedinUserName(bsn: string, apiClient: ApiClient) {
    try {
      const brpApi = new BrpApi(apiClient);
      const brpData = await brpApi.getBrpData(bsn);
      const naam = brpData?.Persoon?.Persoonsgegevens?.Naam ? brpData.Persoon.Persoonsgegevens.Naam : 'Onbekende gebruiker';
      return naam;
    } catch (error) {
      console.error('Error getting username');
      return 'Onbekende gebruiker';
    }
  }

  bsnFromClaims(claims: any, profileUsed: string): Bsn | false {
    if (profileUsed == 'digid') {
      const digidBsn = claims.sub;
      return new Bsn(digidBsn as string);
    }

    if (profileUsed == 'yivi') {
      // TODO make work with different claims (eHerkenning, demo-schema bsn)
      const yiviBsn = claims['irma-demo.gemeente.personalData.bsn'];
      return new Bsn(yiviBsn as string);
    }

    if (profileUsed == 'eherkenning') {
      // TODO Do some eherkenning processing using KVK...
    }

    return false;
  }

}
