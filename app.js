const API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:3000" : "";
const refreshButton = document.querySelector("[data-refresh]");
const exportCsvButton = document.querySelector("[data-export-csv]");
const autoRefreshLabel = document.querySelector(".hero-card small");
const heroValue = document.querySelector(".hero-value");
const heroMeta = document.querySelectorAll(".hero-card .metric-row span");
const metricCards = document.querySelectorAll(".metric-card");
const assetList = document.querySelector(".asset-list");
const legend = document.querySelector(".legend");
const donutValue = document.querySelector(".donut span");
const timeline = document.querySelector(".timeline");
const poolStats = document.querySelectorAll(".pool-stat strong");
const positionCards = document.querySelector(".position-cards");
const riskList = document.querySelector(".risk-list");
const tableBody = document.querySelector("tbody");
const walletButton = document.querySelector(".wallet-button");
const networkPill = document.querySelector(".network-pill");
const sidebarStatus = document.querySelector(".sidebar-card");
const featureList = document.querySelector("[data-feature-list]");
const appKitStatus = document.querySelector("[data-appkit-status]");
const managedStatus = document.querySelector("[data-managed-status]");
const unifiedStatus = document.querySelector("[data-unified-status]");
const arcChainId = document.querySelector("[data-arc-chain-id]");

let refreshTimer = 22;

function money(value, digits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function compactMoney(value) {
  return `$${Math.round(Number(value || 0) / 1000)}K`;
}

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "success" || normalized === "completed" || normalized === "healthy") return "success";
  if (normalized === "failed" || normalized === "danger") return "danger";
  if (normalized === "pending") return "pulse";
  return "warning";
}

function tokenClass(kind) {
  return ["usdc", "arc", "custom", "lp"].includes(kind) ? kind : "custom";
}

function riskClass(level) {
  if (level === "danger") return "red";
  if (level === "success") return "green";
  return "amber";
}

function shortenHash(value) {
  if (!value || !value.startsWith("0x") || value.length < 14) return value || "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function setBackendStatus(healthy, dashboard) {
  const dot = sidebarStatus?.querySelector(".status-dot");
  const title = sidebarStatus?.querySelector("strong");
  const subtitle = sidebarStatus?.querySelector("small");
  if (!dot || !title || !subtitle) return;

  dot.style.background = healthy ? "var(--green)" : "var(--red)";
  title.textContent = healthy ? "Backend synced" : "Backend offline";
  subtitle.textContent = healthy
    ? `${dashboard.network.rpcLatencyMs} ms RPC latency`
    : "Using static fallback";
}

function renderDashboard(dashboard) {
  heroValue.textContent = dashboard.formatted.totalValueUsd;
  heroMeta[0].textContent = `+${dashboard.portfolio.simulatedYieldPercent}% simulated yield`;
  heroMeta[1].textContent = `${dashboard.portfolio.trackedChains} chains tracked`;

  metricCards[1].querySelector("strong").textContent = dashboard.formatted.availableLiquidityUsd;
  metricCards[1].querySelector(".progress-line span").style.width = `${dashboard.portfolio.liquidityDepthPercent}%`;
  metricCards[2].querySelector("strong").textContent = dashboard.portfolio.pendingTransactions;
  metricCards[2].querySelector(".pending-chip").lastChild.textContent = ` ${dashboard.portfolio.pendingStatus}`;
  metricCards[2].querySelector("p").textContent = `Next status poll in ${dashboard.portfolio.statusPollSeconds} seconds.`;
  metricCards[3].querySelector("strong").textContent = dashboard.formatted.gasFeeUsd;
  metricCards[3].querySelector(".metric-row span:first-child").textContent = `Finality ${dashboard.portfolio.finalitySeconds}s`;
  metricCards[3].querySelector(".metric-row span:last-child").textContent = dashboard.portfolio.gasTrend;

  walletButton.textContent = dashboard.wallet.shortAddress;
  networkPill.lastChild.textContent = ` ${dashboard.network.name}`;

  assetList.innerHTML = dashboard.tokens
    .map(
      (token) => `
        <div class="asset-row">
          <span class="token-badge ${tokenClass(token.kind)}">${token.badge}</span>
          <div>
            <strong>${token.symbol}</strong>
            <small>${token.label}</small>
          </div>
          <span>${money(token.balance)}</span>
          <b>$${money(token.valueUsd)}</b>
        </div>
      `
    )
    .join("");

  donutValue.textContent = compactMoney(dashboard.portfolio.totalValueUsd);
  legend.innerHTML = dashboard.chainDistribution
    .map((item, index) => {
      const classes = ["arc-swatch", "eth-swatch", "base-swatch", "op-swatch"];
      return `<span><i class="swatch ${classes[index] || "arc-swatch"}"></i>${item.chain} ${item.percent}%</span>`;
    })
    .join("");

  timeline.innerHTML = dashboard.workflow.steps
    .map(
      (step) => `
        <li class="${step.status === "completed" ? "done" : step.status === "pending" ? "active" : ""}">
          <span></span>
          <div>
            <strong>${step.title}</strong>
            <small>${step.detail}</small>
          </div>
        </li>
      `
    )
    .join("");

  poolStats[0].textContent = `$${money(dashboard.liquidityPool.reserveUsd, 0)}`;
  poolStats[1].textContent = `${dashboard.liquidityPool.poolSharePercent}%`;
  poolStats[2].textContent = `${dashboard.liquidityPool.priceImpactGuardPercent}%`;

  positionCards.innerHTML = Object.values(dashboard.positions)
    .map(
      (position) => `
        <div>
          <small>${position.label}</small>
          <strong>${position.value}</strong>
          <span>${position.detail}</span>
        </div>
      `
    )
    .join("");

  riskList.innerHTML = dashboard.risk.items
    .map(
      (item) => `
        <li>
          <span class="risk-dot ${riskClass(item.level)}"></span>
          ${item.message}
        </li>
      `
    )
    .join("");

  tableBody.innerHTML = dashboard.activities
    .map(
      (activity) => `
        <tr>
          <td>${activity.type}</td>
          <td>${activity.asset}</td>
          <td>${money(activity.amount)}</td>
          <td><span class="pill ${statusClass(activity.status)}">${activity.status}</span></td>
          <td>$${money(activity.feeUsd)}</td>
          <td>${shortenHash(activity.txHash)}</td>
        </tr>
      `
    )
    .join("");

  if (dashboard.integration) {
    renderIntegration(dashboard.integration);
  }

  setBackendStatus(true, dashboard);
}

function renderIntegration(integration) {
  arcChainId.textContent = `Chain ${integration.arc.chainId}`;
  appKitStatus.textContent = integration.appKit.kitKeyConfigured ? "Ready" : "SDK ready, key needed";
  managedStatus.textContent = integration.managedWallet.ready ? "Ready" : "Secrets needed";
  unifiedStatus.textContent = integration.unifiedBalance.gatewayMode;

  featureList.innerHTML = integration.features
    .map(
      (feature) => `
        <button type="button" data-enable-feature="${feature.id}">
          <strong>${feature.label}</strong>
          <span>${feature.primaryIntegration}</span>
        </button>
      `
    )
    .join("");
}

async function enableFeature(feature) {
  const response = await fetch(`${API_BASE}/api/features/${feature}/enable`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokenIn: feature === "cross_chain_swap" ? "EURC" : "USDC",
      tokenOut: feature === "cross_chain_swap" || feature === "swap" ? "USDC" : undefined,
      amount: "1.00",
      sourceChain: "Arc_Testnet",
      destinationChain: feature === "bridge_usdc" || feature === "cross_chain_swap" ? "Ethereum_Sepolia" : "Arc_Testnet"
    })
  });
  if (!response.ok) throw new Error(`Feature enablement failed: ${response.status}`);
  const result = await response.json();
  autoRefreshLabel.textContent = `${result.feature.label}: ${result.plan.primaryIntegration}`;
  return result;
}

async function loadDashboard() {
  const response = await fetch(`${API_BASE}/api/dashboard`);
  if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
  const dashboard = await response.json();
  renderDashboard(dashboard);
  return dashboard;
}

function tickRefreshTimer() {
  refreshTimer -= 1;
  if (refreshTimer <= 0) {
    refreshTimer = 30;
    autoRefreshLabel.textContent = "Auto refresh: now";
    loadDashboard().catch(() => setBackendStatus(false, null));
    return;
  }

  autoRefreshLabel.textContent = `Auto refresh: ${refreshTimer}s`;
}

function flashRows() {
  document.querySelectorAll("tbody tr").forEach((row, index) => {
    window.setTimeout(() => {
      row.style.background = "rgba(56, 189, 248, 0.11)";
      window.setTimeout(() => {
        row.style.background = "";
      }, 520);
    }, index * 90);
  });
}

refreshButton?.addEventListener("click", () => {
  refreshTimer = 30;
  autoRefreshLabel.textContent = "Auto refresh: refreshed";
  loadDashboard()
    .then(flashRows)
    .catch(() => setBackendStatus(false, null));
});

exportCsvButton?.addEventListener("click", () => {
  window.location.href = `${API_BASE}/api/activity/export.csv`;
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-enable-feature]");
  if (!button) return;
  enableFeature(button.dataset.enableFeature)
    .then(flashRows)
    .catch(() => {
      autoRefreshLabel.textContent = "Feature route unavailable";
    });
});

loadDashboard()
  .then(() => {
    window.setInterval(tickRefreshTimer, 1000);
  })
  .catch(() => {
    setBackendStatus(false, null);
    window.setInterval(tickRefreshTimer, 1000);
  });
