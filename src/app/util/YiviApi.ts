import { AWS } from '@gemeentenijmegen/utils';
import axios, { Axios } from 'axios';

export class YiviApi {

  private host: string;
  private demo: boolean;
  private apiKey: string;

  constructor() {
    this.host = '';
    this.demo = process.env.YIVI_API_DEMO != 'demo' ? false : true;
    this.apiKey = '';
  }

  getHost() {
    return this.host;
  }

  async init() {
    if (!process.env.YIVI_API_KEY_ARN || !process.env.YIVI_API_HOST) {
      throw Error('Clould not initialize YIVI API client');
    }
    this.host = process.env.YIVI_API_HOST;
    this.apiKey = await AWS.getSecret(process.env.YIVI_API_KEY_ARN);
  }

  /**
   * Note: This method should only be used for testing purposes.
   */
  manualInit(host: string, demo: boolean, apiKey: string) {
    this.host = host;
    this.demo = demo;
    this.apiKey = apiKey;
  }

  async startIssueSession(cards: YiviCard[]) {
    const yiviIssueRequest = this.constructYiviIssueRequest(cards);
    return this.post('session', yiviIssueRequest, 'De YIVI sessie kon niet worden gestart.');
  }

  private getClient(): Axios {
    const client = axios.create({
      baseURL: `https://${this.host}`,
      timeout: 2000,
      headers: {
        'irma-authorization': this.apiKey,
        'Content-type': 'application/json',
      },
    });
    return client;
  }

  private async post(path: string, data: any, errorMsg: string) {
    const client = this.getClient();
    try {
      console.time('request to ' + path);
      const resp = await client.post(path, data);
      if (resp.data) {
        console.timeEnd('request to ' + path);
        return resp.data;
      }
      throw Error(errorMsg);
    } catch (error: any) {
      console.timeEnd('request to ' + path);
      this.handleError(error, path);
      return { error: errorMsg };
    }
  }

  private handleError(error: any, path: string) {
    console.error('Error while doing signed post request for endpoint:', path);
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log(`http status for ${path}: ${error.response?.status}`);
        console.log('Error data:', error.response?.data);
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.error(error === null || error === void 0 ? void 0 : error.code);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error(error.message);
      }
    } else {
      console.error('Non axios error occured:', error);
    }
  }

  private constructYiviIssueRequest(cards: YiviCard[]) {
    // Map to yivi api expected card format
    const mappedCards = cards.map(card => {
      return {
        credential: this.demo ? card.demoReference : card.reference,
        validity: card.expiration,
        attributes: card.attributes,
      };
    });

    // Return the issue request
    return {
      type: 'issuing',
      credentials: mappedCards,
    };
  }

}

export interface YiviCard {
  /**
   * Yivi scheme reference
   */
  reference: string;
  /**
   * Yivi demo-scheme reference
   */
  demoReference: string;
  /**
   * Expiration date in epoch seconds
   */
  expiration: number;
  /**
   * The attributes of the card (must match scheme)
   */
  attributes: { [key:string]: string };
}