import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Categories {
    @PrimaryGeneratedColumn({name:'category_id'})
    category_id: number;

    @Column({
        type:'varchar', 
        length:4, 
        unique: true
    })
    code: string;

    @Column({
        type:'varchar', 
        length:45, 
        unique: true
    })
    name: string;

    @Column({
        type:'boolean',
        default: true
    })
    state: boolean;
} 
