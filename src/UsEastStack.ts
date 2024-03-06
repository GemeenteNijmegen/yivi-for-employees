import { createHash } from 'crypto';
import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { CnameRecord, HostedZone, HostedZoneAttributes, IHostedZone, NsRecord } from 'aws-cdk-lib/aws-route53';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { RemoteParameters } from 'cdk-remote-stack';
import { Construct } from 'constructs';
import { Statics } from './Statics';

export interface UsEastStackProps extends StackProps {
  accountHostedZoneRegion: string;
  subdomain: string;
  alternativeDomainName?: string;
  cnameRecords?: {[key:string]: string};
}

export class UsEastStack extends Stack {
  subdomain: string;

  constructor(scope: Construct, id: string, props: UsEastStackProps) {
    super(scope, id, props);
    this.subdomain = props.subdomain;

    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);

    const attributes = this.getZoneAttributesFromRegion(props);
    const accountHostedZone = HostedZone.fromHostedZoneAttributes(this, 'account-hosted-zone', attributes);
    const hostedZone = this.setupProjectHostedZone(accountHostedZone, props);
    this.setupCertificate(hostedZone, props);

  }

  /**
   * Creata a subdomain for this project
   * @param accountHostedZone
   * @returns
   */
  private setupProjectHostedZone(accountHostedZone: IHostedZone, props: UsEastStackProps) {

    // Create hosted zone
    const zone = new HostedZone(this, 'managment-csp', {
      zoneName: `${this.subdomain}.${accountHostedZone.zoneName}`,
    });

    // Export string parameters
    new StringParameter(this, 'hostedzone-id', {
      stringValue: zone.hostedZoneId,
      parameterName: Statics.ssmHostedZoneId,
    });

    new StringParameter(this, 'hostedzone-name', {
      stringValue: zone.zoneName,
      parameterName: Statics.ssmHostedZoneName,
    });

    // Register our new subdomain
    if (!zone.hostedZoneNameServers) {
      throw Error('Expected name servers to be set!');
    }
    new NsRecord(this, 'ns-record', {
      zone: accountHostedZone,
      values: zone.hostedZoneNameServers,
      recordName: this.subdomain,
    });

    if (props.cnameRecords) {
      Object.entries(props.cnameRecords).forEach( ([name, value]: string[]) => {
        const hash = createHash('sha256').update(name + value).digest('hex').substring(0, 6);
        new CnameRecord(this, `cname-${hash}`, {
          recordName: name,
          domainName: value,
          zone: zone,
        });
      });
    }

    return zone;
  }

  /**
   * Create a certificate for this project
   * @param hostedZone
   * @param props
   */
  setupCertificate(hostedZone: HostedZone, props: UsEastStackProps) {

    // Only do DNS validation automatically when we only have our hostedzone
    let validation = CertificateValidation.fromDns();
    if (!props.alternativeDomainName) {
      validation = CertificateValidation.fromDns(hostedZone);
    }

    // Note: if we pass props.alternativeDomainName as an array the Certificate construct will fail
    const certificate = new Certificate(this, 'certificate', {
      domainName: hostedZone.zoneName,
      subjectAlternativeNames: props.alternativeDomainName ? [props.alternativeDomainName] : undefined,
      validation: validation,
    });

    new StringParameter(this, 'cert-arn', {
      stringValue: certificate.certificateArn,
      parameterName: Statics.certificateArn,
    });

  }

  /**
   * Finds the account hostedzone name and id in the given region
   * @param props
   * @returns
   */
  private getZoneAttributesFromRegion(props: UsEastStackProps): HostedZoneAttributes {
    const parameters = new RemoteParameters(this, 'parameters', {
      path: Statics.accountRootHostedZonePath,
      region: props.accountHostedZoneRegion,
    });
    const zoneId = parameters.get(Statics.accountRootHostedZoneId);
    const zoneName = parameters.get(Statics.accountRootHostedZoneName);
    return {
      hostedZoneId: zoneId,
      zoneName: zoneName,
    };
  }


}