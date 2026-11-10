import { Supplier } from '../entities/supplier.entity';

// Administrative output only: every supplier route requires the current Admin.
export type SupplierResponseDto = Pick<
  Supplier,
  'supplierId' | 'name' | 'ruc' | 'phone' | 'bankAccount' | 'state'
>;

export function toSupplierResponse(supplier: Supplier): SupplierResponseDto {
  return {
    supplierId: supplier.supplierId,
    name: supplier.name,
    ruc: supplier.ruc,
    phone: supplier.phone,
    bankAccount: supplier.bankAccount,
    state: supplier.state,
  };
}
