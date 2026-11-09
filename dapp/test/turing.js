const { expect } = require("chai");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Turing", function () {
  async function deployTuringFixture() {
    const signers = await ethers.getSigners();
    const [owner, nome1, nome2, nome3, nome4, nome5] = signers;
    const turing = await ethers.deployContract("Turing");
    await turing.waitForDeployment();

    return { turing, signers, owner, nome1, nome2, nome3, nome4, nome5 };
  }

  describe("Deployment", function () {
    it("starts with no issued tokens and registers the provided users", async function () {
      const { turing, owner, nome1, nome2, nome3, nome4, nome5 } =
        await loadFixture(deployTuringFixture);

      expect(await turing.name()).to.equal("Turing");
      expect(await turing.symbol()).to.equal("TRN");
      expect(await turing.decimals()).to.equal(0);
      expect(await turing.owner()).to.equal(owner.address);
      expect(await turing.professor()).to.equal(
        "0x502542668aF09fa7aea52174b9965A7799343Df7"
      );
      expect(await turing.totalSupply()).to.equal(0);
      expect(await turing.voting()).to.equal(true);
      expect(await turing.users("roberta")).to.equal(await turing.professor());
      expect(await turing.users("nome1")).to.equal(nome1.address);
      expect(await turing.users("nome2")).to.equal(nome2.address);
      expect(await turing.users("nome3")).to.equal(nome3.address);
      expect(await turing.users("nome4")).to.equal(nome4.address);
      expect(await turing.users("nome5")).to.equal(nome5.address);
    });
  });

  describe("Administration", function () {
    it("allows only the owner or professor to manage users and voting", async function () {
      const { turing, nome1, signers } = await loadFixture(deployTuringFixture);

      await expect(turing.connect(nome1).votingOff()).to.be.revertedWith(
        "Not authorized"
      );
      await expect(
        turing.connect(nome1).updateUser("new-user", signers[6].address)
      ).to.be.revertedWith("Not authorized");
      await expect(turing.updateUser("", signers[6].address)).to.be.revertedWith(
        "Codename cannot be empty"
      );

      await turing.updateUser("new-user", signers[6].address);
      expect(await turing.users("new-user")).to.equal(signers[6].address);

      await turing.votingOff();
      expect(await turing.voting()).to.equal(false);
      await turing.votingOn();
      expect(await turing.voting()).to.equal(true);
    });

    it("allows the professor to issue tokens to registered users", async function () {
      const { turing, owner, nome1 } = await loadFixture(deployTuringFixture);
      const professor = await ethers.getImpersonatedSigner(
        await turing.professor()
      );
      await owner.sendTransaction({
        to: professor.address,
        value: ethers.parseEther("1"),
      });

      await turing.connect(professor).issueToken("nome1", 4);
      expect(await turing.balanceOf(nome1.address)).to.equal(4);
      expect(await turing.totalSupply()).to.equal(4);
    });
  });

  describe("Voting", function () {
    it("mints votes to candidates and prevents invalid or duplicate votes", async function () {
      const { turing, nome1, signers } = await loadFixture(deployTuringFixture);

      await expect(turing.connect(nome1).vote("nome2", 2))
        .to.emit(turing, "VoteCast")
        .withArgs(nome1.address, "nome1", "nome2", 2);
      expect(await turing.balanceOf(await turing.users("nome2"))).to.equal(2);
      expect(await turing.hasVote("nome1", "nome2")).to.equal(true);

      await expect(turing.connect(nome1).vote("nome2", 1)).to.be.revertedWith(
        "Already voted for user"
      );
      await expect(turing.connect(nome1).vote("nome1", 1)).to.be.revertedWith(
        "Cannot vote for yourself"
      );
      await expect(turing.connect(nome1).vote("nome3", 0)).to.be.revertedWith(
        "Vote must be 1 or 2 Turings"
      );
      await expect(turing.connect(nome1).vote("nome3", 3)).to.be.revertedWith(
        "Vote must be 1 or 2 Turings"
      );
      await expect(
        turing.connect(signers[6]).vote("nome3", 1)
      ).to.be.revertedWith("User is not registered");
    });

    it("pauses votes when voting is off", async function () {
      const { turing, owner, nome1 } = await loadFixture(deployTuringFixture);

      await turing.connect(owner).votingOff();
      await expect(turing.connect(nome1).vote("nome2", 1)).to.be.revertedWith(
        "Voting is not active"
      );
    });

    it("rewards one Turing on each user's tenth vote", async function () {
      const { turing, nome1, signers } = await loadFixture(deployTuringFixture);

      for (let i = 1; i <= 10; i += 1) {
        const codename = `candidate-${i}`;
        await turing.updateUser(codename, signers[i + 5].address);
        await turing.connect(nome1).vote(codename, 1);
      }

      expect(await turing.voteCount(nome1.address)).to.equal(10);
      expect(await turing.balanceOf(nome1.address)).to.equal(1);
      expect(await turing.totalSupply()).to.equal(11);
    });
  });

  describe("ERC-20 transfers", function () {
    it("transfers balances and respects allowances", async function () {
      const { turing, owner, nome1, nome2 } = await loadFixture(
        deployTuringFixture
      );

      await turing.issueToken("nome1", 5);
      await turing.connect(nome1).transfer(nome2.address, 2);
      expect(await turing.balanceOf(nome1.address)).to.equal(3);
      expect(await turing.balanceOf(nome2.address)).to.equal(2);

      await turing.connect(nome1).approve(owner.address, 2);
      await turing.connect(owner).transferFrom(nome1.address, nome2.address, 2);
      expect(await turing.balanceOf(nome1.address)).to.equal(1);
      expect(await turing.balanceOf(nome2.address)).to.equal(4);
      expect(await turing.allowance(nome1.address, owner.address)).to.equal(0);
    });
  });
});
