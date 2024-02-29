import { Stack, Stage } from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Statics } from './Statics';

export class ParameterStage extends Stage {
  constructor(scope: any, id: string, props?: any) {
    super(scope, id, props);
    new ParameterStack(this, 'stack');
  }
}

export class ParameterStack extends Stack {
  constructor(scope: any, id: string, props?: any) {
    super(scope, id, props);

    // Setup OIDC client secret

    new Secret(this, 'oidc-client-secret', {
      description: 'The OIDC client secret for the Signicat connection',
      secretName: Statics.ssmOIDCClientSecret,
    });

    new StringParameter(this, 'yivi-api-host', {
      parameterName: Statics.yiviApiHost,
      description: 'URL of the Yivi API to use',
      stringValue: '-',
    });

    new StringParameter(this, 'gn-employee-ad-group', {
      parameterName: Statics.ssmGnEmployeeAdGroup,
      description: 'UUID of the Azure AD group for Gemeente Nijmegen employees',
      stringValue: '-',
    });


    // Yivi container secrets

    new Secret(this, 'yivi-container-secret-1', {
      description: 'The api key to use the irmago API',
      secretName: Statics.secretsApiKey,
      generateSecretString: {
        excludePunctuation: true, // [a-zA-Z0-9] only
      },
    });

    new Secret(this, 'yivi-container-secret-2', {
      description: 'The private key that is used for issuing',
      secretName: Statics.secretsPrivateKey,
    });

  }
}