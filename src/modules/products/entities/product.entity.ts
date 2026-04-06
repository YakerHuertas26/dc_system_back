import { Categories } from "@/modules/categories/entities/categories.entity";
import { ProductStates } from "@/modules/product_states/entities/product_states.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('products')
export class Product {
    @PrimaryGeneratedColumn({name:'product_id'})
    productId!: number;

    @Column({
        type: 'varchar',
        length:8,
        unique: true,
        nullable: true
    })
    code!: string;

    @Column({
        type: 'varchar',
        length:45,
        unique:true,
    })
    name!: string;

    @Column({
        type:'text',
        nullable:true
    })
    description?: string;

    @Column({
        name:'sale_price',
        type: 'decimal',
        precision:10,
        scale:2
    })
    salePrice!: number;

    @Column({
        name:'purchase_price',
        type:'decimal',
        precision:10,
        scale:2
    })
    purchasePrice!: number; 

    @ManyToOne(()=> Categories, (category)=> category.products)
    @JoinColumn({name:'category_id'})
    catagory!: Categories;

    @Column({name:'category_id'})
    categoryId!: number;

    @ManyToOne(()=> ProductStates,(productStateId)=> productStateId.products)
    @JoinColumn({name:'product_state_id'})
    productState!: ProductStates;

    @Column({name: 'product_state_id'})
    productStateId!: number

    @CreateDateColumn({name:'created_at'})
    createdAt!: Date

    @UpdateDateColumn({name:'updated_at'})
    updatedAt!: Date 
}
