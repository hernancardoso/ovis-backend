import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { IoTClient, CreateJobCommand, DescribeJobExecutionCommand } from '@aws-sdk/client-iot';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { FirmwareService } from 'src/firmware/firmware.service';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { FirmwareArtifactEntity } from 'src/firmware/entities/firmware-artifact.entity';
import { FotaDeploymentEntity } from './entities/fota-deployment.entity';
import { FotaDeploymentTargetEntity, FotaTargetStatus } from './entities/fota-deployment-target.entity';
import { CollarFirmwareHistoryEntity } from './entities/collar-firmware-history.entity';

@Injectable()
export class FotaService {
  private readonly logger = new Logger(FotaService.name);
  private readonly iot: IoTClient;
  private readonly sts: STSClient;
  private readonly s3: S3Client;
  private readonly region = process.env.AWS_REGION || 'us-east-1';
  private accountId?: string;

  constructor(
    private readonly firmwareService: FirmwareService,
    @InjectRepository(FotaDeploymentEntity)
    private readonly deploymentRepo: Repository<FotaDeploymentEntity>,
    @InjectRepository(FotaDeploymentTargetEntity)
    private readonly targetRepo: Repository<FotaDeploymentTargetEntity>,
    @InjectRepository(CollarFirmwareHistoryEntity)
    private readonly historyRepo: Repository<CollarFirmwareHistoryEntity>,
    @InjectRepository(CollarEntity)
    private readonly collarRepo: Repository<CollarEntity>
  ) {
    const awsConfig = {
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
      },
    };
    this.iot = new IoTClient(awsConfig);
    this.sts = new STSClient(awsConfig);
    this.s3 = new S3Client(awsConfig);
  }

  private async getAccountId() {
    if (this.accountId) return this.accountId;
    const resp = await this.sts.send(new GetCallerIdentityCommand({}));
    if (!resp.Account) throw new BadRequestException('Unable to resolve AWS account id (STS).');
    this.accountId = resp.Account;
    return this.accountId;
  }

  private thingArn(thingName: string, accountId: string) {
    return `arn:aws:iot:${this.region}:${accountId}:thing/${thingName}`;
  }

  private toTargetStatus(jobExecutionStatus?: string | undefined): FotaTargetStatus {
    switch (jobExecutionStatus) {
      case 'QUEUED':
        return FotaTargetStatus.QUEUED;
      case 'IN_PROGRESS':
        return FotaTargetStatus.IN_PROGRESS;
      case 'SUCCEEDED':
        return FotaTargetStatus.SUCCEEDED;
      case 'FAILED':
      case 'REJECTED':
      case 'TIMED_OUT':
      case 'CANCELED':
        return FotaTargetStatus.FAILED;
      default:
        return FotaTargetStatus.UNKNOWN;
    }
  }

  private async buildJobDocument(artifact: FirmwareArtifactEntity) {
    // Use a presigned GET URL by default (works for private buckets).
    // Nordic aws_fota expects protocol/host/path split; path should not start with '/'.
    const fullUrl = await getSignedUrl(
      // Cast avoids rare type mismatches when aws-sdk subdeps are not perfectly deduped.
      this.s3 as any,
      new GetObjectCommand({
        Bucket: artifact.s3Bucket,
        Key: artifact.s3Key,
      }) as any,
      { expiresIn: 3600 }
    );

    const u = new URL(fullUrl);
    const protocol = u.protocol; // 'https:'
    const host = u.host; // 'bucket.s3.amazonaws.com'
    const path = `${u.pathname.replace(/^\//, '')}${u.search}`; // include query string if any

    const size = Number(artifact.sizeBytes ?? 0);
    if (!size) {
      throw new BadRequestException('Firmware artifact has no sizeBytes. Complete upload first.');
    }

    return {
      operation: 'app_fw_update',
      fwversion: artifact.version,
      size,
      location: {
        protocol,
        host,
        path,
      },
    };
  }

  async createDeployment(params: {
    establishmentId: EstablishmentEntity['id'];
    firmwareArtifactId: string;
    collarIds: string[];
    createdByEmail?: string | null;
  }) {
    const { establishmentId, firmwareArtifactId, collarIds, createdByEmail } = params;

    const artifact = await this.firmwareService.getReadyArtifact(firmwareArtifactId);
    const collars = await this.collarRepo.find({
      where: { id: In(collarIds), establishmentId },
    });

    if (collars.length !== collarIds.length) {
      throw new BadRequestException('Some collars were not found for this establishment.');
    }

    const jobIdPrefix = `fota-${artifact.version}-${randomUUID()}`.replace(/[^a-zA-Z0-9:_-]/g, '-');
    const deployment = await this.deploymentRepo.save(
      this.deploymentRepo.create({
        firmwareArtifactId,
        jobIdPrefix,
        createdByEmail: createdByEmail ?? null,
      })
    );

    const targets = collars.map((c) =>
      this.targetRepo.create({
        deploymentId: deployment.id,
        collarId: c.id,
        imei: c.imei,
        thingName: String(c.imei),
        status: FotaTargetStatus.UNKNOWN,
      })
    );
    await this.targetRepo.save(targets);

    const accountId = await this.getAccountId();
    const jobDocument = await this.buildJobDocument(artifact);

    // Chunk targets to keep job creation manageable
    const CHUNK_SIZE = 50;
    const chunks: FotaDeploymentTargetEntity[][] = [];
    for (let i = 0; i < targets.length; i += CHUNK_SIZE) chunks.push(targets.slice(i, i + CHUNK_SIZE));

    let jobIndex = 0;
    for (const chunk of chunks) {
      jobIndex++;
      const jobId = `${jobIdPrefix}-${jobIndex}`;
      const targetArns = chunk.map((t) => this.thingArn(t.thingName, accountId));
      let createJobError: any = null;

      try {
        await this.iot.send(
          new CreateJobCommand({
            jobId,
            targets: targetArns,
            document: JSON.stringify(jobDocument),
            description: `OVIS FOTA ${artifact.version} (deployment ${deployment.id})`,
          })
        );
      } catch (e: any) {
        createJobError = e;
        this.logger.error(`CreateJob failed for ${jobId}: ${e?.message ?? e}`);
      }

      const ids = chunk.map((t) => t.id);
      const status = createJobError ? FotaTargetStatus.FAILED : FotaTargetStatus.QUEUED;
      await this.targetRepo.update(
        { id: In(ids) },
        {
          jobId,
          status,
          statusDetails: createJobError ? { error: createJobError?.message ?? String(createJobError) } : undefined,
        }
      );

      // Persist firmware history rows (one per collar per deployment), always (audit trail)
      const historyRows = chunk.map((t) =>
        this.historyRepo.create({
          collarId: t.collarId,
          imei: t.imei,
          firmwareArtifactId: artifact.id,
          deploymentId: deployment.id,
          deploymentTargetId: t.id,
          jobId,
          status,
          statusDetails: createJobError ? { error: createJobError?.message ?? String(createJobError) } : undefined,
        })
      );
      await this.historyRepo.save(historyRows);
    }

    return { deploymentId: deployment.id, jobIdPrefix };
  }

  async listTargets(establishmentId: EstablishmentEntity['id'], deploymentId: string) {
    return this.targetRepo.find({
      where: { deploymentId },
      order: { createdAt: 'ASC' },
    });
  }

  async refreshTargets(establishmentId: EstablishmentEntity['id'], deploymentId: string) {
    const targets = await this.listTargets(establishmentId, deploymentId);

    for (const t of targets) {
      if (!t.jobId) continue;
      try {
        const resp = await this.iot.send(
          new DescribeJobExecutionCommand({
            jobId: t.jobId,
            thingName: t.thingName,
          })
        );
        const exec = resp.execution;
        const execPlain = exec ? JSON.parse(JSON.stringify(exec)) : undefined;
        const status = this.toTargetStatus(exec?.status);
        await this.targetRepo.update(
          { id: t.id },
          {
            status,
            statusDetails: execPlain,
          }
        );

        await this.historyRepo.update(
          { deploymentTargetId: t.id },
          {
            status,
            statusDetails: execPlain,
          }
        );
      } catch (e: any) {
        this.logger.warn(`Failed DescribeJobExecution for ${t.thingName} job ${t.jobId}: ${e?.message ?? e}`);
        await this.targetRepo.update(
          { id: t.id },
          {
            status: FotaTargetStatus.UNKNOWN,
            statusDetails: { error: e?.message ?? String(e) },
          }
        );

        await this.historyRepo.update(
          { deploymentTargetId: t.id },
          {
            status: FotaTargetStatus.UNKNOWN,
            statusDetails: { error: e?.message ?? String(e) },
          }
        );
      }
    }

    return this.listTargets(establishmentId, deploymentId);
  }

  async getHistoryByImei(imei: number) {
    // Return history with firmware version via join (also include soft-deleted firmware artifacts).
    const rows = await this.historyRepo
      .createQueryBuilder('h')
      .withDeleted()
      .leftJoinAndSelect('h.firmwareArtifact', 'fa')
      .where('h.imei = :imei', { imei })
      .orderBy('h.createdAt', 'DESC')
      .getMany();

    return rows.map((r: any) => ({
      ...r,
      firmwareVersion: r.firmwareArtifact?.version ?? null,
    }));
  }
}

