import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, Stage, StageProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { ContainerStack } from './ContainerStack';
import { Statics } from './Statics';

export interface ContainerStageProps extends StageProps, Configurable {}

export class ContainerStage extends Stage {
  constructor(scope: Construct, id: string, props: ContainerStageProps) {
    super(scope, id, props);

    // Setup tagging and our permission boundary for all stacks
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    new ContainerStack(this, 'stack', {
      env: props.configuration.deploymentEnvironment,
      configuration: props.configuration,
    });

  }
}
