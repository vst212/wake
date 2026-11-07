/* ============================================================
   WAKE · site config
   部署完合约后运行 `node scripts/deploy.js`，这个文件会被自动重写。
   （本地演示用 scripts/config.demo.local.js 覆盖本文件）
   ============================================================ */
window.WAKE_CONFIG = {
  brand: "WAKE",
  symbol: "WAKE",
  chainId: 56,
  chainName: "BNB Smart Chain",
  rpc: [
    "https://bsc-dataseed.binance.org",
    "https://bsc-dataseed1.defibit.io",
    "https://bsc-dataseed1.ninicoin.io",
    "https://bsc.publicnode.com"
  ],
  explorer: "https://bscscan.com",
  // ---- 部署后自动填充 ----
  token: "",
  sale: "",
  pair: "",
  marketing: "",
  startTime: 0,
  endTime: 0,
  // ---- 兜底展示值（链上读不到时才用）----
  pricePerShare: "0.01",
  tokensPerShare: "250000",
  totalShares: 2000,
  hardCap: "20",
  maxPerWallet: 10
};
