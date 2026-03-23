const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VideoPlatform", function () {
  async function deployVideoPlatform() {
    const VideoPlatform = await ethers.getContractFactory("VideoPlatform");
    const [owner, otherAccount] = await ethers.getSigners();
    const videoPlatform = await VideoPlatform.deploy();

    await videoPlatform.waitForDeployment();

    return { videoPlatform, owner, otherAccount };
  }

  it("starts with zero videos", async function () {
    const { videoPlatform } = await deployVideoPlatform();

    expect(await videoPlatform.videoCount()).to.equal(0);
  });

  it("stores uploaded video details with metadata fields", async function () {
    const { videoPlatform, owner } = await deployVideoPlatform();
    const hash = "QmTestHash";
    const title = "My first video";

    await videoPlatform.uploadVideo(hash, title);

    const video = await videoPlatform.videos(1);

    expect(await videoPlatform.videoCount()).to.equal(1);
    expect(video.id).to.equal(1);
    expect(video.hash).to.equal(hash);
    expect(video.title).to.equal(title);
    expect(video.author).to.equal(owner.address);
    expect(video.views).to.equal(0);
    expect(video.likes).to.equal(0);
    expect(video.commentCount).to.equal(0);
  });

  it("tracks views and toggled likes", async function () {
    const { videoPlatform, owner } = await deployVideoPlatform();

    await videoPlatform.uploadVideo("QmHash", "Demo");
    await videoPlatform.viewVideo(1);
    await videoPlatform.toggleLike(1);

    let video = await videoPlatform.videos(1);
    expect(video.views).to.equal(1);
    expect(video.likes).to.equal(1);
    expect(await videoPlatform.hasLiked(1, owner.address)).to.equal(true);

    await videoPlatform.toggleLike(1);

    video = await videoPlatform.videos(1);
    expect(video.likes).to.equal(0);
    expect(await videoPlatform.hasLiked(1, owner.address)).to.equal(false);
  });

  it("stores comments for a video", async function () {
    const { videoPlatform, otherAccount } = await deployVideoPlatform();

    await videoPlatform.uploadVideo("QmHash", "Demo");
    await videoPlatform.connect(otherAccount).addComment(1, "Nice video");

    const video = await videoPlatform.videos(1);
    const comment = await videoPlatform.getComment(1, 1);

    expect(video.commentCount).to.equal(1);
    expect(comment[0]).to.equal(otherAccount.address);
    expect(comment[1]).to.equal("Nice video");
    expect(comment[2]).to.be.greaterThan(0);
  });

  it("rejects empty uploads and comments", async function () {
    const { videoPlatform } = await deployVideoPlatform();

    await expect(videoPlatform.uploadVideo("", "Title")).to.be.revertedWith(
      "Video hash required"
    );

    await expect(
      videoPlatform.uploadVideo("QmTestHash", "")
    ).to.be.revertedWith("Title required");

    await videoPlatform.uploadVideo("QmHash", "Demo");

    await expect(videoPlatform.addComment(1, "")).to.be.revertedWith(
      "Comment required"
    );
  });
});
