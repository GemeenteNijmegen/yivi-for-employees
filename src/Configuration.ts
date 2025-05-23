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
  /**
   * A list of connect-src urls that must be part of the CSP.
   */
  cspAllowedConnections: string[];
  /**
   * Alternative domain names for the webapp used for cloudfront & certificate
   */
  alternativeDomainName?: string;
  /**
   * CNAMES to create in project hostedzone
   * Node: do not include hostedzone name in key
   */
  cnameRecords?: { [key: string]: string };
}


const EnvironmentConfigurations: { [key: string]: Configuration } = {
  main: {
    branch: 'main',
    buildEnvironment: Statics.gnBuild,
    deploymentEnvironment: Statics.gnYiviNijmegenProd,
    pipelineStackCdkName: 'yivi-for-employees-main',
    pipelineName: 'yivi-for-employees-main',
    resources: 'src/resources',
    oidcProfiles: [
      {
        name: 'microsoft',
        title: 'Gemeente Nijmegen',
        cssClass: 'btn-yivi',
        clientId: 'Z4OPWEmbkMxFJjBemt9sqNz0eDJQFIzT',
        clientSecretArn: 'arn:aws:secretsmanager:eu-central-1:767398106682:secret:/cdk/yivi-for-employees/secrets/oidc/client-secret-oecdkZ',
        applicationBaseUrl: 'https://yivi-voor-medewerkers.nijmegen.nl',
        authenticationBaseUrl: 'https://authenticatie.nijmegen.nl',
        scope: 'openid idp_scoping:microsoft',
        immediateRedirect: false,
      },
    ],
    yiviVersionNumber: 'v0.18.1',
    yiviVersionChecksum: '0006dd9c7ece2d193a3fc73fc31e2747a63d739a291a76c389f494b32da5c865',
    alpineLinuxVersion: '3.21.3',
    yiviDemo: false,
    useSpotInstances: false,
    cspAllowedConnections: [
      'https://api.yivi-voor-medewerkers.yivi-nijmegen-prod.csp-nijmegen.nl',
    ],
    alternativeDomainName: 'yivi-voor-medewerkers.nijmegen.nl',
    cnameRecords: {
      _db2e1a50731e8cd5af9d084292a021c8: '_8ba10d75f0a47cffd01b77f8db1c0e96.mhbtsbpdnt.acm-validations.aws.',
    },
  },
  acceptance: {
    branch: 'acceptance',
    buildEnvironment: Statics.gnBuild,
    deploymentEnvironment: Statics.gnYiviNijmegenAccp,
    pipelineStackCdkName: 'yivi-for-employees-acceptance',
    pipelineName: 'yivi-for-employees-acceptance',
    resources: 'src/resources',
    oidcProfiles: [
      {
        name: 'microsoft',
        title: 'Gemeente Nijmegen',
        cssClass: 'btn-yivi',
        clientId: 'CVotFJe53ZomCfbetVSiykdcqNgzSiIt',
        clientSecretArn: 'arn:aws:secretsmanager:eu-central-1:992382808833:secret:/cdk/yivi-for-employees/secrets/oidc/client-secret-zCfjKX',
        applicationBaseUrl: 'https://yivi-voor-medewerkers.accp.nijmegen.nl',
        authenticationBaseUrl: 'https://authenticatie-accp.nijmegen.nl',
        scope: 'openid idp_scoping:microsoft',
        immediateRedirect: false,
      },
    ],
    yiviVersionNumber: 'v0.18.1',
    yiviVersionChecksum: '0006dd9c7ece2d193a3fc73fc31e2747a63d739a291a76c389f494b32da5c865',
    alpineLinuxVersion: '3.21.3',
    yiviDemo: true,
    useSpotInstances: true,
    cspAllowedConnections: [
      'https://api.yivi-voor-medewerkers.yivi-nijmegen-accp.csp-nijmegen.nl',
    ],
    alternativeDomainName: 'yivi-voor-medewerkers.accp.nijmegen.nl',
    cnameRecords: {
      _1b3f552b2f080fa22f9fd6de9f4286dd: '_584f755149f6ba0d2774d6828a5e7cea.mhbtsbpdnt.acm-validations.aws.',
    },
  },
};

export function getEnvironmentConfiguration(branchName: string) {
  const conf = EnvironmentConfigurations[branchName];
  if (!conf) {
    throw Error(`No configuration found for branch ${branchName}`);
  }
  return conf;
}
