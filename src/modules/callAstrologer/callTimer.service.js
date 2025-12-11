const User = require("../auth/user.Model");
const Employee = require("../employeeUser/employeeUser.model");
const Wallet = require("../wallet/wallet.model");
const Call = require("../callAstrologer/call.model");
const axios = require("axios");

global.runningCalls = {};

async function endCall(userId, reason = "completed") {
    const user = await User.findById(userId);
    const callId = user.currentCallSession.callId;

    const call = await Call.findById(callId);

    // Get astrologer correctly
    const astrologerUser = await User.findById(call.astrologerId);
    const astrologerEmployee = await Employee.findById(astrologerUser.profile);

    // End Smartflo session
    await axios.post(
        "https://api-smartflo.tatateleservices.com/v1/dialer/session_call",
        {
            startOrEnd: false,
            campaignId: process.env.SMARTFLO_CAMPAIGN_ID,
            logout: true,
        },
        {
            headers: { Authorization: `Bearer ${process.env.SMARTFLO_TOKEN}` },
        }
    );

    clearInterval(global.runningCalls[userId]);

    const endTime = new Date();
    const durationSeconds = (endTime - user.currentCallSession.startedAt) / 1000;

    const ratePerSec = user.currentCallSession.perMinuteRate / 60;
    const amount = durationSeconds * ratePerSec;

    // Update call record
    call.endTime = endTime;
    call.durationInSeconds = durationSeconds;
    call.amountCharged = amount;
    call.status = reason === "completed" ? "accepted" : "rejected";
    await call.save();

    // Free astrologer
    astrologerEmployee.isBusy = false;
    astrologerEmployee.currentCustomerId = null;
    await astrologerEmployee.save();

    // Clear session
    user.currentCallSession = null;
    await user.save();
}

async function startWalletTimer(userId) {
    global.runningCalls[userId] = setInterval(async () => {
        const user = await User.findById(userId);
        if (!user.currentCallSession?.isActive) {
            clearInterval(global.runningCalls[userId]);
            return;
        }

        const wallet = await Wallet.findOne({ userId: userId });

        const ratePerSec = user.currentCallSession.perMinuteRate / 60;

        // Not enough balance
        if (!wallet || wallet.balance <= ratePerSec) {
            await endCall(userId, "insufficient_balance");
            return;
        }

        // Deduct balance
        wallet.balance -= ratePerSec;
        await wallet.save();
    }, 1000);
}

module.exports = { startWalletTimer, endCall };
