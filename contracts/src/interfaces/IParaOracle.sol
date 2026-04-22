// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IParaOracle — interface du contrat d'oracle ParaOracle.
/// @notice Un oracle ancre on-chain une resolution verifiable (fingerprint +
/// CIDs IPFS + resultat binaire) avec caution USDC et fenetre de dispute 48h.
interface IParaOracle {
    enum Status { NONE, PENDING, DISPUTED, FINALIZED }

    struct Resolution {
        bytes32 fingerprint;      // SHA-256 du data.json canonique (sans prefixe "sha256:")
        string  dataCID;          // IPFS CID du manifest (data.json)
        string  scriptCID;        // IPFS CID du resolution_script.py
        bytes32 betSlugHash;      // keccak256(bet_slug)
        uint256 threshold;        // seuil (unite fixee par le pari, cast a uint256)
        uint256 observed;         // valeur observee (meme unite)
        bool    outcome;          // resultat binaire (YES/NO)
        uint64  periodEnd;        // timestamp fin de periode du pari
        uint64  submittedAt;      // block.timestamp au submit
        uint64  disputeWindowEnd; // submittedAt + disputeWindowSeconds
        address oracle;           // soumetteur
        uint256 bond;             // caution de l'oracle (USDC)
        Status  status;
        address challenger;       // 0x0 si pas disputed
        uint256 challengerBond;   // caution du challenger (egale au bond oracle)
    }

    event ResolutionSubmitted(
        bytes32 indexed resolutionId,
        bytes32 indexed betSlugHash,
        bytes32 fingerprint,
        string  dataCID,
        string  scriptCID,
        address indexed oracle,
        bool    outcome,
        uint256 observed,
        uint256 threshold,
        uint64  periodEnd,
        uint64  disputeWindowEnd,
        uint256 bond
    );

    event ResolutionDisputed(
        bytes32 indexed resolutionId,
        address indexed challenger,
        uint256 bond
    );

    event ResolutionFinalized(
        bytes32 indexed resolutionId,
        bool outcome,
        Status finalStatus
    );

    event DisputeResolved(
        bytes32 indexed resolutionId,
        bool oracleWins
    );

    function submitResolution(
        bytes32 fingerprint,
        string calldata dataCID,
        string calldata scriptCID,
        bytes32 betSlugHash,
        uint256 threshold,
        uint256 observed,
        bool outcome,
        uint64 periodEnd
    ) external returns (bytes32 resolutionId);

    function dispute(bytes32 resolutionId) external;
    function finalize(bytes32 resolutionId) external;
    function resolveDispute(bytes32 resolutionId, bool oracleWins) external;

    function getResolution(bytes32 resolutionId) external view returns (Resolution memory);
    function computeResolutionId(bytes32 betSlugHash, uint64 periodEnd) external pure returns (bytes32);
}
