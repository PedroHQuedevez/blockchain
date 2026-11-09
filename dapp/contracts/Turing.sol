// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract Turing {
    address public owner;
    address public professor;
    bool public voting = true;

    mapping(string => address) public users;
    mapping(address => string) public codenameByAddress;
    mapping(string => mapping(string => bool)) public hasVote;
    mapping(address => uint256) private balances;
    mapping(address => uint256) public voteCount;

    modifier onlySuperUser() {
        require(msg.sender == owner || msg.sender == professor, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
        professor = 0x502542668aF09fa7aea52174b9965A7799343Df7;

        users["roberta"] = professor;
        users["nome1"] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        users["nome2"] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
        users["nome3"] = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;
        users["nome4"] = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;
        users["nome5"] = 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc;

        codenameByAddress[professor] = "roberta";
        codenameByAddress[users["nome1"]] = "nome1";
        codenameByAddress[users["nome2"]] = "nome2";
        codenameByAddress[users["nome3"]] = "nome3";
        codenameByAddress[users["nome4"]] = "nome4";
        codenameByAddress[users["nome5"]] = "nome5";
    }

    function updateUser(
        string calldata codename,
        address userAddress
    ) external onlySuperUser {
        require(bytes(codename).length > 0, "Codename cannot be empty");
        require(userAddress != address(0), "Invalid user address");

        address oldAddress = users[codename];
        if (oldAddress != address(0)) delete codenameByAddress[oldAddress];

        string memory oldCodename = codenameByAddress[userAddress];
        if (bytes(oldCodename).length > 0) delete users[oldCodename];

        users[codename] = userAddress;
        codenameByAddress[userAddress] = codename;
    }

    function votingOn() external onlySuperUser {
        voting = true;
    }

    function votingOff() external onlySuperUser {
        voting = false;
    }

    function issueToken(
        string calldata codename,
        uint256 amount
    ) external onlySuperUser {
        address recipient = users[codename];
        require(recipient != address(0), "Unknown codename");
        _mint(recipient, amount);
    }

    function vote(string calldata codename, uint256 amount) external {
        require(voting, "Voting is not active");
        require(bytes(codenameByAddress[msg.sender]).length > 0, "User is not registered");
        require(users[codename] != address(0), "Unknown codename");
        require(users[codename] != msg.sender, "Cannot vote for yourself");
        require(amount > 0 && amount <= 2, "Vote must be 1 or 2 Turings");

        string memory voterCodename = codenameByAddress[msg.sender];
        require(!hasVote[voterCodename][codename], "Already voted for user");
        hasVote[voterCodename][codename] = true;

        voteCount[msg.sender]++;
        _mint(users[codename], amount);
        if (voteCount[msg.sender] % 10 == 0) _mint(msg.sender, 1);
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    function _mint(address recipient, uint256 amount) internal {
        balances[recipient] += amount;
    }
}
