/**
 * Контракт маппера entity → wire-DTO (тип из generated / api-contract).
 */
export interface EntityMapper<TEntity, TDto> {
    toDto(entity: TEntity): TDto;
    toDtoList(entities: TEntity[]): TDto[];
}
