import { METRICS_ROUTE } from '../constants';

export const isMetricsRoute = (url: string): boolean => url === METRICS_ROUTE;
