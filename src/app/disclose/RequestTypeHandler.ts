import * as dislosureTemplateAge from './templates/discloseResultAge.mustache';
import * as dislosureTemplateEmployee from './templates/discloseResultEmployee.mustache';
import * as dislosureTemplateKoffie from './templates/discloseResultKoffie.mustache';

export const handlerTypeMap: {[key: string]: () => RequestTypeHandler} = {
  age: () => new AgeHandler(),
  employee: () => new EmployeeHandler(),
  koffie: () => new KoffieHandler(),
};

export abstract class RequestTypeHandler {
  abstract getResultTemplate(): string;
  abstract getDisclosureRequest(): any;
  abstract handleDisclosureRequest(sessionResult: any) : any;
}


export class KoffieHandler extends RequestTypeHandler {
  getResultTemplate(): string {
    return dislosureTemplateKoffie.default;
  }
  getDisclosureRequest() {
    return [ // And
      [ // Or
        [ // List of attributes
          'irma-demo.nijmegen.employeeData.email',
        ],
      ],
    ];
  }
  handleDisclosureRequest(sessionResult: any) {
    // TODO update dynamodb table with koffie data
    // Or sessie om eerst een akkoord knop te maken ofzo
    return sessionResult.disclosed[0][0].rawValue;
  }
}

export class EmployeeHandler extends RequestTypeHandler {
  getResultTemplate(): string {
    return dislosureTemplateEmployee.default;
  }
  getDisclosureRequest() {
    return [ // And
      [ // Or
        [ // List of attributes
          'irma-demo.nijmegen.employeeData.works-for-gemeente-nijmegen',
        ],
      ],
    ];
  }
  handleDisclosureRequest(sessionResult: any) {
    return sessionResult.disclosed[0][0].rawValue;
  }
}


export class AgeHandler extends RequestTypeHandler {
  getResultTemplate(): string {
    return dislosureTemplateAge.default;
  }
  getDisclosureRequest() {
    return [ // And
      [ // Or
        [ // List of attributes
          'irma-demo.gemeente.personalData.over18',
        ],
      ],
    ];
  }
  handleDisclosureRequest(sessionResult: any) {
    console.log('AgeHandlerResult', JSON.stringify(sessionResult, null, 4));
    return sessionResult.disclosed[0][0].rawValue;
  }
}