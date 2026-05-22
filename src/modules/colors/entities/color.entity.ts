import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('colors')
export class Color {
    @PrimaryGeneratedColumn({name:'color_id'})
    colorId! : number

    @Column({
        type: 'varchar',
        length: 45,
        unique: true
    })
    name! : string
    
    @Column({
        type:"varchar",
        length: 7,
        unique: true
    })
    code!: string
}
