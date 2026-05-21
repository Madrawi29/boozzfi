// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract BoozzLiquidityVault {
    struct Pool {
        address token0;
        address token1;
        uint256 reserve0;
        uint256 reserve1;
        uint256 totalLpShares;
        bool exists;
    }

    mapping(bytes32 => Pool) public pools;
    mapping(bytes32 => mapping(address => uint256)) public lpBalanceOf;
    mapping(bytes32 => mapping(address => uint256)) public vaultBalanceOf;
    mapping(bytes32 => mapping(address => uint256)) public vaultUnlockTime;

    event LiquidityAdded(
        address indexed provider,
        bytes32 indexed pairId,
        address indexed token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        uint256 lpShares
    );
    event LiquidityRemoved(
        address indexed provider,
        bytes32 indexed pairId,
        uint256 shares,
        uint256 amount0,
        uint256 amount1
    );
    event VaultDeposited(address indexed owner, bytes32 indexed pairId, uint256 shares, uint256 unlockTime);
    event VaultWithdrawn(address indexed owner, bytes32 indexed pairId, uint256 shares);

    function pairIdFor(address tokenA, address tokenB) public pure returns (bytes32) {
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        return keccak256(abi.encode(token0, token1));
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        address recipient
    ) external returns (bytes32 pairId, uint256 lpShares) {
        require(amountA > 0 && amountB > 0, "Amounts must be positive");
        require(recipient != address(0), "Invalid recipient");

        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        (uint256 amount0, uint256 amount1) = tokenA == token0
            ? (amountA, amountB)
            : (amountB, amountA);

        pairId = pairIdFor(token0, token1);
        Pool storage pool = pools[pairId];

        require(
            IERC20(token0).transferFrom(msg.sender, address(this), amount0),
            "Token0 transfer failed"
        );
        require(
            IERC20(token1).transferFrom(msg.sender, address(this), amount1),
            "Token1 transfer failed"
        );

        if (!pool.exists) {
            pool.token0 = token0;
            pool.token1 = token1;
            pool.exists = true;
            lpShares = _sqrt(amount0 * amount1);
        } else {
            uint256 share0 = (amount0 * pool.totalLpShares) / pool.reserve0;
            uint256 share1 = (amount1 * pool.totalLpShares) / pool.reserve1;
            lpShares = share0 < share1 ? share0 : share1;
        }

        require(lpShares > 0, "LP shares too small");

        pool.reserve0 += amount0;
        pool.reserve1 += amount1;
        pool.totalLpShares += lpShares;
        lpBalanceOf[pairId][recipient] += lpShares;

        emit LiquidityAdded(msg.sender, pairId, token0, token1, amount0, amount1, lpShares);
    }

    function depositToVault(
        address tokenA,
        address tokenB,
        uint256 shares,
        address recipient,
        uint256 lockDurationSeconds
    ) external returns (bytes32 pairId) {
        require(shares > 0, "Shares must be positive");
        require(recipient != address(0), "Invalid recipient");

        pairId = pairIdFor(tokenA, tokenB);
        require(lpBalanceOf[pairId][msg.sender] >= shares, "Insufficient LP shares");

        lpBalanceOf[pairId][msg.sender] -= shares;
        vaultBalanceOf[pairId][recipient] += shares;

        uint256 nextUnlockTime = block.timestamp + lockDurationSeconds;
        if (nextUnlockTime > vaultUnlockTime[pairId][recipient]) {
            vaultUnlockTime[pairId][recipient] = nextUnlockTime;
        }

        emit VaultDeposited(recipient, pairId, shares, vaultUnlockTime[pairId][recipient]);
    }

    function withdrawFromVault(
        address tokenA,
        address tokenB,
        uint256 shares,
        address recipient
    ) external returns (bytes32 pairId) {
        require(shares > 0, "Shares must be positive");
        require(recipient != address(0), "Invalid recipient");

        pairId = pairIdFor(tokenA, tokenB);
        require(vaultBalanceOf[pairId][msg.sender] >= shares, "Insufficient vault shares");
        require(block.timestamp >= vaultUnlockTime[pairId][msg.sender], "Vault shares are locked");

        vaultBalanceOf[pairId][msg.sender] -= shares;
        lpBalanceOf[pairId][recipient] += shares;

        emit VaultWithdrawn(recipient, pairId, shares);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 shares,
        address recipient
    ) external returns (bytes32 pairId, uint256 amountA, uint256 amountB) {
        require(shares > 0, "Shares must be positive");
        require(recipient != address(0), "Invalid recipient");

        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        pairId = pairIdFor(token0, token1);
        Pool storage pool = pools[pairId];

        require(pool.exists, "Pool does not exist");
        require(lpBalanceOf[pairId][msg.sender] >= shares, "Insufficient LP shares");
        require(pool.totalLpShares > 0, "Pool has no shares");

        uint256 amount0 = (shares * pool.reserve0) / pool.totalLpShares;
        uint256 amount1 = (shares * pool.reserve1) / pool.totalLpShares;

        require(amount0 > 0 && amount1 > 0, "Withdraw amounts too small");

        lpBalanceOf[pairId][msg.sender] -= shares;
        pool.totalLpShares -= shares;
        pool.reserve0 -= amount0;
        pool.reserve1 -= amount1;

        require(IERC20(token0).transfer(recipient, amount0), "Token0 transfer failed");
        require(IERC20(token1).transfer(recipient, amount1), "Token1 transfer failed");

        emit LiquidityRemoved(msg.sender, pairId, shares, amount0, amount1);

        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
    }

    function _sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "Identical tokens");
        require(tokenA != address(0) && tokenB != address(0), "Invalid token");

        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    function _sqrt(uint256 value) internal pure returns (uint256 result) {
        if (value == 0) return 0;

        uint256 x = value;
        result = (x + 1) / 2;
        while (result < x) {
            x = result;
            result = (value / result + result) / 2;
        }
        return x;
    }
}
