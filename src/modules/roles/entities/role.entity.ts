import { User } from "@/modules/users/entities/user.entity";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

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

    // roles -> users (1-> N)
    @OneToMany(()=> User,(user)=> user.role)
    user!: User[]
}
