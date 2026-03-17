import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CreateFirmwareUploadUrlDto } from './dto/create-firmware-upload-url.dto';
import {
  FirmwareArtifactEntity,
  FirmwareArtifactStatus,
  FirmwareTarget,
} from './entities/firmware-artifact.entity';

@Injectable()
export class FirmwareService {
  private readonly s3: S3Client;
  private readonly bucket = process.env.AWS_FIRMWARE_BUCKET || '';

  constructor(
    @InjectRepository(FirmwareArtifactEntity)
    private readonly firmwareRepo: Repository<FirmwareArtifactEntity>
  ) {
    const awsConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
      },
    };
    this.s3 = new S3Client(awsConfig);
  }

  async createUploadUrl(
    dto: CreateFirmwareUploadUrlDto
  ) {
    if (!this.bucket) {
      throw new BadRequestException('Missing AWS_FIRMWARE_BUCKET env var.');
    }

    const artifactId = randomUUID();
    const sanitizedFileName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `firmwares/${dto.version}/${artifactId}/${sanitizedFileName}`;

    const artifact = this.firmwareRepo.create({
      id: artifactId,
      name: dto.name,
      version: dto.version,
      description: dto.description ?? null,
      target: FirmwareTarget.APP,
      fileName: dto.fileName,
      s3Bucket: this.bucket,
      s3Key,
      sha256: dto.sha256 ?? null,
      status: FirmwareArtifactStatus.PENDING_UPLOAD,
    });

    await this.firmwareRepo.save(artifact);

    const putCommand = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: 'application/octet-stream',
    });

    // 15 minutes is usually enough for a single upload
    // Cast avoids rare type mismatches when aws-sdk subdeps are not perfectly deduped.
    const putUrl = await getSignedUrl(this.s3 as any, putCommand as any, { expiresIn: 900 });

    return { artifactId, putUrl, s3Key, bucket: this.bucket };
  }

  async completeUpload(id: string, sha256?: string) {
    const artifact = await this.firmwareRepo.findOne({ where: { id } });
    if (!artifact) throw new NotFoundException('Firmware artifact not found');

    const head = await this.s3.send(
      new HeadObjectCommand({
        Bucket: artifact.s3Bucket,
        Key: artifact.s3Key,
      })
    );

    const sizeBytes = head.ContentLength ?? null;

    artifact.sizeBytes = sizeBytes;
    artifact.sha256 = sha256 ?? artifact.sha256 ?? null;
    artifact.status = FirmwareArtifactStatus.READY;

    await this.firmwareRepo.save(artifact);
    return artifact;
  }

  async list() {
    return this.firmwareRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getReadyArtifact(id: string) {
    const artifact = await this.firmwareRepo.findOne({ where: { id } });
    if (!artifact) throw new NotFoundException('Firmware artifact not found');
    if (artifact.status !== FirmwareArtifactStatus.READY) {
      throw new BadRequestException('Firmware artifact is not ready yet (upload not completed).');
    }
    return artifact;
  }

  async delete(id: string) {
    const artifact = await this.firmwareRepo.findOne({ where: { id } });
    if (!artifact) throw new NotFoundException('Firmware artifact not found');

    // Best-effort delete the S3 object (ignore failures so DB cleanup still happens)
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: artifact.s3Bucket,
          Key: artifact.s3Key,
        })
      );
    } catch {
      // ignore
    }

    await this.firmwareRepo.softRemove(artifact);
    return true;
  }
}

