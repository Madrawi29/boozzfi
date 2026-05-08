// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BoozzToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _supply,
        address _owner
    ) {
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        balanceOf[_owner] = _supply;
        emit Transfer(address(0), _owner, _supply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;

        emit Transfer(msg.sender, to, amount);
        return true;
    }
}