import Utils from './utils';
import Token from './token';
import * as Web3 from '@solana/web3.js';
import{ initWallet, useWallet } from 'solana-wallets-vue';

import {
    LedgerWalletAdapter,
    PhantomWalletAdapter,
    SlopeWalletAdapter,
    SolflareWalletAdapter,
    SolletExtensionWalletAdapter,
    SolletWalletAdapter,
    TorusWalletAdapter
} from '@solana/wallet-adapter-wallets';


class SolanaWeb3 {

    wallets;

    walletNames = [
        "Phantom",
        "Slope",
        "Solflare",
        "Torus",
        "Ledger",
        "Sollet",
        "Sollet (Extension)"
    ];

    connection;

    walletAdapter;

    connectedWallet;

    connectedAccount;

    connectedPublicKey;

    connectedCluster;

    clusters = {
        "mainnet-beta": {
            node: "mainnet-beta",
            name: "Mainnet",
            host: "https://api.devnet.solana.com",
            explorer: "https://solscan.io/"
        },
        testnet: {
            node: "testnet",
            name: "Testnet",
            host: "https://api.testnet.solana.com",
            explorer: "https://solscan.io/"
        },
        devnet: {
            node: "devnet",
            name: "Devnet",
            host: "https://api.mainnet-beta.solana.com/",
            explorer: "https://solscan.io/"
        }
    }

    token;

    constructor(config) {

        const network = config.cluster;

        const wallets = [
            new PhantomWalletAdapter({ network }),
            new SlopeWalletAdapter({ network }),
            new SolflareWalletAdapter({ network }),
            new TorusWalletAdapter({ network }),
            new LedgerWalletAdapter({ network }),
            new SolletWalletAdapter({ network }),
            new SolletExtensionWalletAdapter({ network }),
        ].filter((wallet) => {
            return config.wallets.includes(wallet.name);
        });

        const walletOptions = {
            wallets,
            autoConnect: false,
        }
    
        initWallet(walletOptions);
        
        this.walletAdapter = useWallet();

        this.connectedCluster = this.clusters[config.cluster];
        this.connection = new Web3.Connection(Web3.clusterApiUrl(config.cluster));
        this.wallets = this.walletAdapter.wallets.value || this.walletAdapter.wallets;

        this.connectedPublicKey = this.getConnectedPublicKey();

        this.token = new Token(this);
    }

    connect(walletName) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.selectWallet(walletName);
                await this.walletAdapter.connect(walletName);

                this.connectedAccount = this.getConnectedAccount();
                this.connectedWallet = this.getConnectedWallet();

                resolve(this.connectedAccount);
            } catch (error) {
                reject(error);
            }
        });
    }

    selectWallet(walletName) {
        return this.walletAdapter.select(walletName);
    }

    getConnectedPublicKey() {
        return this.walletAdapter.publicKey.value || this.walletAdapter.publicKey;
    }

    getConnectedAccount() {
        return this.getConnectedPublicKey().toBase58();
    }

    getConnectedWallet() {
        return this.walletAdapter.wallet.value || this.walletAdapter.wallet;
    }
    
    async getSolBalance() {
        let balance = await this.connection.getBalance(this.getConnectedPublicKey());
        return Utils.toDecimal(balance, 9);
    }

    transfer(toAddress, amount, tokenAddress = null) {
        if (!tokenAddress || tokenAddress == 'SOL') {
            return this.solTransfer(toAddress, amount);
        } else if (tokenAddress) {
            return this.tokenTransfer(toAddress, amount, tokenAddress);
        } else {
            return new Error("invalid-token-address");
        }
    }

    solTransfer(toAddress, amount) {
        return new Promise(async (resolve, reject) => {
            try {

                if (parseFloat(amount) < 0) {
                    return reject('transfer-amount-error');
                }

                if (parseFloat(amount) > await this.getSolBalance()) {
                    return reject('insufficient-balance');
                }

                const fromPublicKey = this.getConnectedPublicKey();
                const toPublicKey = new Web3.PublicKey(toAddress);
                amount = Utils.toHexadecimal(amount, 9);

                const transaction = this.createTransaction(
                    Web3.SystemProgram.transfer({
                        fromPubkey: fromPublicKey,
                        toPubkey: toPublicKey,
                        lamports: amount,
                    })
                );

                const signature = await this.sendTransaction(transaction);

                return resolve(signature);
            } catch (error) {
                return reject(error);
            }
        });
    }

    tokenTransfer(toAddress, amount, tokenAddress) {
        return this.token.transfer(toAddress, amount, tokenAddress);
    }

    createTransaction(instrucion, txOptions = {}) {
        return new Web3.Transaction(txOptions).add(instrucion);
    }

    sendTransaction(transaction, options = {}) {
        return this.walletAdapter.sendTransaction(transaction, this.connection, options);
    }

    confirmTransaction(signature, commitment = 'finalized') {
        return this.connection.confirmTransaction(signature, commitment);
    }

    getTransactionUrl(signature) {
        let node = this.connectedCluster.node;
        let transactionUrl = this.cluster.explorer + "tx/" + signature;
        transactionUrl += node != 'mainnet-beta' ? '?cluster=' + node : '';
        return transactionUrl;
    }

    addEventListener(name, fn) {
        let wallet = this.getConnectedWallet();
        if (wallet) {
            wallet.addListener(name, fn);
        }
    }

    removeEventListener(name) {
        let wallet = this.getConnectedWallet();
        if (wallet) {
            wallet.removeListener(name);
        }
    }
}

window.SolanaWeb3 = SolanaWeb3;

module.exports = SolanaWeb3;