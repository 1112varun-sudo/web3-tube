const fs = require("fs");
const path = require("path");

process.env.APPDATA = path.join(process.cwd(), ".appdata");
process.env.LOCALAPPDATA = path.join(process.cwd(), ".localappdata");
process.env.HARDHAT_NETWORK = "localhost";

const hre = require("hardhat");

async function main() {
  const VideoPlatform = await hre.ethers.getContractFactory("VideoPlatform");
  const contract = await VideoPlatform.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deployment = { address };

  fs.mkdirSync(path.join(process.cwd(), "deployments"), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), "deployments", "localhost.json"),
    JSON.stringify(deployment, null, 2)
  );

  fs.writeFileSync(
    path.join(process.cwd(), "client", "src", "contract-address.json"),
    JSON.stringify(deployment, null, 2)
  );

  console.log("Contract deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
