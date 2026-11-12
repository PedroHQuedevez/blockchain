const STUDENTS = Array.from({ length: 15 }, (_, i) => `nome${i + 1}`);
const RANKED_USERS = ["roberta", ...STUDENTS];
const HARDHAT_RPC_URL = "http://127.0.0.1:8545";
const ABI = [
  "function owner() view returns (address)",
  "function professor() view returns (address)",
  "function codenameByAddress(address) view returns (string)",
  "function users(string) view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function voting() view returns (bool)",
  "function issueToken(string,uint256)",
  "function updateUser(string,address)",
  "function votingOn()",
  "function votingOff()",
  "function vote(string,uint256)",
];

const elements = Object.fromEntries(
  [
    "connection-status",
    "connect-button",
    "account-select",
    "contract-address",
    "load-button",
    "notice",
    "voting-status",
    "account-identity",
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
    "update-user-form",
    "update-user-codename",
    "update-user-address",
    "voting-on-button",
    "voting-off-button",
  ].map((id) => [id, document.getElementById(id)])
);

let provider;
let signer;
let contract;
let account;
let availableAccounts = [];
let managedAccounts = [];
let connectionMode;
let transactionInProgress = false;

for (const select of [
  elements["vote-candidate"],
  elements["issue-candidate"],
  elements["update-user-codename"],
]) {
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

async function connectToHardhat() {
  connectionMode = "hardhat";
  const contractAddress = contract ? await contract.getAddress() : null;
  provider = new ethers.JsonRpcProvider(HARDHAT_RPC_URL);
  availableAccounts = await provider.send("eth_accounts", []);
  if (availableAccounts.length === 0) {
    throw new Error("Nenhuma conta disponível no Hardhat. Inicie o nó local.");
  }

  const selectedAddress = availableAccounts[0];
  elements["account-select"].value = selectedAddress;
  signer = await provider.getSigner(selectedAddress);
  account = await signer.getAddress();
  elements["connection-status"].textContent = `${account.slice(0, 6)}…${account.slice(-4)}`;

  if (contractAddress) {
    contract = new ethers.Contract(contractAddress, ABI, signer);
    const activeAddress = await refreshAccountOptions();
    await selectHardhatAccount(activeAddress);
    await updateRole();
    await refreshDashboard();
  } else {
    elements["account-select"].disabled = true;
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("Instale ou habilite uma carteira compatível com MetaMask.");
  }

  connectionMode = "metamask";
  provider = new ethers.BrowserProvider(window.ethereum);
  availableAccounts = await provider.send("eth_requestAccounts", []);
  if (availableAccounts.length === 0) {
    throw new Error("Nenhuma conta autorizada no MetaMask.");
  }
  const selectedAddress = availableAccounts.includes(account)
    ? account
    : availableAccounts[0];
  signer = await provider.getSigner(selectedAddress);
  account = await signer.getAddress();
  elements["connection-status"].textContent = `${account.slice(0, 6)}…${account.slice(-4)}`;
  if (elements["contract-address"].value.trim()) {
    await loadContract();
  } else {
    elements["account-select"].replaceChildren(
      ...availableAccounts.map((address) => {
        const option = document.createElement("option");
        option.value = address;
        option.textContent = `${address.slice(0, 6)}…${address.slice(-4)}`;
        return option;
      })
    );
    elements["account-select"].value = account;
    elements["account-select"].disabled = availableAccounts.length < 2;
  }
}

async function loadContract() {
  const address = elements["contract-address"].value.trim();
  if (!ethers.isAddress(address)) {
    throw new Error("Informe um endereço de contrato válido.");
  }
  if (connectionMode === "metamask" && !window.ethereum) {
    throw new Error("MetaMask não está disponível.");
  }
  if (!provider || !signer) {
    throw new Error("Conecte-se ao MetaMask primeiro.");
  }
  contract = new ethers.Contract(address, ABI, signer);
  if (connectionMode === "hardhat") {
    const activeAddress = await refreshAccountOptions();
    await selectHardhatAccount(activeAddress);
  } else {
    await refreshMetaMaskAccountOptions();
    await updateRole();
  }
  await refreshDashboard();
  localStorage.setItem("turing-contract-address", address);
  showNotice("Contrato conectado.");
}

async function refreshMetaMaskAccountOptions() {
  const [owner, professor] = await Promise.all([
    contract.owner(),
    contract.professor(),
  ]);
  const addresses = [...availableAccounts];
  for (const address of [
    owner,
    professor,
    ...await Promise.all(STUDENTS.map((student) => contract.users(student))),
  ]) {
    if (
      address !== ethers.ZeroAddress &&
      !addresses.some(
        (existing) => existing.toLowerCase() === address.toLowerCase()
      )
    ) {
      addresses.push(address);
    }
  }
  elements["account-select"].replaceChildren(
    ...await Promise.all(
      addresses.map(async (address) => {
        const codename = await contract.codenameByAddress(address);
        const label =
          address.toLowerCase() === owner.toLowerCase()
            ? "Owner"
            : address.toLowerCase() === professor.toLowerCase()
              ? `Professora${codename ? ` — ${codename}` : ""}`
              : codename || "Não cadastrada";
        const option = document.createElement("option");
        option.value = address;
        option.textContent = `${label} (${address.slice(0, 6)}…${address.slice(-4)})`;
        option.disabled = !availableAccounts.some(
          (availableAddress) =>
            availableAddress.toLowerCase() === address.toLowerCase()
        );
        return option;
      })
    )
  );
  elements["account-select"].value = account;
  elements["account-select"].disabled = availableAccounts.length < 2;
}

async function refreshAccountOptions() {
  if (!contract) {
    return account;
  }
  const [owner, professor] = await Promise.all([
    contract.owner(),
    contract.professor(),
  ]);
  const accountIndices = new Map(
    availableAccounts.map((address, index) => [address.toLowerCase(), index])
  );
  const options = [];
  const addAccount = (address, label) => {
    if (
      address !== ethers.ZeroAddress &&
      !options.some(
        (option) => option.address.toLowerCase() === address.toLowerCase()
      )
    ) {
      options.push({ address, label });
    }
  };
  const ownerIndex = accountIndices.get(owner.toLowerCase());
  addAccount(
    owner,
    `${ownerIndex === undefined ? "" : `Account #${ownerIndex} — `}Owner`
  );

  const professorCodename = await contract.codenameByAddress(professor);
  const professorIndex = accountIndices.get(professor.toLowerCase());
  addAccount(
    professor,
    `Professora${professorCodename ? ` — ${professorCodename}` : ""}${
      professorIndex === undefined ? "" : ` (Account #${professorIndex})`
    }`
  );

  for (const student of STUDENTS) {
    const address = await contract.users(student);
    const codename = await contract.codenameByAddress(address);
    const index = accountIndices.get(address.toLowerCase());
    if (codename) {
      addAccount(
        address,
        `${index === undefined ? "" : `Account #${index} — `}${codename}`
      );
    }
  }

  for (const [index, address] of availableAccounts.entries()) {
    if (
      options.some(
        (option) => option.address.toLowerCase() === address.toLowerCase()
      )
    ) {
      continue;
    }
    const codename = await contract.codenameByAddress(address);
    addAccount(
      address,
      `Account #${index} — ${codename || "Não cadastrada"}`
    );
  }

  managedAccounts = options.map(({ address }) => address);
  if (managedAccounts.length === 0) {
    throw new Error("O contrato não possui contas administrativas ou alunos cadastrados.");
  }
  const selectedAddress = managedAccounts.some(
    (address) => address.toLowerCase() === account?.toLowerCase()
  )
    ? account
    : managedAccounts[0];
  elements["account-select"].replaceChildren(
    ...options.map(({ address, label }) => {
      const option = document.createElement("option");
      option.value = address;
      option.textContent = label;
      return option;
    })
  );
  elements["account-select"].value = selectedAddress;
  elements["account-select"].disabled = false;
  return selectedAddress;
}

async function selectHardhatAccount(address) {
  if (
    !provider ||
    !managedAccounts.some(
      (item) => item.toLowerCase() === address.toLowerCase()
    )
  ) {
    throw new Error("Selecione uma conta reconhecida pelo contrato.");
  }
  const professor = contract ? await contract.professor() : null;
  const isProfessor = professor?.toLowerCase() === address.toLowerCase();
  let nextSigner;
  if (isProfessor) {
    await provider.send("hardhat_impersonateAccount", [address]);
    await provider.send("hardhat_setBalance", [
      address,
      "0x56bc75e2d63100000",
    ]);
    nextSigner = new ethers.JsonRpcSigner(provider, address);
  } else {
    nextSigner = await provider.getSigner(address);
  }
  signer = nextSigner;
  account = await signer.getAddress();
  elements["connection-status"].textContent = `${account.slice(0, 6)}…${account.slice(-4)}`;
  if (contract) {
    contract = contract.connect(signer);
    await updateRole();
    await refreshDashboard();
  } else {
    elements["account-identity"].textContent = "Carregue o contrato";
    elements["admin-panel"].hidden = true;
    elements["vote-form"].hidden = true;
  }
}

async function updateRole() {
  if (!contract || !account) {
    elements["admin-panel"].hidden = true;
    elements["vote-form"].hidden = true;
    elements["account-identity"].textContent = "—";
    return;
  }
  const [owner, professor, codename] = await Promise.all([
    contract.owner(),
    contract.professor(),
    contract.codenameByAddress(account),
  ]);
  const isSuperUser =
    account.toLowerCase() === owner.toLowerCase() ||
    account.toLowerCase() === professor.toLowerCase();
  const canVote = codename.length > 0;
  elements["admin-panel"].hidden = !isSuperUser;
  elements["vote-form"].hidden = !canVote;
  updateVoteCandidates(canVote ? codename : "");
  elements["account-identity"].textContent =
    account.toLowerCase() === owner.toLowerCase()
      ? "Owner"
      : account.toLowerCase() === professor.toLowerCase()
        ? `Professora${codename ? ` (${codename})` : ""}`
        : codename
          ? `Usuário: ${codename}`
          : "Não cadastrado";
  if (codename.length === 0) {
    showNotice("Esta carteira não está cadastrada para votar.", true);
  }
}

function updateVoteCandidates(excludedCodename) {
  const selectedCodename = elements["vote-candidate"].value;
  const candidates = STUDENTS.filter(
    (student) => student !== excludedCodename
  );
  elements["vote-candidate"].replaceChildren(
    ...candidates.map((student) => {
      const option = document.createElement("option");
      option.value = student;
      option.textContent = student;
      return option;
    })
  );
  elements["vote-candidate"].value = candidates.includes(selectedCodename)
    ? selectedCodename
    : candidates[0] || "";
}

async function refreshDashboard() {
  if (!contract) {
    return;
  }
  const isVoting = await contract.voting();
  elements["voting-status"].textContent = isVoting ? "Ativa" : "Pausada";

  if (account) {
    elements["my-balance"].textContent = (
      await contract.balanceOf(account)
    ).toString();
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
  if (transactionInProgress) {
    throw new Error("Já existe uma transação aguardando confirmação.");
  }
  transactionInProgress = true;
  try {
    showNotice("Aguardando confirmação da transação…");
    const transaction = await action();
    await transaction.wait();
    showNotice(successMessage);
    await refreshDashboard();
  } finally {
    transactionInProgress = false;
  }
}

elements["connect-button"].addEventListener("click", async () => {
  try {
    await connectWallet();
    showNotice("Conectado ao MetaMask.");
  } catch (error) {
    showError(error);
  }
});

// elements["connect-button"].addEventListener("click", async () => {
//   try {
//     await connectToHardhat();
//     showNotice("Conectado ao Hardhat local.");
//   } catch (error) {
//     showError(error);
//   }
// });

elements["account-select"].addEventListener("change", async (event) => {
  try {
    if (connectionMode === "hardhat") {
      await selectHardhatAccount(event.target.value);
    } else {
      signer = await provider.getSigner(event.target.value);
      account = await signer.getAddress();
      elements["connection-status"].textContent = `${account.slice(0, 6)}…${account.slice(-4)}`;
      if (contract) {
        contract = contract.connect(signer);
        await updateRole();
        await refreshDashboard();
      }
    }
    showNotice("Conta selecionada.");
  } catch (error) {
    elements["account-select"].value = account;
    showError(error);
  }
});

elements["load-button"].addEventListener("click", async () => {
  try {
    await loadContract();
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

elements["update-user-form"].addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const userAddress = elements["update-user-address"].value.trim();
    if (!ethers.isAddress(userAddress)) {
      throw new Error("Informe um endereço Ethereum válido.");
    }
    await sendTransaction(
      () =>
        contract.updateUser(
          elements["update-user-codename"].value,
          userAddress
        ),
      "Usuário atualizado."
    );
    if (connectionMode === "hardhat") {
      await refreshAccountOptions();
    } else {
      await refreshMetaMaskAccountOptions();
    }
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
    try {
      if (connectionMode !== "metamask") {
        return;
      }
      availableAccounts = accounts;
      account = accounts[0] || null;
      elements["connection-status"].textContent = account
        ? `${account.slice(0, 6)}…${account.slice(-4)}`
        : "Carteira desconectada";
      if (account) {
        signer = await provider.getSigner(account);
        if (contract) {
          contract = contract.connect(signer);
          await refreshMetaMaskAccountOptions();
          await updateRole();
          await refreshDashboard();
        }
      } else {
        signer = null;
        elements["account-select"].replaceChildren();
        elements["account-select"].disabled = true;
        elements["admin-panel"].hidden = true;
        elements["vote-form"].hidden = true;
        elements["my-balance"].textContent = "—";
        elements["account-identity"].textContent = "—";
      }
    } catch (error) {
      showError(error);
    }
  });
}

const savedAddress = localStorage.getItem("turing-contract-address");
if (savedAddress) {
  elements["contract-address"].value = savedAddress;
}
