/* eslint-disable prettier/prettier */
/* user.entity.ts */
import { CollarEntity } from "src/collars/entities/collar.entity";
import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from "typeorm";

@Entity({ name: 'establishments' })
export class EstablishmentEntity {

    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    name: string;

    //this is not always required
    @OneToMany(() => CollarEntity, (collar) => collar.establishment)
    collars: CollarEntity[]

}