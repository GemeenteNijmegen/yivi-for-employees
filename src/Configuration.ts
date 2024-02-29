import { OpenIdConnectConnectionProfile } from '@gemeentenijmegen/webapp';
import { Statics } from './Statics';

/**
 * Adds a configuration field to another interface
 */
export interface Configurable {
  configuration: Configuration;
}

/**
 * Environment object (required fields)
 */
export interface Environment {
  account: string;
  region: string;
}

/**
 * Basic configuration options per environment
 */
export interface Configuration {
  /**
   * Branch name for the applicible branch (this branch)
   */
  branch: string;

  /**
   * Environment to place the pipeline
   */
  buildEnvironment: Environment;

  /**
   * Environment to deploy the application
   */
  deploymentEnvironment: Environment;

  /**
   * The CDK name of the pipeline stack (can be removed after
   * moving to new lz)
   */
  pipelineStackCdkName: string;
  /**
   * The name of the CDK pipeline
   */
  pipelineName: string;
  /**
   * Path to directory containing resources that are bundled
   * into all lambdas.
   */
  resources: string;
  /**
   * The authentication profiles to use
   */
  oidcProfiles: OpenIdConnectConnectionProfile[];
  /**
   * Yivi (irmago) version number
   */
  yiviVersionNumber: string;
  /**
   * Checksum of the IRMA GO executable
   * You can obtain the checksum by downloading the irma-linux-amd64 binary release and calculating it locally
   * You can create the checksum by executing `shasum -a 256 ~/Downloads/irma-linux-amd643` (on mac)
   */
  yiviVersionChecksum: string;
  /**
   * Linux alpine version for container image
   */
  alpineLinuxVersion: string;
  /**
   * Use yivi demo schema
   */
  yiviDemo: boolean;
  /**
   * ECS spot instances (cheper, but container relocations)
   */
  useSpotInstances: boolean;
}


const EnvironmentConfigurations: {[key:string]: Configuration} = {
  sandbox: {
    branch: 'sandbox',
    buildEnvironment: Statics.gnSandboxMarnix,
    deploymentEnvironment: Statics.gnSandboxMarnix,
    pipelineStackCdkName: 'yivi-for-employees-sandbox',
    pipelineName: 'yivi-for-employees-sandbox',
    resources: 'src/resources',
    oidcProfiles: [
      {
        name: 'microsoft',
        title: 'Gemeente Nijmegen',
        cssClass: 'btn-microsoft',
        clientId: 'CVotFJe53ZomCfbetVSiykdcqNgzSiIt',
        clientSecretArn: 'arn:aws:secretsmanager:eu-central-1:049753832279:secret:/cdk/yivi-for-employees/secrets/oidc/client-secret-wiUd8V',
        applicationBaseUrl: 'https://yivi-voor-medewerkers.sandbox-marnix.csp-nijmegen.nl',
        authenticationBaseUrl: 'https://authenticatie-accp.nijmegen.nl',
        scope: 'openid idp_scoping:microsoft',
        immediateRedirect: false,
      },
    ],
    yiviVersionNumber: 'v0.15.1',
    yiviVersionChecksum: '27182cc8203234eca14b60fe488c1157fce0d1385410a83216436418d5b03a52',
    alpineLinuxVersion: '3.19.1',
    yiviDemo: true,
    useSpotInstances: true,
  },
};

export function getEnvironmentConfiguration(branchName: string) {
  const conf = EnvironmentConfigurations[branchName];
  if (!conf) {
    throw Error(`No configuration found for branch ${branchName}`);
  }
  return conf;
}
