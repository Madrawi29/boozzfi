// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILendingERC20 {
    function balanceOf(address owner) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract BoozzLendingVault {
    struct Market {
        bool active;
        uint8 decimals;
        uint16 collateralFactorBps;
        uint256 priceUsdE18;
        uint256 totalSupplied;
        uint256 totalBorrowed;
    }

    address public owner;
    address[] public marketTokens;
    mapping(address => Market) public markets;
    mapping(address => bool) private marketExists;
    mapping(address => mapping(address => uint256)) public suppliedOf;
    mapping(address => mapping(address => uint256)) public borrowedOf;

    uint256 public constant BPS = 10_000;
    uint256 public constant PRICE_SCALE = 1e18;

    event Borrowed(address indexed user, address indexed token, uint256 amount, address indexed recipient);
    event MarketUpdated(address indexed token, uint8 decimals, uint16 collateralFactorBps, uint256 priceUsdE18, bool active);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Repaid(address indexed payer, address indexed borrower, address indexed token, uint256 amount);
    event Supplied(address indexed user, address indexed token, uint256 amount, address indexed recipient);
    event Withdrawn(address indexed user, address indexed token, uint256 amount, address indexed recipient);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setMarket(
        address token,
        uint8 decimals,
        uint16 collateralFactorBps,
        uint256 priceUsdE18,
        bool active
    ) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(decimals <= 36, "Invalid decimals");
        require(collateralFactorBps <= 9_000, "Collateral too high");
        require(priceUsdE18 > 0, "Invalid price");

        if (!marketExists[token]) {
            marketExists[token] = true;
            marketTokens.push(token);
        }

        Market storage market = markets[token];
        market.decimals = decimals;
        market.collateralFactorBps = collateralFactorBps;
        market.priceUsdE18 = priceUsdE18;
        market.active = active;

        emit MarketUpdated(token, decimals, collateralFactorBps, priceUsdE18, active);
    }

    function marketCount() external view returns (uint256) {
        return marketTokens.length;
    }

    function supply(address token, uint256 amount, address recipient) external {
        require(amount > 0, "Amount must be positive");
        require(recipient != address(0), "Invalid recipient");
        _requireActiveMarket(token);

        require(
            ILendingERC20(token).transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );

        suppliedOf[recipient][token] += amount;
        markets[token].totalSupplied += amount;

        emit Supplied(msg.sender, token, amount, recipient);
    }

    function withdraw(address token, uint256 amount, address recipient) external {
        require(amount > 0, "Amount must be positive");
        require(recipient != address(0), "Invalid recipient");
        _requireKnownMarket(token);
        require(suppliedOf[msg.sender][token] >= amount, "Insufficient supplied balance");

        suppliedOf[msg.sender][token] -= amount;
        markets[token].totalSupplied -= amount;

        require(_isAccountHealthy(msg.sender), "Withdraw would exceed borrow limit");
        require(ILendingERC20(token).balanceOf(address(this)) >= amount, "Insufficient vault liquidity");
        require(ILendingERC20(token).transfer(recipient, amount), "Token transfer failed");

        emit Withdrawn(msg.sender, token, amount, recipient);
    }

    function borrow(address token, uint256 amount, address recipient) external {
        require(amount > 0, "Amount must be positive");
        require(recipient != address(0), "Invalid recipient");
        _requireActiveMarket(token);
        require(ILendingERC20(token).balanceOf(address(this)) >= amount, "Insufficient vault liquidity");

        borrowedOf[msg.sender][token] += amount;
        markets[token].totalBorrowed += amount;

        require(_isAccountHealthy(msg.sender), "Borrow would exceed limit");
        require(ILendingERC20(token).transfer(recipient, amount), "Token transfer failed");

        emit Borrowed(msg.sender, token, amount, recipient);
    }

    function repay(address token, uint256 amount, address borrower) external returns (uint256 repaidAmount) {
        require(amount > 0, "Amount must be positive");
        require(borrower != address(0), "Invalid borrower");
        _requireKnownMarket(token);

        uint256 debt = borrowedOf[borrower][token];
        require(debt > 0, "No debt");

        repaidAmount = amount < debt ? amount : debt;
        require(
            ILendingERC20(token).transferFrom(msg.sender, address(this), repaidAmount),
            "Token transfer failed"
        );

        borrowedOf[borrower][token] = debt - repaidAmount;
        markets[token].totalBorrowed -= repaidAmount;

        emit Repaid(msg.sender, borrower, token, repaidAmount);
    }

    function getAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralUsdE18,
            uint256 totalBorrowUsdE18,
            uint256 borrowLimitUsdE18,
            uint256 healthFactorE18
        )
    {
        (totalCollateralUsdE18, totalBorrowUsdE18, borrowLimitUsdE18) = _accountValues(user);
        healthFactorE18 = totalBorrowUsdE18 == 0
            ? type(uint256).max
            : (borrowLimitUsdE18 * PRICE_SCALE) / totalBorrowUsdE18;
    }

    function _requireActiveMarket(address token) internal view {
        _requireKnownMarket(token);
        require(markets[token].active, "Market is not active");
    }

    function _requireKnownMarket(address token) internal view {
        require(marketExists[token], "Unsupported market");
    }

    function _isAccountHealthy(address user) internal view returns (bool) {
        (, uint256 totalBorrowUsdE18, uint256 borrowLimitUsdE18) = _accountValues(user);
        return totalBorrowUsdE18 <= borrowLimitUsdE18;
    }

    function _accountValues(address user)
        internal
        view
        returns (
            uint256 totalCollateralUsdE18,
            uint256 totalBorrowUsdE18,
            uint256 borrowLimitUsdE18
        )
    {
        for (uint256 index = 0; index < marketTokens.length; index++) {
            address token = marketTokens[index];
            Market memory market = markets[token];
            uint256 suppliedValue = _toUsdValue(suppliedOf[user][token], market);
            uint256 borrowedValue = _toUsdValue(borrowedOf[user][token], market);

            totalCollateralUsdE18 += suppliedValue;
            totalBorrowUsdE18 += borrowedValue;
            borrowLimitUsdE18 += (suppliedValue * market.collateralFactorBps) / BPS;
        }
    }

    function _toUsdValue(uint256 amount, Market memory market) internal pure returns (uint256) {
        if (amount == 0) return 0;
        return (amount * market.priceUsdE18) / (10 ** uint256(market.decimals));
    }
}
