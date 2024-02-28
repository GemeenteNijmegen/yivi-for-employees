import { Webapp, Webpage } from '@gemeentenijmegen/webapp';
import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { RemoteParameters } from 'cdk-remote-stack';
import { Construct } from 'constructs';
import { IssueFunction } from './app/issue/issue-function';
import { PostloginFunction } from './app/post-login/postlogin-function';
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
    });

    /**
     * Cool trick for building the webapp!
     * Grants all standard lambdas read rights on the secret.
     * That is the login, logout and auth lambda
     */
    clientSecret.grantRead(webapp);

    // Add other pages!
    this.addIssuePage(webapp);
  }

  /**
   * Add a home page to the webapp
   * @param webapp
   */
  addIssuePage(webapp: Webapp) {
    const homeFunction = new Webpage(this, 'issue-function', {
      description: 'Issue lambda',
      apiFunction: IssueFunction,
    });
    webapp.addPage('issue', homeFunction, '/issue');
  }

  /**
   * Constrcut a post-login hook function that is passed directly
   * to the webapp. It will register the function and redirect trafic
   * there after the pre-login (auth lambda).
   * @returns
   */
  postLoginHook() {
    const hook = new Webpage(this, 'post-login-function', {
      description: 'Post-login lambda',
      apiFunction: PostloginFunction,
      environment: {

      },
    });
    return hook;
  }

}
