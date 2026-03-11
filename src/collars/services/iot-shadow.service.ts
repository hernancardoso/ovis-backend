import { BadRequestException, Injectable } from '@nestjs/common';
import { IoTClient, DescribeEndpointCommand } from '@aws-sdk/client-iot';
import {
  GetThingShadowCommand,
  IoTDataPlaneClient,
  UpdateThingShadowCommand,
} from '@aws-sdk/client-iot-data-plane';

@Injectable()
export class IotShadowService {
  private readonly region = process.env.AWS_REGION || 'us-east-1';
  private readonly iot: IoTClient;
  private dataPlane?: IoTDataPlaneClient;
  private endpointAddress?: string;

  constructor() {
    const awsConfig = {
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
      },
    };

    this.iot = new IoTClient(awsConfig);
  }

  private async getDataPlaneClient() {
    if (this.dataPlane) return this.dataPlane;

    // Allow overriding discovery (useful for local/dev and faster startup).
    const envEndpoint = process.env.AWS_IOT_DATA_ENDPOINT?.trim();
    if (envEndpoint) {
      this.endpointAddress = envEndpoint.replace(/^https?:\/\//, '');
    } else {
      const resp = await this.iot.send(
        new DescribeEndpointCommand({ endpointType: 'iot:Data-ATS' })
      );
      if (!resp.endpointAddress) {
        throw new BadRequestException(
          'Unable to resolve AWS IoT Data endpoint (DescribeEndpoint).'
        );
      }
      this.endpointAddress = resp.endpointAddress;
    }

    this.dataPlane = new IoTDataPlaneClient({
      region: this.region,
      endpoint: `https://${this.endpointAddress}`,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
      },
    });

    return this.dataPlane;
  }

  async getThingShadow(params: { thingName: string; shadowName?: string }) {
    const client = await this.getDataPlaneClient();
    const resp = await client.send(
      new GetThingShadowCommand({
        thingName: params.thingName,
        ...(params.shadowName ? { shadowName: params.shadowName } : {}),
      })
    );

    const payloadBytes = resp.payload;
    const payloadText = payloadBytes ? Buffer.from(payloadBytes as any).toString('utf-8') : '';

    let shadow: unknown = null;
    if (payloadText) {
      try {
        shadow = JSON.parse(payloadText);
      } catch {
        shadow = payloadText;
      }
    }

    return {
      thingName: params.thingName,
      shadowName: params.shadowName ?? null,
      shadow,
    };
  }

  async updateThingShadow(params: {
    thingName: string;
    shadowName?: string;
    desired: Record<string, any>;
  }) {
    const client = await this.getDataPlaneClient();

    const payload = {
      state: {
        desired: params.desired ?? {},
      },
    };

    const resp = await client.send(
      new UpdateThingShadowCommand({
        thingName: params.thingName,
        ...(params.shadowName ? { shadowName: params.shadowName } : {}),
        payload: Buffer.from(JSON.stringify(payload), 'utf-8'),
      })
    );

    const payloadBytes = resp.payload;
    const payloadText = payloadBytes ? Buffer.from(payloadBytes as any).toString('utf-8') : '';

    let shadow: unknown = null;
    if (payloadText) {
      try {
        shadow = JSON.parse(payloadText);
      } catch {
        shadow = payloadText;
      }
    }

    return {
      thingName: params.thingName,
      shadowName: params.shadowName ?? null,
      shadow,
    };
  }
}
