import { Product } from "@/modules/products/entities/product.entity";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

@Entity('product_states')
export class ProductStates {
    @PrimaryGeneratedColumn({name: 'product_state_id'})
    productStateId!: number;

    @Column({
        type: 'varchar',
        length: 45,
    })
    name!: string;

    @OneToMany(()=> Product,(product)=> product.productStateId)
    products!: Product[];
}
