import { Role } from "@/modules/roles/entities/role.entity";
import { Exclude } from "class-transformer";
import { BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import * as bcrypt from 'bcrypt';


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
        length:45,
        select: false
    })
    password!: string

    @Column({
        type:'tinyint',
        default: 1
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

    @UpdateDateColumn({name:'updated_at'})
    updateAt! : Date

    // encriptar contraseña antes de insertar un nuevo usuario
    @BeforeInsert()
    async hashPasswordBeforeInsert(){
        if (this.password) {
            this.password= await bcrypt.hash(this.password,10) 
        }
    }

    // encriptar contraseña antes de actualizar un usuario existente
    @BeforeUpdate()
    async hashPasswordBeforeUpdate(){
        if (this.password && !this.password.startsWith('$2b$')) {
            this.password= await bcrypt.hash(this.password, 10)
        }
    }

    // comparar contraseñas 
    async comparePassword(password: string): Promise<boolean>{
        return await bcrypt.compare(password, this.password)
    }
}
