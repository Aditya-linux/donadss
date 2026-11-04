// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { DonadsPolicyVault } from "../src/DonadsPolicyVault.sol";

contract NativeReceiver {
    receive() external payable { }
}

contract SessionActor {
    function execute(
        DonadsPolicyVault vault,
        address payable recipient,
        uint128 amountWei,
        bytes32 actionHash
    ) external {
        vault.executeNative(recipient, amountWei, actionHash);
    }

    function pause(DonadsPolicyVault vault) external {
        vault.setPaused(true);
    }
}

contract DonadsPolicyVaultTest {
    DonadsPolicyVault private vault;
    NativeReceiver private receiver;
    SessionActor private session;

    receive() external payable { }

    function setUp() public {
        vault = new DonadsPolicyVault();
        receiver = new NativeReceiver();
        session = new SessionActor();
        vault.configureSession(address(session), uint64(block.timestamp + 1 days), 2 ether, 3 ether);
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
        ) = vault.sessions(address(session));
        require(expiresAt > block.timestamp, "expiry mismatch");
        require(perTx == 2 ether && daily == 3 ether && active, "policy mismatch");
        require(spentToday == 0 && spendingDay == block.timestamp / 1 days, "spending mismatch");
    }

    function testRejectsUnapprovedRecipient() public {
        (bool success,) = address(session).call(
            abi.encodeCall(
                session.execute,
                (vault, payable(address(0xBEEF)), 1, keccak256("blocked"))
            )
        );
        require(!success, "unapproved recipient accepted");
    }

    function testExecutesBoundedTransferAndAccountsForSpend() public {
        payable(address(vault)).transfer(2 ether);
        uint256 balanceBefore = address(receiver).balance;
        session.execute(vault, payable(address(receiver)), 2 ether, keccak256("bounded"));

        (,,, uint128 spentToday,,) = vault.sessions(address(session));
        require(spentToday == 2 ether, "spend not accounted");
        require(address(receiver).balance == balanceBefore + 2 ether, "recipient not paid");
    }

    function testRejectsReplay() public {
        payable(address(vault)).transfer(2);
        bytes32 actionHash = keccak256("one-action");
        session.execute(vault, payable(address(receiver)), 1, actionHash);
        (bool success,) = address(session).call(
            abi.encodeCall(session.execute, (vault, payable(address(receiver)), 1, actionHash))
        );
        require(!success, "replayed action accepted");
    }

    function testEnforcesPerTransactionAndDailyLimits() public {
        payable(address(vault)).transfer(4 ether);
        (bool overPerTransaction,) = address(session).call(
            abi.encodeCall(
                session.execute,
                (vault, payable(address(receiver)), uint128(2 ether + 1), keccak256("over-per-tx"))
            )
        );
        require(!overPerTransaction, "per-transaction limit bypassed");

        session.execute(vault, payable(address(receiver)), 2 ether, keccak256("daily-first"));
        (bool overDaily,) = address(session).call(
            abi.encodeCall(
                session.execute,
                (vault, payable(address(receiver)), 2 ether, keccak256("daily-second"))
            )
        );
        require(!overDaily, "daily limit bypassed");
    }

    function testRevocationBlocksSession() public {
        vault.revokeSession(address(session));
        (bool success,) = address(session).call(
            abi.encodeCall(
                session.execute,
                (vault, payable(address(receiver)), 1, keccak256("revoked"))
            )
        );
        require(!success, "revoked session executed");
    }

    function testKillSwitchBlocksExecution() public {
        vault.setPaused(true);
        (bool success,) = address(session).call(
            abi.encodeCall(
                session.execute,
                (vault, payable(address(receiver)), 1, keccak256("paused"))
            )
        );
        require(!success, "paused vault executed");
    }

    function testRejectsNonOwnerAdministration() public {
        (bool success,) = address(session).call(abi.encodeCall(session.pause, (vault)));
        require(!success, "non-owner paused vault");
    }
}
