const path = require("path");

process.env.APPDATA = path.join(process.cwd(), ".appdata");
process.env.LOCALAPPDATA = path.join(process.cwd(), ".localappdata");
process.env.HARDHAT_NETWORK = "localhost";

const hre = require("hardhat");

async function fetchVideos() {
  const response = await fetch("http://127.0.0.1:4000/api/videos/export");

  if (!response.ok) {
    throw new Error(`Database export failed with status ${response.status}`);
  }

  const payload = await response.json();
  return payload.videos || [];
}

async function main() {
  const deployment = require(path.join(process.cwd(), "deployments", "localhost.json"));
  const contract = await hre.ethers.getContractAt("VideoPlatform", deployment.address);
  const videos = await fetchVideos();

  if (videos.length === 0) {
    console.log("No videos found in database to restore.");
    return;
  }

  for (const video of videos) {
    const tx = await contract.uploadVideo(video.hash, video.title);
    await tx.wait();
    console.log(`Restored: ${video.title}`);
  }

  console.log(`Restore complete. ${videos.length} videos added back to blockchain.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
