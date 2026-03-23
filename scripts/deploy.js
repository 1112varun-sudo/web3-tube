const hre = require("hardhat");

async function main() {

  const VideoPlatform = await hre.ethers.getContractFactory("VideoPlatform");

  const videoPlatform = await VideoPlatform.deploy();

  await videoPlatform.waitForDeployment();

  console.log("Contract deployed to:", await videoPlatform.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});