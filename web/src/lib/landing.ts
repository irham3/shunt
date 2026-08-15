export const HERO_SUBTEXT =
  "Set one policy. Each USDC payment reaches spending, emergency, obligations, and a locked goal in one Stellar transaction.";

export const PROOF_ITEMS = [
  { label: "Public source", value: "GitHub repository", href: "https://github.com/irham3/shunt" },
  { label: "Testnet contract", value: "v1 vault deployment", href: "https://stellar.expert/explorer/testnet/contract/CDMFJZ6VRD2JEV7J2W7KMZZ3AXNSOST2C6L2KYRJAYIN7ULWJEOCWO5B" },
  { label: "Deployment proof", value: "Soroban testnet transactions", href: "https://stellar.expert/explorer/testnet" },
  { label: "Pilot report", value: "Pending publication", href: "#pilot" },
] as const;

export function heroSubtextWordCount() {
  return HERO_SUBTEXT.trim().split(/\s+/).length;
}

export function computeLandingRoute(amount: number, emergencyFull = false) {
  const gross = Math.max(0, Math.round(amount * 100) / 100);
  const gap = Math.max(0, 1000 - (emergencyFull ? 1000 : 0));
  const emergency = Math.min(gap, Math.floor((gross * 2000) / 10000));
  const afterEmergency = gross - emergency;
  const obligation = Math.floor((afterEmergency * 3000) / 10000);
  const afterObligation = afterEmergency - obligation;
  const goal = Math.floor((afterObligation * 2000) / 10000);
  return { gross, emergency, obligation, goal, spendable: Math.max(0, afterObligation - goal) };
}
