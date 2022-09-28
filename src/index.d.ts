declare module 'lamden-js' {
    export class TransactionBuilder extends Network {}

    export class Network {
        version: string
        events: EventEmitter
        hosts: string[]
        currencySymbol: string
        name: string
        lamden: boolean
        blockExplorer: string | undefined
    
        get host(): string
        get url(): string
        getNetworkVersion(): number
        getNetworkInfo(): WalletMeta
        pingServer(): Promise<boolean>
        getVariable(contractName: string, variableName: string, key: string): Promise<{
            value?: number | Float | string
            error?: string
        }>
        getCurrencyBalance(vk: string):  Promise<{
            value?: number | Float | string
            error?: string
        }>
        contractExists(contractName: string): Promise<boolean>
        getLastetBlock(): Promise<{
            value?: number
            error?: string
        }>
    }
    
    type WalletMeta = {
        name: string,
        lamden: boolean,
        type: string,
        hosts: string[],
        blockservice_hosts: string[],
        url: string,
        online: boolean,
        version: string
    }
    
    type Float = {
        __fixed__: string
    }

    interface EventEmitter {
        on(name: string, listener: Function): void
        removeListener(name: string, listenerToRemove: Function): void
        emit(name:string, data: object): void
    }
}