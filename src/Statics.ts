export abstract class Statics {
  static readonly projectName: string = 'yivi-for-employees';

  // Managed in dns-managment project:
  static readonly accountRootHostedZonePath: string = '/gemeente-nijmegen/account/hostedzone';
  static readonly accountRootHostedZoneId: string = '/gemeente-nijmegen/account/hostedzone/id';
  static readonly accountRootHostedZoneName: string = '/gemeente-nijmegen/account/hostedzone/name';

  // Hosted zone
  static readonly ssmZonePath: string = `/cdk/${this.projectName}/zone`;
  static readonly ssmHostedZoneId: string = `/cdk/${this.projectName}/zone/id`;
  static readonly ssmHostedZoneName: string = `/cdk/${this.projectName}/zone/name`;

  // Certificate
  static readonly certificatePath: string = `/cdk/${this.projectName}/certificates`;
  static readonly certificateArn: string = `/cdk/${this.projectName}/certificates/certificate-arn`;

  // OIDC
  static readonly ssmOIDCClientSecret = `/cdk/${this.projectName}/secrets/oidc/client-secret`;


  // Yivi container secrets
  static readonly secretsApiKey = `/cdk/${this.projectName}/secrets/container/api-key`;
  static readonly secretsPrivateKey = `/cdk/${this.projectName}/secrets/container/private-key`;

  // ENVIRONMENTS

  static readonly gnSandboxMarnix = {
    account: '049753832279',
    region: 'eu-central-1',
  };

}