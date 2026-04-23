import { expect } from "chai";
import { ethers } from "hardhat";
import { ResolutionOracle } from "../typechain-types";
import { HDNodeWallet } from "ethers";

describe("ResolutionOracle", function () {
  let oracle: ResolutionOracle;
  let admin: HDNodeWallet;
  let resolver: HDNodeWallet;
  let disputer: HDNodeWallet;
  let outsider: HDNodeWallet;

  const MARKET_ID = ethers.keccak256(ethers.toUtf8Bytes("flood-california-2026-s1"));
  const EVIDENCE_HASH = ethers.keccak256(ethers.toUtf8Bytes("canonical-bundle-v1"));
  const IPFS_CID = "bafybei7d39c0c3867db497844fdff6e6b41fb35ca577d83746eb1ff356";
  const CONF_95 = 9500;     // 95% in basis points
  const CONF_60 = 6000;     // 60% -- below min

  async function signResolution(
    signer: HDNodeWallet,
    contractAddr: string,
    marketId: string,
    outcome: number,
    confidence: number,
    evidenceHash: string,
    ipfsCid: string,
    submittedAt: number,
  ): Promise<string> {
    const domain = {
      name: "Veralith ResolutionOracle",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: contractAddr,
    };
    const types = {
      Resolution: [
        { name: "marketId", type: "bytes32" },
        { name: "outcome", type: "uint8" },
        { name: "confidence", type: "uint16" },
        { name: "evidenceHash", type: "bytes32" },
        { name: "ipfsCid", type: "string" },
        { name: "submittedAt", type: "uint256" },
      ],
    };
    const value = { marketId, outcome, confidence, evidenceHash, ipfsCid, submittedAt };
    return await signer.signTypedData(domain, types, value);
  }

  beforeEach(async () => {
    [admin, resolver, disputer, outsider] = (await ethers.getSigners()) as unknown as HDNodeWallet[];
    const Factory = await ethers.getContractFactory("ResolutionOracle");
    oracle = (await Factory.deploy(admin.address, resolver.address)) as unknown as ResolutionOracle;
    await oracle.waitForDeployment();
    // Grant disputer role
    const DISPUTER_ROLE = await oracle.DISPUTER_ROLE();
    await oracle.connect(admin).grantRole(DISPUTER_ROLE, disputer.address);
  });

  // ── Submission ──────────────────────────────────────────────────────────

  describe("submitResolution", () => {
    it("accepts a valid signed YES resolution", async () => {
      const now = Math.floor(Date.now() / 1000);
      const sig = await signResolution(
        resolver, await oracle.getAddress(),
        MARKET_ID, 1, CONF_95, EVIDENCE_HASH, IPFS_CID, now,
      );

      await expect(
        oracle.connect(outsider).submitResolution(
          MARKET_ID, 1, CONF_95, EVIDENCE_HASH, IPFS_CID, now, sig,
        ),
      ).to.emit(oracle, "ResolutionSubmitted")
        .withArgs(MARKET_ID, 1, CONF_95, EVIDENCE_HASH, IPFS_CID, resolver.address);

      const r = await oracle.getResolution(MARKET_ID);
      expect(r.state).to.equal(1); // PENDING
      expect(r.outcome).to.equal(1);
      expect(r.confidence).to.equal(CONF_95);
      expect(r.ipfsCid).to.equal(IPFS_CID);
      expect(r.resolver).to.equal(resolver.address);
    });

    it("accepts INDETERMINATE and finalizes immediately", async () => {
      const now = Math.floor(Date.now() / 1000);
      const sig = await signResolution(
        resolver, await oracle.getAddress(),
        MARKET_ID, 2, CONF_95, EVIDENCE_HASH, IPFS_CID, now,
      );

      await expect(
        oracle.connect(outsider).submitResolution(
          MARKET_ID, 2, CONF_95, EVIDENCE_HASH, IPFS_CID, now, sig,
        ),
      ).to.emit(oracle, "ResolutionFinalized");

      const r = await oracle.getResolution(MARKET_ID);
      expect(r.state).to.equal(4); // UNRESOLVABLE
      expect(r.finalizedAt).to.be.gt(0);
    });

    it("rejects confidence below 70%", async () => {
      const now = Math.floor(Date.now() / 1000);
      const sig = await signResolution(
        resolver, await oracle.getAddress(),
        MARKET_ID, 1, CONF_60, EVIDENCE_HASH, IPFS_CID, now,
      );
      await expect(
        oracle.connect(outsider).submitResolution(
          MARKET_ID, 1, CONF_60, EVIDENCE_HASH, IPFS_CID, now, sig,
        ),
      ).to.be.revertedWithCustomError(oracle, "ConfidenceBelowMinimum");
    });

    it("rejects invalid outcome (>2)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const sig = await signResolution(
        resolver, await oracle.getAddress(),
        MARKET_ID, 3, CONF_95, EVIDENCE_HASH, IPFS_CID, now,
      );
      await expect(
        oracle.connect(outsider).submitResolution(
          MARKET_ID, 3, CONF_95, EVIDENCE_HASH, IPFS_CID, now, sig,
        ),
      ).to.be.revertedWithCustomError(oracle, "InvalidOutcome");
    });

    it("rejects unauthorized signer", async () => {
      const now = Math.floor(Date.now() / 1000);
      const sig = await signResolution(
        outsider, await oracle.getAddress(),
        MARKET_ID, 1, CONF_95, EVIDENCE_HASH, IPFS_CID, now,
      );
      await expect(
        oracle.connect(outsider).submitResolution(
          MARKET_ID, 1, CONF_95, EVIDENCE_HASH, IPFS_CID, now, sig,
        ),
      ).to.be.revertedWithCustomError(oracle, "InvalidSignature");
    });

    it("rejects duplicate submission", async () => {
      const now = Math.floor(Date.now() / 1000);
      const sig = await signResolution(
        resolver, await oracle.getAddress(),
        MARKET_ID, 1, CONF_95, EVIDENCE_HASH, IPFS_CID, now,
      );
      await oracle.connect(outsider).submitResolution(
        MARKET_ID, 1, CONF_95, EVIDENCE_HASH, IPFS_CID, now, sig,
      );
      await expect(
        oracle.connect(outsider).submitResolution(
          MARKET_ID, 1, CONF_95, EVIDENCE_HASH, IPFS_CID, now, sig,
        ),
      ).to.be.revertedWithCustomError(oracle, "AlreadyResolved");
    });
  });

  // ── Dispute ─────────────────────────────────────────────────────────────

  describe("dispute", () => {
    beforeEach(async () => {
      const now = Math.floor(Date.now() / 1000);
      const sig = await signResolution(
        resolver, await oracle.getAddress(),
        MARKET_ID, 1, CONF_95, EVIDENCE_HASH, IPFS_CID, now,
      );
      await oracle.connect(outsider).submitResolution(
        MARKET_ID, 1, CONF_95, EVIDENCE_HASH, IPFS_CID, now, sig,
      );
    });

    it("allows disputer to dispute a pending resolution", async () => {
      await expect(oracle.connect(disputer).dispute(MARKET_ID, "satellite imagery mismatch"))
        .to.emit(oracle, "ResolutionDisputed")
        .withArgs(MARKET_ID, disputer.address, "satellite imagery mismatch");
      const r = await oracle.getResolution(MARKET_ID);
      expect(r.state).to.equal(5); // DISPUTED
    });

    it("rejects dispute from non-disputer", async () => {
      await expect(
        oracle.connect(outsider).dispute(MARKET_ID, "bad"),
      ).to.be.reverted; // AccessControl revert
    });
  });

  // ── Finalize ────────────────────────────────────────────────────────────

  describe("finalize", () => {
    beforeEach(async () => {
      const now = Math.floor(Date.now() / 1000);
      const sig = await signResolution(
        resolver, await oracle.getAddress(),
        MARKET_ID, 1, CONF_95, EVIDENCE_HASH, IPFS_CID, now,
      );
      await oracle.connect(outsider).submitResolution(
        MARKET_ID, 1, CONF_95, EVIDENCE_HASH, IPFS_CID, now, sig,
      );
    });

    it("reverts before dispute window elapses", async () => {
      await expect(
        oracle.connect(outsider).finalize(MARKET_ID),
      ).to.be.revertedWithCustomError(oracle, "DisputeWindowNotElapsed");
    });

    it("finalizes to CONFIRMED_TRUE after dispute window for YES outcome", async () => {
      await ethers.provider.send("evm_increaseTime", [24 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(oracle.connect(outsider).finalize(MARKET_ID))
        .to.emit(oracle, "ResolutionFinalized")
        .withArgs(MARKET_ID, 2); // CONFIRMED_TRUE
      const r = await oracle.getResolution(MARKET_ID);
      expect(r.state).to.equal(2);
      expect(r.finalizedAt).to.be.gt(0);
      expect(await oracle.isFinal(MARKET_ID)).to.be.true;
    });
  });

  // ── Admin ───────────────────────────────────────────────────────────────

  describe("admin", () => {
    it("admin can change dispute window", async () => {
      await expect(oracle.connect(admin).setDisputeWindow(48 * 3600))
        .to.emit(oracle, "DisputeWindowUpdated")
        .withArgs(24 * 3600, 48 * 3600);
      expect(await oracle.disputeWindow()).to.equal(48 * 3600);
    });

    it("non-admin cannot change dispute window", async () => {
      await expect(oracle.connect(outsider).setDisputeWindow(1)).to.be.reverted;
    });
  });

  // ── Views ───────────────────────────────────────────────────────────────

  describe("views", () => {
    it("getResolution reverts for unknown market", async () => {
      const unknown = ethers.keccak256(ethers.toUtf8Bytes("nope"));
      await expect(oracle.getResolution(unknown)).to.be.revertedWithCustomError(oracle, "UnknownMarket");
    });

    it("domainSeparator returns a 32-byte value", async () => {
      const ds = await oracle.domainSeparator();
      expect(ds).to.match(/^0x[0-9a-f]{64}$/);
    });
  });
});
