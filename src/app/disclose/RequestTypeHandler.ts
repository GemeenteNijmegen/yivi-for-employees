import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Session } from '@gemeentenijmegen/session';
import * as dislosureTemplateAge from './templates/discloseResultAge.mustache';
import * as dislosureTemplateEmployee from './templates/discloseResultEmployee.mustache';

export const handlerTypeMap: {[key: string]: (client: DynamoDBClient) => RequestTypeHandler} = {
  age: (client: DynamoDBClient) => new AgeHandler(client),
  employee: (client: DynamoDBClient) => new EmployeeHandler(client),
  // koffie: (client: DynamoDBClient) => new KoffieHandler(client),
};

export abstract class RequestTypeHandler {
  dynamodbClient: DynamoDBClient;

  constructor(dynamodbClient: DynamoDBClient) {
    this.dynamodbClient = dynamodbClient;
  }
  abstract getResultTemplate(): string;
  abstract getDisclosureRequest(): any;
  abstract handleDisclosureRequest(sessionResult: any, session: Session) : Promise<any>;
  abstract confirmRequest(session: Session) : Promise<string>;
  abstract getTitle(): string;
}


export class EmployeeHandler extends RequestTypeHandler {
  getTitle(): string {
    return 'Ben je medewerker van de gemeente Nijmegen?';
  }
  getResultTemplate(): string {
    return dislosureTemplateEmployee.default;
  }
  getDisclosureRequest() {
    return [ // And
      [ // Or
        [ // List of attributes
          'pbdf.nijmegen.employeeData.worksForGemeenteNijmegen',
        ],
      ],
    ];
  }
  async handleDisclosureRequest(sessionResult: any, _session: Session) {
    return sessionResult.disclosed[0][0].rawvalue;
  }
  async confirmRequest(_session: Session) {
    return 'not implemented';
  }
}


export class AgeHandler extends RequestTypeHandler {
  getTitle(): string {
    return 'Ben je 65 jaar of ouder?';
  }
  getResultTemplate(): string {
    return dislosureTemplateAge.default;
  }
  getDisclosureRequest() {
    return [ // And
      [ // Or
        [ // List of attributes
          'pbdf.gemeente.personalData.over65',
        ],
      ],
    ];
  }
  async handleDisclosureRequest(sessionResult: any, _session: Session) {
    const value = sessionResult.disclosed[0][0].rawvalue;
    return mapToJaNee(value);
  }
  async confirmRequest(_session: Session) {
    return 'not implemented';
  }
}

// export class KoffieHandler extends RequestTypeHandler {
//   getResultTemplate(): string {
//     return dislosureTemplateKoffie.default;
//   }
//   getDisclosureRequest() {
//     return [ // And
//       [ // Or
//         [ // List of attributes
//           'irma-demo.nijmegen.employeeData.email',
//         ],
//       ],
//     ];
//   }
//   async handleDisclosureRequest(sessionResult: any, session: Session) {

//     // 1. Bereken de unique user key
//     const email = sessionResult.disclosed[0][0].rawvalue;
//     const emailHash = createHash('sha256').update(email).digest('hex');
//     const key =`${emailHash}#koffie`;

//     // 2. Sla de user key op in de sessie (voor de confirmation stap)
//     await session.createSession({
//       userKoffieKey: { S: key },
//     });

//     // 3. Check of de user nog koffie mag claimen en geef een status update
//     const currentCupsOfCoffee = await this.getCurrentCupsOfCoffee(key);
//     return {
//       allowed: currentCupsOfCoffee < 3,
//       message: `Je hebt ${currentCupsOfCoffee} van je 3 koppen koffie geclaimd.`,
//     };
//   }
//   async confirmRequest(session: Session) {

//     // 1. Get user key from session
//     const key = session.getValue('userKoffieKey');

//     // 2. Check if allowed to get another cup of coffe
//     const currentCupsOfCoffee = await this.getCurrentCupsOfCoffee(key);
//     if (currentCupsOfCoffee >= 3) {
//       throw Error('Je hebt te veel koppen koffie geclaimd!');
//     }

//     // 2. Increment the total cups of coffee
//     const command = new UpdateItemCommand({
//       Key: { pk: { S: key } },
//       TableName: process.env.USER_TABLE_NAME,
//       UpdateExpression: 'ADD #c :koffie',
//       ExpressionAttributeValues: {
//         ':koffie': { N: '1' },
//       },
//       ExpressionAttributeNames: {
//         '#c': 'data',
//       },
//     });
//     await this.dynamodbClient.send(command);

//     return 'Je gratis kop koffie is geclaimd!';
//   }

//   private async getCurrentCupsOfCoffee(key: string) {
//     const command = new GetItemCommand({
//       Key: { pk: { S: key } },
//       TableName: process.env.USER_TABLE_NAME,
//     });
//     const query = await this.dynamodbClient.send(command);
//     return parseInt(query.Item?.data?.N ?? '0');
//   }

// }

function mapToJaNee(value: string) {
  switch (value) {
    case 'Ja':
    case 'ja':
    case 'Yes':
    case 'yes':
      return 'Ja';
    case 'nee':
    case 'Nee':
    case 'no':
    case 'No':
    default:
      return 'Nee';
  }
}