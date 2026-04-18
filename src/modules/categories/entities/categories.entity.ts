import { Product } from "@/modules/products/entities/product.entity";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Categories {
    @PrimaryGeneratedColumn({name:'category_id'})
    categoryId!: number;

    @Column({
        type:'varchar', 
        length:4, 
        unique: true
    })
    code?: string;

    @Column({
        type:'varchar', 
        length:45, 
        unique: true
    })
    name!: string;

    @Column({
        type:'boolean',
        default: true
    })
    state!: boolean;

    @OneToMany(()=> Product , (product) => product.category)
    products!: Product[];
}