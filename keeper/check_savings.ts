import { Address, Contract, rpc, TransactionBuilder, Networks } from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org";
const VAULT_CONTRACT_ID = "CDMFJZ6VRD2JEV7J2W7KMZZ3AXNSOST2C6L2KYRJAYIN7ULWJEOCWO5B";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const account = "GBO53TYNTYQVHUNI6NIMVHAGFF4RQCEDMAPCJDBLICBK7DAMEQLLM2RR";

async function run() {
  const server = new rpc.Server(RPC_URL);
  
  // get account sequence
  const source = await server.getAccount(account);
  
  const contract = new Contract(VAULT_CONTRACT_ID);
  const tx = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("get_savings", new Address(account).toScVal()))
    .setTimeout(30)
    .build();

  const res = await server.simulateTransaction(tx);
  console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
