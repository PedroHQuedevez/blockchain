async function main() {
  const turing = await ethers.deployContract("Turing");
  await turing.waitForDeployment();

  console.log(`Turing deployed to: ${await turing.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
