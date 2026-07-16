const KEEPER_URL = "https://shunt-keeper.irhamtria.workers.dev";
const account = "GBO53TYNTYQVHUNI6NIMVHAGFF4RQCEDMAPCJDBLICBK7DAMEQLLM2RR";

async function run() {
  const res = await fetch(`${KEEPER_URL}/pending/${account}`);
  const pending = await res.json();
  console.log(`Found ${pending.length} pending splits.`);
  
  for (const p of pending) {
    console.log(`Clearing ${p.txHash}...`);
    await fetch(`${KEEPER_URL}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash: p.txHash }),
    });
  }
  console.log("Done!");
}
run();
