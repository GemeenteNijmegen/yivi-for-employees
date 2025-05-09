import {
  Aws,
  Duration,
  Fn,
  Stack,
  StackProps,
  aws_certificatemanager as acm,
  aws_apigateway as apigateway,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as loadbalancing,
  aws_logs as logs,
  aws_route53 as route53,
  aws_route53_targets as route53Targets,
  aws_ssm as ssm,
} from 'aws-cdk-lib';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { RemoteParameters } from 'cdk-remote-stack';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { EcsFargateService } from './constructs/EcsFargateService';
import { Statics } from './Statics';

export interface ContainerStackProps extends StackProps, Configurable { }

export class ContainerStack extends Stack {

  private hostedzone: route53.IHostedZone;
  private vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props: ContainerStackProps) {
    super(scope, id, props);

    this.hostedzone = this.importHostedZone();
    this.vpc = this.setupVpc(props);

    // API Gateway and access to VPC
    const cluster = this.constructEcsCluster();
    const loadbalancer = this.setupLoadbalancer();
    const listener = this.setupListner(loadbalancer);
    const vpclink = this.setupVpcLink(loadbalancer);
    const api = this.setupApiGateway();

    // Add dependeny for smooth deployment
    vpclink.node.addDependency(loadbalancer);

    // Setup services and api gateway routes
    this.addIssueServiceAndIntegration(cluster, props, listener);
    this.setupApiRoutes(api, vpclink);

  }

  setupApiRoutes(api: apigateway.RestApi, vpclink: apigateway.VpcLink) {

    // Public
    const irmaIntegration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'ANY',
      uri: `https://alb.${this.hostedzone.zoneName}/irma/{proxy}`,
      options: {
        vpcLink: vpclink,
        timeout: Duration.seconds(6),
        requestParameters: {
          'integration.request.path.proxy': 'method.request.path.proxy',
        },
      },
    });
    const irma = api.root.addResource('irma');
    irma.addProxy({
      defaultIntegration: irmaIntegration,
      defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.NONE,
        requestParameters: {
          'method.request.path.proxy': true,
        },
      },
    });

    // Private paths below
    const session = api.root.addResource('session');
    const result = session.addResource('{requestorToken}').addResource('result');

    // POST /session
    const sessionIntegration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'ANY',
      uri: `https://alb.${this.hostedzone.zoneName}/session`,
      options: {
        vpcLink: vpclink,
        timeout: Duration.seconds(6),
        requestParameters: {
          'integration.request.header.authorization': 'method.request.header.irma-authorization',
        },
      },
    });
    session.addMethod('POST', sessionIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      requestParameters: {
        'method.request.header.irma-authorization': true,
      },
    });

    // GET /session/{requestorToken}/result
    const resultIntegration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'ANY',
      uri: `https://alb.${this.hostedzone.zoneName}/session/{requestorToken}/result`, // TODO check if this works
      options: {
        vpcLink: vpclink,
        timeout: Duration.seconds(6),
        requestParameters: {
          'integration.request.header.authorization': 'method.request.header.irma-authorization',
          'integration.request.path.requestorToken': 'method.request.path.requestorToken',
        },
      },
    });
    result.addMethod('GET', resultIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      requestParameters: {
        'method.request.header.irma-authorization': true,
        'method.request.path.requestorToken': true,
      },
    });

  }

  setupVpc(props: ContainerStackProps) {

    // Import vpc config (only public and private subnets)
    const vpcId = ssm.StringParameter.valueForStringParameter(this, '/landingzone/vpc/vpc-id');
    const availabilityZones = [0, 1, 2].map(i => Fn.select(i, Fn.getAzs(Aws.REGION)));
    const privateSubnetRouteTableIds = [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/route-table-private-subnet-${i}-id`));
    const publicSubnetIds = [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/public-subnet-${i}-id`));
    const privateSubnetIds = [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/private-subnet-${i}-id`));

    let publicSubnetRouteTableIds = undefined;
    if (props.configuration.branch.includes('sandbox')) {
      // Why is this different than in non sandbox vpcs?
      publicSubnetRouteTableIds = Array(3).fill(ssm.StringParameter.valueForStringParameter(this, '/platformunited/landing-zone/vpc/route-table-public-subnets-id'));
    } else {
      publicSubnetRouteTableIds = Array(3).fill(ssm.StringParameter.valueForStringParameter(this, '/landingzone/vpc/route-table-public-subnets-id'));
    }

    const vpc = ec2.Vpc.fromVpcAttributes(this, 'vpc', {
      vpcId,
      availabilityZones,
      privateSubnetRouteTableIds,
      publicSubnetRouteTableIds,
      publicSubnetIds,
      privateSubnetIds,
    });

    return vpc;
  }

  setupVpcLink(loadbalancer: loadbalancing.INetworkLoadBalancer) {
    return new apigateway.VpcLink(this, 'vpc-link', {
      description: 'Link between RestApi and private subnets in VPC (yivi issue server)',
      targets: [loadbalancer],
    });
  }

  importHostedZone() {
    // Import hosted zone (parameters) from us-east-1
    const remoteHostedZone = new RemoteParameters(this, 'remote-hosted-zone', {
      path: Statics.ssmZonePath,
      timeout: Duration.seconds(10),
      region: 'us-east-1',
    });
    const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'hosted-zone', {
      hostedZoneId: remoteHostedZone.get(Statics.ssmHostedZoneId),
      zoneName: remoteHostedZone.get(Statics.ssmHostedZoneName),
    });
    return hostedZone;
  }

  /**
   * Using RestApi as this is more suiteable for us: WAF, Resource-based policies, Request mapping without reserved headers
   * Unfortunately RestApi does not have direct integration with CloudMap for loadbalacing.
   * Differences between HttpApi and RestApi can be found here https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html
   * @returns RestApi
   */
  setupApiGateway() {

    const cert = new acm.Certificate(this, 'api-cert', {
      domainName: `api.${this.hostedzone.zoneName}`,
      validation: acm.CertificateValidation.fromDns(this.hostedzone),
    });

    const accessLogging = new logs.LogGroup(this, 'api-logging', {
      retention: logs.RetentionDays.ONE_WEEK, // Very short lived as we'll be using a WAF
    });

    const api = new apigateway.RestApi(this, 'api', {
      description: 'API gateway for yivi-for-employees issue server',
      domainName: {
        certificate: cert,
        domainName: `api.${this.hostedzone.zoneName}`,
        securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
      },
      //policy: this.setupApiGatewayPolicy(props),
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(accessLogging),
        accessLogFormat: apigateway.AccessLogFormat.custom(
          JSON.stringify({
            requestId: '$context.requestId',
            userAgent: '$context.identity.userAgent',
            sourceIp: '$context.identity.sourceIp',
            requestTime: '$context.requestTime',
            requestTimeEpoch: '$context.requestTimeEpoch',
            httpMethod: '$context.httpMethod',
            path: '$context.path',
            status: '$context.status',
            protocol: '$context.protocol',
            responseLength: '$context.responseLength',
            domainName: '$context.domainName',
            errorMessage: '$context.error.message',
            errorType: '$context.error.responseType',
            stage: '$context.stage',
            integrationError: '$context.integration.error',
            integrationStatus: '$context.integration.integrationStatus',
            integrationLatency: '$context.integration.latency',
            integrationRequestId: '$context.integration.requestId',
            integrationErrorMessage: '$context.integrationErrorMessage',
          }),
        ),
      },
    });

    // Setup DNS records
    if (!api.domainName) {
      throw Error('No domain name configured, cannot create alas and A record');
    }
    const alias = new route53Targets.ApiGatewayDomain(api.domainName);
    new route53.ARecord(this, 'api-a-record', {
      recordName: `api.${this.hostedzone.zoneName}`,
      zone: this.hostedzone,
      target: route53.RecordTarget.fromAlias(alias),
    });

    return api;
  }

  /**
   * Import the account vpc from the landingzone
   * @returns vpc
   */
  constructEcsCluster() {
    // Note: if a VPC is not provided we are creating a new one for this cluster
    const cluster = new ecs.Cluster(this, 'cluster', {
      vpc: this.vpc,
      clusterName: 'yivi-issue-cluster',
      enableFargateCapacityProviders: true, // Allows usage of spot instances
    });
    this.vpc.node.addDependency(cluster);
    return cluster;
  }

  setupLoadbalancer() {

    // Construct the loadbalancer
    const loadbalancer = new loadbalancing.NetworkLoadBalancer(this, 'loadbalancer', {
      vpc: this.vpc,
      internetFacing: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    this.vpc.node.addDependency(loadbalancer);
    return loadbalancer;
  }

  setupListner(loadbalancer: loadbalancing.NetworkLoadBalancer) {

    // Get a certificate
    const albWebFormsDomainName = `alb.${this.hostedzone.zoneName}`;
    const albCertificate = new acm.Certificate(this, 'loadbalancer-certificate', {
      domainName: albWebFormsDomainName,
      validation: acm.CertificateValidation.fromDns(this.hostedzone),
    });

    // Setup a https listner
    const listner = loadbalancer.addListener('https', {
      certificates: [albCertificate],
      protocol: loadbalancing.Protocol.TLS,
      sslPolicy: loadbalancing.SslPolicy.FORWARD_SECRECY_TLS12_RES,
      port: 443,
    });

    return listner;
  }

  addIssueServiceAndIntegration(
    cluster: ecs.Cluster,
    props: ContainerStackProps,
    listner: loadbalancing.NetworkListener,
  ) {

    const asset = this.buildContainer(props);
    const image = ecs.ContainerImage.fromDockerImageAsset(asset);

    // Get secrets
    const apiKey = Secret.fromSecretNameV2(this, 'api-key', Statics.secretsApiKey);
    const privateKey = Secret.fromSecretNameV2(this, 'private-key', Statics.secretsPrivateKey);

    // Define a security group to allow ingress on the container port
    const containerPort = 8080;
    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'issue-service-sg', {
      vpc: this.vpc,
      description: 'Security group for the yivi-issue-server',
      allowAllOutbound: true,
    });
    const privateSubnetCidrs = [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/private-subnet-${i}-cidr`));
    privateSubnetCidrs.forEach(cidr => {
      const peer = ec2.Peer.ipv4(cidr);
      serviceSecurityGroup.addIngressRule(peer, ec2.Port.tcp(containerPort));
    });

    // Create the service
    const service = new EcsFargateService(this, 'issue-service', {
      serviceName: 'yivi-issue',
      containerImage: image,
      containerPort: containerPort,
      ecsCluster: cluster,
      desiredtaskcount: 1,
      useSpotInstances: props.configuration.useSpotInstances ?? false,
      listner: listner,
      securityGroups: [serviceSecurityGroup],
      secrets: {
        IRMA_TOKEN: ecs.Secret.fromSecretsManager(apiKey),
        IRMA_GEMEENTE_PRIVKEY: ecs.Secret.fromSecretsManager(privateKey),
      },
      environment: {
        IRMA_GW_URL: `api.${this.hostedzone.zoneName}`, // protocol prefix is added in the container
      },
    });

    // Allow role to use the protection key for accessing the secrets on startup
    const role = service.service.taskDefinition.executionRole;
    if (!role) {
      throw Error('No task execution role defined!');
    }

    // TODO figure out if we need to use a cusotm key
    // const protectionKeyArn = ssm.StringParameter.valueForStringParameter(this, Statics.ssmProtectionKeyArn);
    // service.allowToDecryptUsingKey(protectionKeyArn);
    privateKey.grantRead(role);
    apiKey.grantRead(role);
    asset.repository.grantPull(role);

  }

  /**
   * Build an docker image asset.
   * Name it using the irmogo version and a random uuid.
   * Note on inspector scanning: the image is placed in the cdk-assets ECR repository,
   * Inspector scans this repository and findings are published to SecurityHub.
   * @param props
   * @returns
   */
  buildContainer(props: ContainerStackProps) {
    const img = new DockerImageAsset(this, 'image', {
      directory: './src/container',
      buildArgs: {
        BUILD_FOR_ENVIRONMENT: props.configuration.branch,
        IRMA_VERSION: props.configuration.yiviVersionNumber,
        IRMA_CHECKSUM: props.configuration.yiviVersionChecksum,
        ALPINE_VERSION: props.configuration.alpineLinuxVersion,
      },
    });
    return img;
  }


}