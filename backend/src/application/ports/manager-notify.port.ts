export const MANAGER_NOTIFY = Symbol('MANAGER_NOTIFY');

export type ManagerButton = {
    text: string;
    callbackData: string;
};

export interface ManagerNotifyPort {
    send(chatId: number, text: string, buttons?: ManagerButton[][]): Promise<void>;
}
