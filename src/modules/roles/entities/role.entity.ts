import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('roles')
export class Role {
    @PrimaryGeneratedColumn({name:'role_id'})
    roleId!: number

    @Column({
        type:'varchar',
        unique:true,
        length:45
    })
    name!: string
}
