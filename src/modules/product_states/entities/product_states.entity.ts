import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('product_states')
export class ProductStates {
    @PrimaryGeneratedColumn({name: 'product_state_id'})
    productStateId: number;

    @Column({
        type: 'varchar',
        length: 45,
    })
    name: string;
}
