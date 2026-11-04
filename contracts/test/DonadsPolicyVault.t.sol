// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { DonadsPolicyVault } from "../src/DonadsPolicyVault.sol";

contract NativeReceiver {
    receive() external payable { }
}

contract DonadsPolicyVaultTest {
    DonadsPolicyVault private vault;
    NativeReceiver private receiver;

    receive() external payable { }

    function setUp() public {
        vault = new DonadsPolicyVault();
        receiver = new NativeReceiver();
        vault.configureSession(address(this), uint64(block.timestamp + 1 days), 2 ether, 3 ether);
        vault.setRecipientAllowed(address(receiver), true);
    }

    function testOwnerAndSessionPolicy() public view {
        require(vault.owner() == address(this), "owner mismatch");
        (
            uint64 expiresAt,
            uint128 perTx,
            uint128 daily,
            uint128 spentToday,
            uint64 spendingDay,
            bool active
        ) = vault.sessions(address(this));
        require(expiresAt > block.timestamp, "expiry mismatch");
        require(perTx == 2 ether && daily == 3 ether && active, "policy mismatch");
        require(spentToday == 0 && spendingDay == block.timestamp / 1 days, "spending mismatch");
    }

    function testRejectsUnapprovedRecipient() public {
        (bool success,) = address(vault).call(
            abi.encodeCall(vault.executeNative, (payable(address(0xBEEF)), 1, keccak256("blocked")))
        );
        require(!success, "unapproved recipient accepted");
    }

    function testRejectsReplay() public {
        if (address(this).balance < 2) return;
        payable(address(vault)).transfer(2);
        bytes32 actionHash = keccak256("one-action");
        vault.executeNative(payable(address(receiver)), 1, actionHash);
        (bool success,) = address(vault).call(
            abi.encodeCall(vault.executeNative, (payable(address(receiver)), 1, actionHash))
        );
        require(!success, "replayed action accepted");
    }

    function testKillSwitchBlocksExecution() public {
        vault.setPaused(true);
        (bool success,) = address(vault).call(
            abi.encodeCall(vault.executeNative, (payable(address(receiver)), 1, keccak256("paused")))
        );
        require(!success, "paused vault executed");
    }
}
