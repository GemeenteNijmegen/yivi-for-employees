// ~~ Generated by projen. To modify, edit .projenrc.js and run "npx projen".
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Props for VoetbalpoolFunction
 */
export interface VoetbalpoolFunctionProps extends lambda.FunctionOptions {
}

/**
 * An AWS Lambda function which executes src/app/voetbalpool/voetbalpool.
 */
export class VoetbalpoolFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props?: VoetbalpoolFunctionProps) {
    super(scope, id, {
      description: 'src/app/voetbalpool/voetbalpool.lambda.ts',
      ...props,
      runtime: new lambda.Runtime('nodejs20.x', lambda.RuntimeFamily.NODEJS),
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../assets/app/voetbalpool/voetbalpool.lambda')),
    });
    this.addEnvironment('AWS_NODEJS_CONNECTION_REUSE_ENABLED', '1', { removeInEdge: true });
  }
}