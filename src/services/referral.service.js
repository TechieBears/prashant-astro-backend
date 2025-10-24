const CustomerUser = require("../modules/customerUser/customerUser.model");
const Wallet = require("../modules/wallet/wallet.model");
const User = require("../modules/auth/user.Model");

exports.processReferralReward = async (userId, session = null) => {
  try {
    // Find user and their customer profile
    const user = await User.findById(userId).populate('profile');
    if (!user || !user.profile) {
      return { success: false, message: "User or customer profile not found" };
    }

    const customer = await CustomerUser.findById(user.profile._id)
      .populate('referredBy')
      .populate('wallet');

    if (!customer || !customer.referredBy || customer.referralRewardGiven) {
      return { success: false, message: "No referral reward to process" };
    }

    // Populate referrer's wallet
    const referrer = await CustomerUser.findById(customer.referredBy._id)
      .populate('wallet');

    if (!referrer || !referrer.wallet) {
      return { success: false, message: "Referrer or wallet not found" };
    }

    const options = session ? { session } : {};

    // Credit 100 to referred user
    customer.wallet.balance += 100;
    await customer.wallet.save(options);

    // Credit 100 to referrer
    referrer.wallet.balance += 100;
    await referrer.wallet.save(options);

    // Mark referral reward as given
    customer.referralRewardGiven = true;
    await customer.save(options);

    return {
      success: true,
      message: "Referral rewards processed successfully",
      data: {
        referredUserCredited: 100,
        referrerCredited: 100,
        referredUserNewBalance: customer.wallet.balance,
        referrerNewBalance: referrer.wallet.balance
      }
    };
  } catch (error) {
    console.error("Error processing referral reward:", error);
    return { success: false, message: "Failed to process referral reward" };
  }
};