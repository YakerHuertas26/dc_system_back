import { Role } from "@/modules/roles/entities/role.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('users')
export class User {
    @PrimaryGeneratedColumn({name:'user_id'})
    userId!: number

    @Column({
        type: 'varchar',
        length:25
    })
    name!: string

    @Column({
        type:'varchar',
        unique:true,
        length:50
    })
    email!: string

    @Column({
        type: 'varchar',
        length:45
    })
    password!: string

    @Column({
        type:'boolean',
        default: true
    })
    state!: boolean

    // user <- roles (N -> 1) Relación 
    @ManyToOne(()=> Role,(role)=>role.user)
    @JoinColumn({name:'role_id'})
    role!: Role

    // columna
    @Column({name:'role_id'})
    roleId!: number

    @CreateDateColumn({name:'created_at'})
    createAt!: Date

    @UpdateDateColumn({name:'update_at'})
    updateAt! : Date
}
