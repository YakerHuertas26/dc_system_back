import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Category {
    @PrimaryGeneratedColumn({name:'category_id'})
    id: number;

    @Column({
        type:'varchar', 
        length:4, 
        unique: true
    })
    code: string;

    @Column({
        type:'varchar', 
        length:4, 
        unique: true
    })
    name: string;

    @Column({
        type:'boolean',
        default: true
    })
    state: boolean;
}
