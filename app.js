/* ============================================================
   LASTCALL · dapp
   纯静态、无构建、无后端。所有状态直读 BSC 合约。
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.LASTCALL_CONFIG || {};
  var ZERO = "0x0000000000000000000000000000000000000000";
  // ?demo=1 → 纯前端演示数据（不做任何链上读写），用于路演 / 截图 / 社群预热
  var DEMO = /[?&]demo=1(&|$)/.test(location.search);

  var SALE_ABI = [
    "function info() view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,address)",
    "function sharesOf(address) view returns (uint256)",
    "function buy(uint256 shares, address referrer) payable",
    "function buy(uint256 shares) payable",
    "function claim()",
    "function refund()",
    "function openRefund()"
  ];
  var TOKEN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
  ];

  var $ = function (id) { return document.getElementById(id); };
  var state = {
    info: null,          // {sharesSold,totalShares,raised,hardCap,price,tokensPerShare,maxPerWallet,start,end,launched,refundOpen,pair}
    account: null,
    myShares: 0,
    provider: null,
    rpcIndex: 0,
    timer: null,
    ref: null
  };

  // ---------------------------------------------------------------- utils
  function toast(msg, isErr) {
    var t = $("toast");
    t.textContent = msg;
    t.className = "toast show" + (isErr ? " err" : "");
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.className = "toast"; }, isErr ? 6000 : 3800);
  }
  function fmt(n, d) {
    var v = Number(n);
    if (!isFinite(v)) return "—";
    return v.toLocaleString("en-US", { maximumFractionDigits: d === undefined ? 2 : d });
  }
  function short(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; }
  function deployed() { return CFG.sale && CFG.sale.toLowerCase() !== ZERO; }

  // ---------------------------------------------------------------- provider
  function getProvider() {
    if (state.provider) return state.provider;
    var list = CFG.rpc || ["https://bsc-dataseed.binance.org"];
    // 依次试 RPC，谁先活下来用谁
    for (var i = 0; i < list.length; i++) {
      try {
        state.provider = new ethers.JsonRpcProvider(list[i], CFG.chainId || 56, { staticNetwork: true });
        return state.provider;
      } catch (e) { /* next */ }
    }
    return null;
  }

  // ---------------------------------------------------------------- read
  async function readChain() {
    if (DEMO) { renderDemo(); return; }
    if (!deployed()) { renderStatic(); return; }
    var p = getProvider();
    if (!p) return;
    try {
      var sale = new ethers.Contract(CFG.sale, SALE_ABI, p);
      var r = await sale.info();
      state.info = {
        sharesSold: Number(r[0]), totalShares: Number(r[1]), raised: r[2],
        hardCap: r[3], price: r[4], tokensPerShare: r[5], maxPerWallet: Number(r[6]),
        start: Number(r[7]), end: Number(r[8]), launched: r[9], refundOpen: r[10], pair: r[11]
      };
      if (state.account) {
        state.myShares = Number(await sale.sharesOf(state.account));
      }
      render();
    } catch (e) {
      console.warn("chain read failed", e);
      renderStatic();
    }
  }

  // 演示模式：把示例数据喂给同一套 render()，走完全一致的 UI 路径
  function renderDemo() {
    var now = Math.floor(Date.now() / 1000);
    state.info = {
      sharesSold: 680, totalShares: 2000,
      raised: ethers.parseEther("6.8"), hardCap: ethers.parseEther("20"),
      price: ethers.parseEther("0.01"), tokensPerShare: ethers.parseEther("250000"),
      maxPerWallet: 10, start: now - 6 * 3600, end: now + 10 * 3600,
      launched: false, refundOpen: false, pair: ZERO, demo: true
    };
    render();
    $("cardStatus").textContent = "演示数据 · 非链上";
    $("cardStatus").className = "pill warn";
    $("statusText").textContent = "演示";
    $("actionBtn").textContent = "演示预览 · 合约部署后开放买入";
    $("actionBtn").disabled = true;
    $("actionBtn").dataset.mode = "demo";
    if (!$("demoBar")) {
      var bar = document.createElement("div");
      bar.id = "demoBar";
      bar.className = "demo-bar";
      bar.innerHTML = '演示预览 · 页面数字为示例（680 / 2000 份），不读取链上数据；真实上线后打开不带 <code>?demo=1</code> 的地址即为实盘。';
      document.body.insertBefore(bar, document.body.firstChild);
    }
  }

  function renderStatic() {
    var ts = Number(CFG.totalShares || 2000);
    $("soldShares").textContent = "—";
    $("raised").textContent = "—";
    $("pct").textContent = "0%";
    $("hardCap").textContent = CFG.hardCap || "20";
    $("bar").style.width = "0%";
    $("statusText").textContent = "未部署";
    $("statusText").className = "";
    $("cardStatus").textContent = "待部署";
    $("cardStatus").className = "pill warn";
    $("actionBtn").textContent = "合约部署后开放";
    $("actionBtn").disabled = true;
    $("tokenAddr").textContent = CFG.token || "部署后自动填充";
    $("saleAddr").textContent = CFG.sale || "部署后自动填充";
    document.title = (CFG.brand || "LASTCALL") + " · 20 BNB 硬顶 · 卖满自动开池";
  }

  // ---------------------------------------------------------------- render
  function render() {
    var i = state.info;
    if (!i) return;
    var pct = i.totalShares ? (i.sharesSold / i.totalShares) * 100 : 0;

    $("soldShares").textContent = fmt(i.sharesSold, 0);
    $("raised").textContent = fmt(ethers.formatEther(i.raised), 2);
    $("pct").textContent = pct.toFixed(pct > 0 && pct < 100 ? 1 : 0) + "%";
    $("bar").style.width = Math.min(100, pct) + "%";
    $("hardCap").textContent = fmt(ethers.formatEther(i.hardCap), 0);
    $("pricePer").textContent = fmt(ethers.formatEther(i.price), 4);
    $("receivable").textContent = fmt(ethers.formatEther(i.tokensPerShare), 0);

    // 状态
    var now = Math.floor(Date.now() / 1000);
    var st = "live", stTxt = "进行中", pill = "live";
    if (i.launched) { st = "done"; stTxt = "已开池"; pill = "done"; }
    else if (i.refundOpen) { st = "refund"; stTxt = "退款中"; pill = "warn"; }
    else if (now < i.start) { st = "soon"; stTxt = "即将开售"; pill = "live"; }
    else if (now > i.end) { st = "expired"; stTxt = "已结束"; pill = "warn"; }

    $("statusText").textContent = stTxt;
    $("statusText").className = st === "live" || st === "done" ? "status-live" : "";
    $("cardStatus").textContent = i.launched ? "已开池 · 可领取" : (i.refundOpen ? "可全额退款" : stTxt);
    $("cardStatus").className = "pill " + pill;

    renderActions(st, now);
    renderMine();
    tick();
  }

  function renderActions(st, now) {
    var btn = $("actionBtn"), claim = $("claimBtn"), refund = $("refundBtn");
    btn.classList.remove("hide"); claim.classList.add("hide"); refund.classList.add("hide");

    if (!state.account) {
      btn.textContent = "连接钱包"; btn.disabled = false; btn.dataset.mode = "connect"; return;
    }
    if (st === "done") {
      btn.classList.add("hide");
      if (state.myShares > 0) { claim.classList.remove("hide"); claim.textContent = "领取 " + fmt(state.myShares * tokensPer(), 0) + " 枚"; }
      else { btn.classList.remove("hide"); btn.textContent = "已开池 · 去 PancakeSwap"; btn.disabled = false; btn.dataset.mode = "swap"; }
      return;
    }
    if (st === "refund") {
      btn.classList.add("hide");
      if (state.myShares > 0) { refund.classList.remove("hide"); refund.textContent = "全额退款 " + fmt(state.myShares * bnbPer(), 4) + " BNB"; }
      else { btn.classList.remove("hide"); btn.textContent = "你没参与本次铸造"; btn.disabled = true; }
      return;
    }
    if (st === "expired") {
      btn.textContent = "开启退款通道"; btn.disabled = false; btn.dataset.mode = "openRefund"; return;
    }
    if (st === "soon") {
      btn.textContent = "开售倒计时中"; btn.disabled = true; return;
    }
    // live
    btn.dataset.mode = "buy";
    btn.disabled = false;
    btn.textContent = "买入 " + shares() + " 份 · " + fmt(shares() * bnbPer(), 3) + " BNB";
  }

  function bnbPer() {
    return state.info ? Number(ethers.formatEther(state.info.price)) : 0.01;
  }
  function tokensPer() {
    return state.info ? Number(ethers.formatEther(state.info.tokensPerShare)) : 250000;
  }

  function renderMine() {
    var box = $("mineBox");
    if (!state.account) { box.classList.add("hide"); return; }
    box.classList.remove("hide");
    var left = state.info ? Math.max(0, state.info.maxPerWallet - state.myShares) : 10;
    $("myShares").textContent = state.myShares;
    $("myQuota").textContent = left + " / " + (state.info ? state.info.maxPerWallet : 10);
  }

  // ---------------------------------------------------------------- countdown
  function tick() {
    var el = $("countdown"), unit = $("countdownUnit");
    if (!state.info) return;
    var now = Math.floor(Date.now() / 1000);
    var i = state.info;
    var target, label;
    if (i.launched) { el.textContent = "—"; unit.textContent = "已开池"; return; }
    if (i.refundOpen) { el.textContent = "—"; unit.textContent = "可退款"; return; }
    if (now < i.start) { target = i.start; label = "后开售"; }
    else if (now <= i.end) { target = i.end; label = "后结束"; }
    else { el.textContent = "0h 00m 00s"; unit.textContent = "已到期"; return; }

    var d = target - now;
    var h = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60), s = d % 60;
    el.textContent = (h > 0 ? h + "h " : "") + String(m).padStart(2, "0") + "m " + String(s).padStart(2, "0") + "s";
    unit.textContent = label;
  }

  // ---------------------------------------------------------------- wallet
  async function connect() {
    if (!window.ethereum) {
      toast("没检测到钱包，请安装 MetaMask / 币安 Web3 钱包后打开本页", true);
      return null;
    }
    try {
      var accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureChain();
      state.account = ethers.getAddress(accounts[0]);
      $("connectBtn").textContent = short(state.account);
      $("myAddrInput").value = state.account;
      makeRef(state.account);
      await readChain();
      return state.account;
    } catch (e) {
      toast(errorText(e), true);
      return null;
    }
  }

  async function ensureChain() {
    var hex = "0x" + Number(CFG.chainId || 56).toString(16);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e) {
      if (e.code === 4902 || (e.data && e.data.originalError)) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: hex,
            chainName: CFG.chainName || "BNB Smart Chain",
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: [CFG.rpc[0]],
            blockExplorerUrls: [CFG.explorer || "https://bscscan.com"]
          }]
        });
      }
    }
  }

  function errorText(e) {
    if (!e) return "操作失败";
    if (e.code === 4001) return "你取消了签名";
    var m = (e.shortMessage || e.message || "").toString();
    if (/insufficient funds/i.test(m)) return "钱包 BNB 不够付 gas + 本金";
    if (/WalletCap/i.test(m)) return "超过每钱包 10 份上限";
    if (/SoldOut/i.test(m)) return "已售罄";
    if (/Closed/i.test(m)) return "销售已关闭";
    if (/Ended/i.test(m)) return "已过销售截止时间";
    if (/NotStarted/i.test(m)) return "还没到开售时间";
    if (/WrongValue/i.test(m)) return "付款金额与份额不匹配";
    return m.slice(0, 120) || "操作失败";
  }

  // ---------------------------------------------------------------- actions
  function shares() {
    var v = parseInt($("shares").value, 10);
    if (!isFinite(v) || v < 1) v = 1;
    var max = state.info ? state.info.maxPerWallet : (CFG.maxPerWallet || 10);
    var left = state.info && state.account ? Math.max(0, max - state.myShares) : max;
    if (v > max) v = max;
    if (v > left) v = left || 1;
    return v;
  }

  async function act() {
    var mode = $("actionBtn").dataset.mode;
    if (mode === "connect") return connect();
    if (mode === "swap") return window.open("https://pancakeswap.finance/swap?outputCurrency=" + CFG.token, "_blank");
    if (mode === "openRefund") return write("openRefund", []);
    if (mode === "buy") return buy();
  }

  async function buy() {
    if (!window.ethereum) return toast("请先安装钱包", true);
    try {
      await ensureChain();
      var sp = new ethers.BrowserProvider(window.ethereum);
      var signer = await sp.getSigner();
      var sale = new ethers.Contract(CFG.sale, SALE_ABI, signer);
      var n = shares();
      var value = BigInt(state.info.price) * BigInt(n);
      toast("确认交易中…");
      var tx = state.ref
        ? await sale["buy(uint256,address)"](n, state.ref, { value: value })
        : await sale["buy(uint256)"](n, { value: value });
      toast("交易已提交，等待确认… " + short(tx.hash));
      await tx.wait();
      toast("买入成功！" + n + " 份已记账");
      await readChain();
    } catch (e) { toast(errorText(e), true); }
  }

  async function write(fn, args) {
    if (!window.ethereum) return toast("请先安装钱包", true);
    try {
      await ensureChain();
      var sp = new ethers.BrowserProvider(window.ethereum);
      var signer = await sp.getSigner();
      var c = new ethers.Contract(CFG.sale, SALE_ABI, signer);
      toast("确认交易中…");
      var tx = await c[fn].apply(c, args);
      await tx.wait();
      toast("成功");
      await readChain();
    } catch (e) { toast(errorText(e), true); }
  }

  // ---------------------------------------------------------------- referral
  function makeRef(addr) {
    if (!addr) return;
    var url = location.origin + location.pathname + "?ref=" + addr;
    $("refOut").textContent = url;
    var share = $("shareX");
    if (share) {
      share.href = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(
        "关门前最后一轮 · $" + (CFG.symbol || "LASTCALL") + " ｜ 20 BNB 硬顶，只有 200 个钱包能上车 · 卖满自动开池、LP 锁死黑洞，未满 24h 全额退款"
      ) + "&url=" + encodeURIComponent(url);
    }
  }

  function captureRef() {
    var m = location.search.match(/[?&]ref=(0x[a-fA-F0-9]{40})/);
    if (m) {
      try {
        state.ref = ethers.getAddress(m[1]);
        $("refWho").innerHTML = "你正在通过 <b>" + short(state.ref) + "</b> 的邀请参与，邀请关系会写进买入交易。";
        $("refLine").innerHTML = "通过 <b>" + short(state.ref) + "</b> 的邀请链接参与 · 推荐奖励按链上记录结算";
      } catch (e) { state.ref = null; }
    }
  }

  // ---------------------------------------------------------------- ui wiring
  function wire() {
    $("connectBtn").addEventListener("click", connect);
    $("actionBtn").addEventListener("click", act);

    $("claimBtn").addEventListener("click", function () { write("claim", []); });
    $("refundBtn").addEventListener("click", function () { write("refund", []); });

    function step(d) {
      var max = state.info ? state.info.maxPerWallet : 10;
      var v = Math.min(max, Math.max(1, shares() + d));
      $("shares").value = v;
      syncQuote();
      renderActions(state.info && state.info.launched ? "done" : "live", Math.floor(Date.now() / 1000));
    }
    $("minus").addEventListener("click", function () { step(-1); });
    $("plus").addEventListener("click", function () { step(1); });
    $("shares").addEventListener("input", syncQuote);
    document.querySelectorAll("[data-q]").forEach(function (b) {
      b.addEventListener("click", function () {
        $("shares").value = b.dataset.q;
        syncQuote();
        if (state.info) renderActions(state.info.launched ? "done" : "live", Math.floor(Date.now() / 1000));
      });
    });

    document.querySelectorAll("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var el = $(b.dataset.copy);
        var txt = el.textContent.trim();
        if (!txt || /待部署|自动生成|部署后/.test(txt)) return toast("还没有内容可复制", true);
        navigator.clipboard.writeText(txt).then(function () { toast("已复制"); }, function () { toast("复制失败", true); });
      });
    });

    $("genRef").addEventListener("click", function () {
      var v = $("myAddrInput").value.trim();
      try {
        var a = ethers.getAddress(v);
        makeRef(a);
        toast("邀请链接已生成");
      } catch (e) { toast("地址格式不对", true); }
    });

    window.addEventListener("scroll", function () {
      $("nav").classList.toggle("scrolled", window.scrollY > 12);
    });

    if (window.ethereum) {
      window.ethereum.on && window.ethereum.on("accountsChanged", function (accs) {
        state.account = accs && accs.length ? ethers.getAddress(accs[0]) : null;
        $("connectBtn").textContent = state.account ? short(state.account) : "连接钱包";
        readChain();
      });
      window.ethereum.on && window.ethereum.on("chainChanged", function () { location.reload(); });
      // 已经授权过就直接连上
      window.ethereum.request({ method: "eth_accounts" }).then(function (accs) {
        if (accs && accs.length) {
          state.account = ethers.getAddress(accs[0]);
          $("connectBtn").textContent = short(state.account);
          $("myAddrInput").value = state.account;
          makeRef(state.account);
          readChain();
        }
      }).catch(function () {});
    }
  }

  function syncQuote() {
    var n = shares();
    $("shares").value = n;
    var price = bnbPer();
    var tps = tokensPer();
    $("payable").textContent = fmt(n * price, 4);
    $("receivable").textContent = fmt(n * tps, 0);
    if (state.account && $("actionBtn").dataset.mode === "buy") {
      $("actionBtn").textContent = "买入 " + n + " 份 · " + fmt(n * price, 3) + " BNB";
    }
  }

  function bakeStatic() {
    $("year").textContent = new Date().getFullYear();
    $("brandSym").textContent = CFG.symbol || "LASTCALL";
    $("sym2").textContent = CFG.symbol || "LASTCALL";
    if (CFG.token) {
      $("tokenAddr").textContent = CFG.token;
      $("tokenScan").href = (CFG.explorer || "https://bscscan.com") + "/address/" + CFG.token;
      $("footToken").href = $("tokenScan").href;
      if ($("tokenSrc")) $("tokenSrc").href = "https://sourcify.dev/#/lookup/" + CFG.token;
    }
    if (CFG.sale) {
      $("saleAddr").textContent = CFG.sale;
      $("saleScan").href = (CFG.explorer || "https://bscscan.com") + "/address/" + CFG.sale;
      $("footSale").href = $("saleScan").href;
      if ($("saleSrc")) $("saleSrc").href = "https://sourcify.dev/#/lookup/" + CFG.sale;
    }
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    bakeStatic();
    captureRef();
    wire();
    syncQuote();
    readChain();
    setInterval(tick, 1000);
    setInterval(readChain, 15000);   // 15 秒刷新链上数据
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
