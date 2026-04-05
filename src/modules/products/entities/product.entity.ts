import { Categories } from "src/modules/categories/entities/categories.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity('products')
export class Product {
    @PrimaryGeneratedColumn({name:'product_id'})
    productId: number;

    @Column({
        type: 'varchar',
        length:8,
        unique: true,
        nullable: true
    })
    code:string;

    @Column({
        type: 'varchar',
        length:45,
        unique:true,
    })
    name:string;

    @Column({
        type:'text',
        nullable:true
    })
    description?:string;

    @Column({
        type: 'decimal',
        precision:10,
        scale:2
    })
    sale_price:number;

    @Column({
        type:'decimal',
        precision:10,
        scale:2
    })
    purchase_price:number; 

    @ManyToOne(()=> Categories, (category)=> category.products)
    @JoinColumn({name:'category_id'})
    catagory: Categories;

    @Column({name:'category_id'})
    categoryId: number;
}
