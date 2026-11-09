# Turing dApp

Local Hardhat dApp for issuing Turing tokens and voting on student codenames.
The token starts with a zero supply and uses whole-number Turing units. It
implements ERC-20 transfers and allowances, registered users, owner/professor
administration, and a one-Turing reward for every tenth vote cast by a user.

## Run locally

1. Install the project dependencies:

   ```powershell
   npm install
   ```

2. Start the local Hardhat blockchain in one terminal:

   ```powershell
   npm run node
   ```

3. In a second terminal, compile, test, and deploy to that local blockchain:

   ```powershell
   npm run compile
   npm test
   npm run deploy -- --network localhost
   ```

   Copy the deployed contract address printed by the deploy command.

4. Serve the frontend in another terminal:

   ```powershell
   npm run frontend
   ```

   Open `http://localhost:8000`, connect MetaMask configured for the local
   Hardhat network (`http://127.0.0.1:8545`, chain ID `31337`), and import one
   of Hardhat's test accounts. Paste the deployed address into the dApp.

The owner is the account that deploys the contract. The professor address and
the initial user aliases are taken from the assignment spreadsheet. The
professor alias is omitted from the student vote and issuance selectors.
