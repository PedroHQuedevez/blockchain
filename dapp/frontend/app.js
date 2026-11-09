const STUDENTS = ["nome1", "nome2", "nome3", "nome4", "nome5"];
const RANKED_USERS = ["roberta", ...STUDENTS];
const ABI = [
  "function owner() view returns (address)",
  "function professor() view returns (address)",
  "function codenameByAddress(address) view returns (string)",
  "function users(string) view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function voting() view returns (bool)",
  "function issueToken(string,uint256)",
  "function votingOn()",
  "function votingOff()",
  "function vote(string,uint256)",
  "event VoteCast(address indexed voter,string voterCodename,string candidateCodename,uint256 amount)",
  "event TokensIssued(string codename,address indexed recipient,uint256 amount)",
  "event VotingStatusChanged(bool active)",
];

const elements = Object.fromEntries(
  [
    "connection-status",
    "connect-button",
    "contract-address",
    "load-button",
    "notice",
    "voting-status",
    "total-supply",
    "my-balance",
    "ranking",
    "refresh-button",
    "vote-form",
    "vote-candidate",
    "vote-amount",
    "admin-panel",
    "issue-form",
    "issue-candidate",
    "issue-amount",
    "voting-on-button",
    "voting-off-button",
  ].map((id) => [id, document.getElementById(id)])
);

let provider;
let signer;
let contract;
let account;

for (const select of [elements["vote-candidate"], elements["issue-candidate"]]) {
  for (const student of STUDENTS) {
    const option = document.createElement("option");
    option.value = student;
    option.textContent = student;
    select.append(option);
  }
}

function showNotice(message, isError = false) {
  elements.notice.textContent = message;
  elements.notice.classList.toggle("error", isError);
}

function showError(error) {
  showNotice(error.shortMessage || error.reason || error.message, true);
}

async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("Instale ou habilite uma carteira compatível com MetaMask.");
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  account = await signer.getAddress();
  elements["connection-status"].textContent = `${account.slice(0, 6)}…${account.slice(-4)}`;
  await loadContract();
}

async function loadContract() {
  const address = elements["contract-address"].value.trim();
  if (!ethers.isAddress(address)) {
    throw new Error("Informe um endereço de contrato válido.");
  }
  if (!provider) {
    if (!window.ethereum) {
      throw new Error("Instale ou habilite uma carteira compatível com MetaMask.");
    }
    provider = new ethers.BrowserProvider(window.ethereum);
  }
  if (!signer) {
    signer = await provider.getSigner().catch(() => null);
    account = signer ? await signer.getAddress() : null;
  }
  contract = new ethers.Contract(address, ABI, signer || provider);
  await refreshDashboard();
  await updateRole();
  contract.removeAllListeners();
  contract.on("VoteCast", refreshDashboard);
  contract.on("TokensIssued", refreshDashboard);
  contract.on("Transfer", refreshDashboard);
  contract.on("VotingStatusChanged", refreshDashboard);
  localStorage.setItem("turing-contract-address", address);
  showNotice("Contrato conectado.");
}

async function updateRole() {
  if (!contract || !account) {
    elements["admin-panel"].hidden = true;
    elements["vote-form"].hidden = true;
    return;
  }
  const [owner, professor, codename] = await Promise.all([
    contract.owner(),
    contract.professor(),
    contract.codenameByAddress(account),
  ]);
  elements["admin-panel"].hidden =
    account.toLowerCase() !== owner.toLowerCase() &&
    account.toLowerCase() !== professor.toLowerCase();
  elements["vote-form"].hidden = codename.length === 0;
  if (codename.length === 0) {
    showNotice("Esta carteira não está cadastrada para votar.", true);
  }
}

async function refreshDashboard() {
  if (!contract) {
    return;
  }
  const [isVoting, totalSupply] = await Promise.all([
    contract.voting(),
    contract.totalSupply(),
  ]);
  elements["voting-status"].textContent = isVoting ? "Ativa" : "Pausada";
  elements["total-supply"].textContent = totalSupply.toString();

  if (account) {
    const codename = await contract.codenameByAddress(account);
    if (codename.length > 0) {
      elements["my-balance"].textContent = (
        await contract.balanceOf(account)
      ).toString();
    } else {
      elements["my-balance"].textContent = "—";
    }
  }

  const ranking = await Promise.all(
    RANKED_USERS.map(async (codename) => {
      const address = await contract.users(codename);
      return {
        codename,
        balance:
          address === ethers.ZeroAddress ? 0n : await contract.balanceOf(address),
      };
    })
  );
  ranking.sort((left, right) =>
    left.balance === right.balance
      ? left.codename.localeCompare(right.codename)
      : left.balance > right.balance
        ? -1
        : 1
  );

  elements.ranking.replaceChildren();
  ranking.forEach(({ codename, balance }, index) => {
    const row = document.createElement("li");
    const position = document.createElement("span");
    const name = document.createElement("span");
    const score = document.createElement("span");
    position.className = "rank-number";
    position.textContent = String(index + 1);
    name.className = "rank-name";
    name.textContent = codename;
    score.className = "rank-balance";
    score.textContent = `${balance.toString()} TRN`;
    row.append(position, name, score);
    elements.ranking.append(row);
  });
}

async function sendTransaction(action, successMessage) {
  if (!contract || !signer) {
    throw new Error("Conecte a carteira e carregue o contrato primeiro.");
  }
  showNotice("Aguardando confirmação da transação…");
  const transaction = await action();
  await transaction.wait();
  showNotice(successMessage);
  await refreshDashboard();
}

elements["connect-button"].addEventListener("click", async () => {
  try {
    await connectWallet();
    showNotice("Carteira conectada.");
  } catch (error) {
    showError(error);
  }
});

elements["load-button"].addEventListener("click", async () => {
  try {
    await loadContract();
    await updateRole();
  } catch (error) {
    showError(error);
  }
});

elements["refresh-button"].addEventListener("click", async () => {
  try {
    await refreshDashboard();
    showNotice("Ranking atualizado.");
  } catch (error) {
    showError(error);
  }
});

elements["vote-form"].addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await sendTransaction(
      () =>
        contract.vote(
          elements["vote-candidate"].value,
          BigInt(elements["vote-amount"].value)
        ),
      "Voto registrado."
    );
  } catch (error) {
    showError(error);
  }
});

elements["issue-form"].addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await sendTransaction(
      () =>
        contract.issueToken(
          elements["issue-candidate"].value,
          BigInt(elements["issue-amount"].value)
        ),
      "Turings emitidos."
    );
  } catch (error) {
    showError(error);
  }
});

elements["voting-on-button"].addEventListener("click", async () => {
  try {
    await sendTransaction(() => contract.votingOn(), "Votação aberta.");
  } catch (error) {
    showError(error);
  }
});

elements["voting-off-button"].addEventListener("click", async () => {
  try {
    await sendTransaction(() => contract.votingOff(), "Votação pausada.");
  } catch (error) {
    showError(error);
  }
});

if (window.ethereum) {
  window.ethereum.on("accountsChanged", async (accounts) => {
    signer = null;
    account = accounts[0] || null;
    elements["connection-status"].textContent = account
      ? `${account.slice(0, 6)}…${account.slice(-4)}`
      : "Carteira desconectada";
    if (account && contract) {
      signer = await provider.getSigner();
      contract = contract.connect(signer);
      await updateRole();
      await refreshDashboard();
    } else {
      elements["admin-panel"].hidden = true;
      elements["vote-form"].hidden = true;
      elements["my-balance"].textContent = "—";
    }
  });
}

const savedAddress = localStorage.getItem("turing-contract-address");
if (savedAddress) {
  elements["contract-address"].value = savedAddress;
}
