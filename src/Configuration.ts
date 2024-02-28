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
   * Yivi (irmago) version binary checksum
   */
  yiviVersionChecksum: string;
  /**
   * Linux alpine version for container image
   */
  alpineLinuxVersion: string;
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
        clientId: 'todo',
        clientSecretArn: 'arn:aws:secretsmanager:eu-central-1:049753832279:secret:/cdk/yivi-for-employees/secrets/oidc/client-secret-ONw7re',
        applicationBaseUrl: 'https://yivi-voor-medewerkers.sandbox-marnix.csp-nijmegen.nl',
        authenticationBaseUrl: 'https://authenticatie-accp.nijmegen.nl',
        scope: 'openid idp_scoping:microsoft idp_scoping:simulator',
        immediateRedirect: false,
      },
    ],
    yiviVersionNumber: '',
    yiviVersionChecksum: '',
    alpineLinuxVersion: '',
    useSpotInstances: false,
  },
};

export function getEnvironmentConfiguration(branchName: string) {
  const conf = EnvironmentConfigurations[branchName];
  if (!conf) {
    throw Error(`No configuration found for branch ${branchName}`);
  }
  return conf;
}
