import { Injectable } from '@nestjs/common';

import { SEARCH_PACK, SearchPack } from './search-pack.data';

@Injectable()
export class SearchPackService {
    get(): SearchPack {
        return SEARCH_PACK;
    }
}
