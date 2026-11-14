import { SiteRole } from '../../domain/enums/site-role.enum';

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

const SITE_ROLE_BY_KEY: Record<string, SiteRole> = {
    f: SiteRole.FACTORY_CONTACT,
    c: SiteRole.CHINA_OPEN_PRICE,
    r: SiteRole.RUSSIA_RETAIL,
    w: SiteRole.RUSSIA_WHOLESALE,
};

export type ParsedCallback =
    | { type: 'assign'; inquiryId: string; index: number }
    | { type: 'list'; inquiryId: string; page: number }
    | { type: 'pick'; inquiryId: string; page: number; index: number }
    | { type: 'new'; inquiryId: string }
    | { type: 'site_role'; role: SiteRole };

/** callback_data короче 64 байт: действие, id заявки и номер кнопки. */
export function parseCallback(data: string): ParsedCallback | null {
    const assign = new RegExp(`^a:(${UUID}):([0-2])$`).exec(data);

    if (assign) {
        return { type: 'assign', inquiryId: assign[1], index: Number(assign[2]) };
    }

    const list = new RegExp(`^l:(${UUID}):(\\d{1,3})$`).exec(data);

    if (list) {
        return { type: 'list', inquiryId: list[1], page: Number(list[2]) };
    }

    const pick = new RegExp(`^p:(${UUID}):(\\d{1,3}):(\\d{1,2})$`).exec(data);

    if (pick) {
        return { type: 'pick', inquiryId: pick[1], page: Number(pick[2]), index: Number(pick[3]) };
    }

    const created = new RegExp(`^n:(${UUID})$`).exec(data);

    if (created) {
        return { type: 'new', inquiryId: created[1] };
    }

    const site = /^sr:([fcrw])$/.exec(data);

    if (site) {
        return { type: 'site_role', role: SITE_ROLE_BY_KEY[site[1]] };
    }

    return null;
}
