import { ethers, network, run } from "hardhat";

/**
 * Deploy ResolutionOracle to the target network.
 *
 * ADMIN = process.env.ADMIN_ADDRESS      (defaults to deployer)
 * RESOLVER = process.env.RESOLVER_ADDRESS (defaults to deployer)
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network baseSepolia
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = process.env.ADMIN_ADDRESS ?? deployer.address;
  const resolver = process.env.RESOLVER_ADDRESS ?? deployer.address;

  console.log(`\nDeploying ResolutionOracle to ${network.name}`);
  console.log(`  deployer : ${deployer.address}`);
  console.log(`  admin    : ${admin}`);
  console.log(`  resolver : ${resolver}`);
  console.log(`  balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  const Factory = await ethers.getContractFactory("ResolutionOracle");
  const contract = await Factory.deploy(admin, resolver);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const domainSep = await contract.domainSeparator();
  const deployTx = contract.deploymentTransaction();

  console.log(`✓ ResolutionOracle deployed at: ${address}`);
  console.log(`  tx hash         : ${deployTx?.hash}`);
  console.log(`  block           : ${deployTx?.blockNumber ?? "pending"}`);
  console.log(`  domain sep (v4) : ${domainSep}\n`);

  if (network.name === "baseSepolia") {
    console.log("Waiting 30s before Etherscan verification...");
    await new Promise((r) => setTimeout(r, 30_000));
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [admin, resolver],
      });
      console.log("✓ Verified on BaseScan Sepolia");
    } catch (e: any) {
      console.warn(`! Verification skipped: ${e?.message ?? e}`);
    }
    console.log(`\nBaseScan: https://sepolia.basescan.org/address/${address}`);
  }

  console.log("\nNext steps:");
  console.log(`  • Save CONTRACT_ADDRESS=${address} to .env`);
  console.log(`  • Fund resolver wallet if different from deployer`);
  console.log(`  • Grant DISPUTER_ROLE to governance multisig (later)`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
