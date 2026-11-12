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
        users["nome6"] = 0x976EA74026E726554dB657fA54763abd0C3a0aa9;
        users["nome7"] = 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955;
        users["nome8"] = 0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f;
        users["nome9"] = 0xa0Ee7A142d267C1f36714E4a8F75612F20a79720;
        users["nome10"] = 0xBcd4042DE499D14e55001CcbB24a551F3b954096;
        users["nome11"] = 0x71bE63f3384f5fb98995898A86B02Fb2426c5788;
        users["nome12"] = 0xFABB0ac9d68B0B445fB7357272Ff202C5651694a;
        users["nome13"] = 0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec;
        users["nome14"] = 0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097;
        users["nome15"] = 0xcd3B766CCDd6AE721141F452C550Ca635964ce71;

        codenameByAddress[professor] = "roberta";
        codenameByAddress[users["nome1"]] = "nome1";
        codenameByAddress[users["nome2"]] = "nome2";
        codenameByAddress[users["nome3"]] = "nome3";
        codenameByAddress[users["nome4"]] = "nome4";
        codenameByAddress[users["nome5"]] = "nome5";
        codenameByAddress[users["nome6"]] = "nome6";
        codenameByAddress[users["nome7"]] = "nome7";
        codenameByAddress[users["nome8"]] = "nome8";
        codenameByAddress[users["nome9"]] = "nome9";
        codenameByAddress[users["nome10"]] = "nome10";
        codenameByAddress[users["nome11"]] = "nome11";
        codenameByAddress[users["nome12"]] = "nome12";
        codenameByAddress[users["nome13"]] = "nome13";
        codenameByAddress[users["nome14"]] = "nome14";
        codenameByAddress[users["nome15"]] = "nome15";


    }

    function updateUser(
        string calldata codename,
        address userAddress
    ) external onlySuperUser {
        require(bytes(codename).length > 0, "Codename cannot be empty");
        require(userAddress != address(0), "Invalid user address");

        // address oldAddress = users[codename];
        // if (oldAddress != address(0)) delete codenameByAddress[oldAddress];

        // string memory oldCodename = codenameByAddress[userAddress];
        // if (bytes(oldCodename).length > 0) delete users[oldCodename];

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
