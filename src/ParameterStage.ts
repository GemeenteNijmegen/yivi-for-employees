import { Stack, Stage } from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
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