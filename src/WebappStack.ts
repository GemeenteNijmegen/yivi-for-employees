import { Webapp, Webpage } from '@gemeentenijmegen/webapp';
import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import { HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { ITable, Table } from 'aws-cdk-lib/aws-dynamodb';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { RemoteParameters } from 'cdk-remote-stack';
import { Construct } from 'constructs';
import { DiscloseFunction } from './app/disclose/disclose-function';
import { IssueFunction } from './app/issue/issue-function';
import { PostloginFunction } from './app/post-login/postlogin-function';
import { VoetbalpoolFunction } from './app/voetbalpool/voetbalpool-function';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface WebappStackProps extends StackProps, Configurable {}

/**
 * Stage responsible for the API Gateway and lambdas
 */
export class WebappStack extends Stack {
  constructor(scope: Construct, id: string, props: WebappStackProps) {
    super(scope, id, props);

    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);

    // Import certificate from us-east-1
    const remoteCertificateArn = new RemoteParameters(this, 'remote-certificate-arn', {
      path: Statics.certificatePath,
      region: 'us-east-1',
    });
    const certificate = Certificate.fromCertificateArn(this, 'certificate', remoteCertificateArn.get(Statics.certificateArn));

    // Import hosted zone (parameters) from us-east-1
    const remoteHostedZone = new RemoteParameters(this, 'remote-hosted-zone', {
      path: Statics.ssmZonePath,
      region: 'us-east-1',
    });
    const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'hosted-zone', {
      hostedZoneId: remoteHostedZone.get(Statics.ssmHostedZoneId),
      zoneName: remoteHostedZone.get(Statics.ssmHostedZoneName),
    });

    // Import user table
    const userTableArn = StringParameter.valueForStringParameter(this, Statics.ssmUserTableArn);
    const userTable = Table.fromTableArn(this, 'user-table', userTableArn);

    // OIDC client secret
    const clientSecret = Secret.fromSecretNameV2(this, 'oidc-client-secret', Statics.ssmOIDCClientSecret);

    /**
     * Create the webapp!
     */
    const webapp = new Webapp(this, 'app', {
      applicationName: Statics.projectName,
      cloudFrontCertificate: certificate,
      domainName: `${hostedZone.zoneName}`,
      additionalSourceFilesDir: 'src/resources',
      hostedZone: hostedZone,
      staticResourcesDirectory: './src/app/static-resources/',
      defaultPath: '/issue',
      postLoginProcessor: this.postLoginHook(),
      oidcProfiles: props.configuration.oidcProfiles,
      cspHeaderValue: this.getCspHeader(props.configuration.cspAllowedConnections),
      alternativeDomainNames: props.configuration.alternativeDomainName ? [props.configuration.alternativeDomainName] : undefined,
    });

    /**
     * Cool trick for building the webapp!
     * Grants all standard lambdas read rights on the secret.
     * That is the login, logout and auth lambda
     */
    clientSecret.grantRead(webapp);

    // Add other pages!
    this.addIssuePage(webapp, props);
    this.addDisclosurePage(webapp, props, userTable);
  }

  /**
   * Add a home page to the webapp
   * @param webapp
   */
  addIssuePage(webapp: Webapp, props: WebappStackProps) {
    const yiviApiKey = Secret.fromSecretNameV2(this, 'yivi-api-key', Statics.secretsApiKey);
    const yiviApiHost = StringParameter.valueForStringParameter(this, Statics.yiviApiHost);
    const gnEmployeeAdGroup = StringParameter.valueForStringParameter(this, Statics.ssmGnEmployeeAdGroup);
    const homeFunction = new Webpage(this, 'issue-function', {
      description: 'Issue lambda',
      apiFunction: IssueFunction,
      environment: {
        YIVI_API_DEMO: props.configuration.yiviDemo ? 'demo' : '',
        YIVI_API_HOST: yiviApiHost,
        YIVI_API_KEY_ARN: yiviApiKey.secretArn,
        GN_EMPLOYEE_AD_GROUP_UUID: gnEmployeeAdGroup,
      },
    });
    yiviApiKey.grantRead(homeFunction.lambda);
    webapp.addPage('issue', homeFunction, '/issue');
  }

  /**
   * Add a disclosure page to the webapp
   * @param webapp
   */
  addDisclosurePage(webapp: Webapp, props: WebappStackProps, userTable: ITable) {
    const yiviApiKey = Secret.fromSecretNameV2(this, 'yivi-api-key-disclosure', Statics.secretsApiKey);
    const yiviApiHost = StringParameter.valueForStringParameter(this, Statics.yiviApiHost);
    const gnEmployeeAdGroup = StringParameter.valueForStringParameter(this, Statics.ssmGnEmployeeAdGroup);
    const disclosureFunction = new Webpage(this, 'frontend-disclosure-function', {
      description: 'Frontend-disclosure lambda',
      apiFunction: DiscloseFunction,
      environment: {
        YIVI_API_DEMO: props.configuration.yiviDemo ? 'demo' : '',
        YIVI_API_HOST: yiviApiHost,
        YIVI_API_KEY_ARN: yiviApiKey.secretArn,
        GN_EMPLOYEE_AD_GROUP_UUID: gnEmployeeAdGroup,
        USER_TABLE_NAME: userTable.tableName,
      },
    });
    userTable.grantReadWriteData(disclosureFunction.lambda);
    yiviApiKey.grantRead(disclosureFunction.lambda);
    webapp.addPage('disclose', disclosureFunction, '/disclose');
  }

  /**
   * Add a disclosure page to the webapp
   * @param webapp
   */
  addVoetbalpool(webapp: Webapp, userTable: ITable) {
    const voetbalpoolFunction = new Webpage(this, 'voetbalpool-function', {
      description: 'Voetbalpool lambda',
      apiFunction: VoetbalpoolFunction,
      environment: {
        USER_TABLE_NAME: userTable.tableName,
      },
    });
    userTable.grantReadWriteData(voetbalpoolFunction.lambda);
    webapp.addPage('voetbalpool', voetbalpoolFunction, '/voetbalpool', [HttpMethod.POST]);
  }

  /**
   * Constrcut a post-login hook function that is passed directly
   * to the webapp. It will register the function and redirect trafic
   * there after the pre-login (auth lambda).
   * @returns
   */
  postLoginHook() {
    const gnEmployeeAdGroup = StringParameter.valueForStringParameter(this, Statics.ssmGnEmployeeAdGroup);
    const hook = new Webpage(this, 'post-login-function', {
      description: 'Post-login lambda',
      apiFunction: PostloginFunction,
      environment: {
        GN_EMPLOYEE_AD_GROUP_UUID: gnEmployeeAdGroup,
      },
    });
    return hook;
  }


  getCspHeader(cspAllowedConnections: string[]) {
    const connections = cspAllowedConnections.join('; ');
    const header = `default-src 'self'; \
    frame-ancestors 'self'; \
    frame-src 'self'; \
    connect-src 'self' https://componenten.nijmegen.nl ${connections}; \
    style-src 'self' https://componenten.nijmegen.nl https://fonts.googleapis.com https://fonts.gstatic.com 'sha256-hS1LM/30PjUBJK3kBX9Vm9eOAhQNCiNhf/SCDnUqu14=' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 'sha256-OTeu7NEHDo6qutIWo0F2TmYrDhsKWCzrUgGoxxHGJ8o='; \
    script-src 'self' https://componenten.nijmegen.nl https://siteimproveanalytics.com; \
    font-src 'self' https://componenten.nijmegen.nl https://fonts.gstatic.com; \
    img-src 'self' https://componenten.nijmegen.nl data: https://*.siteimproveanalytics.io; \
    object-src 'none';`;
    return header;
  }

}
