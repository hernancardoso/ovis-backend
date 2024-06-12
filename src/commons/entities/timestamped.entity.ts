import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class TimestampedEntity {
    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}