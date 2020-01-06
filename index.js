import { TransactionBuilder } from './src/js/transactionBuilder.js'
import * as wallet from './src/js/wallet';

module.exports = () => {
    return {
        TransactionBuilder,
        wallet
    };
}