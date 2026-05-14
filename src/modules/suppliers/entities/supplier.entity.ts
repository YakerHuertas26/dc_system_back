import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('suppliers')
export class Supplier {
    @PrimaryGeneratedColumn({name: 'supplier_id'})
    supplierId! : number;
    
    @Column({
        type: 'varchar',
        unique: true,
        length: 45
    })
    name! : string;

    @Column({
        type: 'varchar',
        unique: true,
        length: 11
    })
    ruc! : string;

    @Column({
        type: 'varchar',
        unique: true,
        length: 9,
        nullable: true
    })
    phone? : string;

    @Column({
        name:'bank_account',
        type: 'varchar',
        unique: true,
        length: 25,
        nullable: true
    })
    bankAccount? : string;

    @Column({
        type: 'boolean',
        default: true,
    })
    state! : boolean;
}
