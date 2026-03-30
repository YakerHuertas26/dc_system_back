import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class ProductStates {
    @PrimaryGeneratedColumn({name: 'product_state_id'})
    product_state_id: number;

    @Column({
        type: 'varchar',
        length: 45,
    })
    name: string;
}
