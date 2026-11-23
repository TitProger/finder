import { ServiceResult } from '../../../common/service-result.interface';

/** HTTP write-CRUD (create + update + delete). */
export interface WriteCrudHttpService<TDto, TCreateDto = Partial<TDto>, TUpdateDto = Partial<TDto>> {
    create(dto: TCreateDto): Promise<ServiceResult<TDto>>;
    update(id: string, dto: TUpdateDto): Promise<ServiceResult<TDto>>;
    delete(id: string): Promise<ServiceResult<{ id: string }>>;
}
